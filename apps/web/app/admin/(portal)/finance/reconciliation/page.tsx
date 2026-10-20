"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Financial Reconciliation
// ───────────────────────────────────────────────────────────────────────────────
// Every number here comes from admin_reconciliation_report(), which aggregates
// the live ledger in Postgres. Nothing is sampled in the browser and nothing is
// prefilled: a check that finds nothing says "clean", and the page says how many
// wallets, bookings and ledger rows were actually scanned to reach that verdict.
//
// One action is offered — recomputing a wallet's pendingOut from its pending
// payout rows. It is the only repair that cannot invent money, because
// pendingOut is derived: no other field may be written by fiat. Balance
// corrections are deliberately left to a human, since the ledger's own sign
// convention has been broken before (see the migration header).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  IndianRupee,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wand2,
} from "lucide-react";
import { channels, useChannel, type BroadcastChange } from "@zeal/realtime";
import { toast } from "@/components/ui/toaster";

interface ReconciliationItem {
  [key: string]: unknown;
}

interface ReconciliationCheck {
  key: string;
  label: string;
  help: string;
  severity: "auto" | "review";
  count: number;
  total: number;
  items: ReconciliationItem[];
}

interface Report {
  ok: boolean;
  degraded: string | null;
  generatedAt: string;
  scanned: { wallets: number; bookings: number; transactions: number } | null;
  summary: {
    total: number;
    autoCorrectable: number;
    manualReview: number;
    valueAtRisk: number;
  };
  checks: ReconciliationCheck[];
  legacy?: { wallet_drift?: number; missigned_rows?: number; open_discrepancies?: number };
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function truncate(id: unknown): string {
  return typeof id === "string" ? `${id.slice(0, 8)}…` : "—";
}

/** Per-check column plan, so a row renders as a table rather than raw JSON. */
const COLUMNS: Record<string, { label: string; keys: string[] }[]> = {
  ledger_drift: [
    { label: "Account", keys: ["email"] },
    { label: "Wallet balance", keys: ["balance"] },
    { label: "Ledger total", keys: ["ledger_net"] },
    { label: "Difference", keys: ["drift"] },
  ],
  negative_components: [
    { label: "Account", keys: ["email"] },
    { label: "Fields below zero", keys: ["fields"] },
  ],
  pendingout_drift: [
    { label: "Account", keys: ["email"] },
    { label: "pendingOut", keys: ["pending_out"] },
    { label: "Pending payouts", keys: ["requests_total"] },
    { label: "Difference", keys: ["drift"] },
  ],
  missigned_ledger: [
    { label: "Account", keys: ["userId"] },
    { label: "Type", keys: ["type"] },
    { label: "Amount", keys: ["amount"] },
    { label: "Reference", keys: ["referenceId"] },
    { label: "Recorded", keys: ["created_at"] },
  ],
  booking_credit_missing: [
    { label: "Booking", keys: ["bookingId"] },
    { label: "Consultant", keys: ["email"] },
    { label: "Owed", keys: ["earning"] },
    { label: "Settled", keys: ["settled_at"] },
  ],
  booking_fee_split: [
    { label: "Booking", keys: ["bookingId"] },
    { label: "Amount", keys: ["amount"] },
    { label: "Platform fee", keys: ["platform_fee"] },
    { label: "Consultant", keys: ["earning"] },
    { label: "Does not add up by", keys: ["difference"] },
  ],
  booking_uncollected: [
    { label: "Booking", keys: ["bookingId"] },
    { label: "Seeker", keys: ["seeker_email"] },
    { label: "Amount", keys: ["amount"] },
    { label: "Payment status", keys: ["payment_status"] },
  ],
};

const MONEY_FIELDS = new Set([
  "balance", "ledger_net", "drift", "amount", "earning", "platform_fee",
  "difference", "pending_out", "requests_total", "expected", "actual",
]);

function renderValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "email" || key === "seeker_email") return String(value);
  if (key === "userId" || key === "consultantUserId") return truncate(value);
  if (key === "referenceId") {
    const s = String(value);
    return s.startsWith("session-start:") ? "session hold" : s;
  }
  if (key === "fields" && value && typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" && v < 0)
      .map(([k, v]) => `${k} ₹${fmtINR(Number(v))}`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
  if (typeof value === "number") {
    return MONEY_FIELDS.has(key) ? `₹${fmtINR(value)}` : String(value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)) return truncate(value);
  return String(value);
}

function StatCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "text-foreground border-border",
    good: "text-emerald-400 border-emerald-500/20",
    warn: "text-amber-400 border-amber-500/20",
    bad: "text-rose-400 border-rose-500/20",
  }[tone];
  return (
    <div className={`rounded-2xl border bg-surface p-4 text-center ${tones}`}>
      <p className="text-2xl font-black font-mono tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mt-1">{label}</p>
    </div>
  );
}

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Report>({
    queryKey: ["admin", "finance", "reconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reconciliation?limit=50", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error || `Reconciliation failed (${res.status})`);
      }
      return res.json();
    },
  });

  // Another console repaired something — re-run the checks instead of waiting
  // for a manual refresh.
  useChannel<BroadcastChange>({
    channel: channels.adminReconciliation(),
    event: "reconciliation:updated",
    onMessage: () => void refetch(),
  });

  const repair = useMutation({
    mutationFn: async (walletId: string) => {
      const res = await fetch("/api/admin/reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Repair failed (${res.status})`);
      return body as { changed: boolean; before?: number; after?: number };
    },
    onSuccess: (r) => {
      if (r.changed) {
        toast({
          title: "pendingOut recomputed",
          description: `₹${fmtINR(Number(r.before ?? 0))} → ₹${fmtINR(Number(r.after ?? 0))}`,
          variant: "success",
        });
      } else {
        toast({ title: "Already consistent", description: "Nothing needed changing." });
      }
      void qc.invalidateQueries({ queryKey: ["admin", "finance", "reconciliation"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not reconcile", description: err.message, variant: "destructive" });
    },
  });

  const checks = data?.checks ?? [];
  const summary = data?.summary;
  const expanded = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const c of checks) out[c.key] = open[c.key] ?? c.count > 0;
    return out;
  }, [checks, open]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6 pb-16"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-emerald-500" /> Financial Reconciliation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The ledger, every wallet and every settled booking, checked in the database.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2 disabled:opacity-60"
        >
          {isFetching ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Re-run checks
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Scanning wallets, bookings and the ledger…
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
          <ShieldAlert className="w-7 h-7 mx-auto mb-2 text-rose-400" />
          <p className="text-sm font-bold text-rose-400">Reconciliation could not run</p>
          <p className="text-xs text-muted-foreground mt-1 break-words">{(error as Error).message}</p>
          <button
            onClick={() => void refetch()}
            className="mt-4 px-4 py-2 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold"
          >
            Try again
          </button>
        </div>
      )}

      {data && !isLoading && (
        <>
          {data.degraded && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <AlertTriangle size={14} /> Reduced report
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Apply <code className="text-amber-300">{data.degraded}</code> to get the per-wallet,
                per-booking breakdown and the payouts repair. Until then only the checks that already
                exist in the database are shown.
              </p>
              {data.legacy && (
                <p className="text-xs text-foreground mt-2 font-mono">
                  wallets off their ledger: {data.legacy.wallet_drift ?? 0} · mis-signed ledger rows:{" "}
                  {data.legacy.missigned_rows ?? 0} · open discrepancies: {data.legacy.open_discrepancies ?? 0}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              value={String(summary?.total ?? 0)}
              label="Findings"
              tone={(summary?.total ?? 0) === 0 ? "good" : "bad"}
            />
            <StatCard
              value={String(summary?.autoCorrectable ?? 0)}
              label="One-click repair"
              tone="warn"
            />
            <StatCard
              value={String(summary?.manualReview ?? 0)}
              label="Needs a human"
              tone="neutral"
            />
            <StatCard
              value={`₹${fmtINR(summary?.valueAtRisk ?? 0)}`}
              label="Value involved"
              tone={(summary?.valueAtRisk ?? 0) > 0 ? "bad" : "good"}
            />
          </div>

          {data.scanned && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
              <Activity size={12} className="text-emerald-500" />
              Scanned {data.scanned.wallets} wallets · {data.scanned.bookings} bookings ·{" "}
              {data.scanned.transactions} ledger rows
              {data.generatedAt
                ? ` · ${new Date(data.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                : ""}
            </p>
          )}

          {checks.length === 0 && !data.degraded && (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-bold text-emerald-400">Every check came back clean</p>
            </div>
          )}

          <div className="space-y-3">
            {checks.map((c) => {
              const cols = COLUMNS[c.key] ?? [{ label: "Detail", keys: Object.keys(c.items[0] ?? {}) }];
              const isOpen = expanded[c.key];
              return (
                <section key={c.key} className="rounded-2xl border border-border bg-surface overflow-hidden">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [c.key]: !isOpen }))}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-raised transition"
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        c.count === 0
                          ? "bg-emerald-500/10"
                          : c.severity === "auto"
                            ? "bg-amber-500/10"
                            : "bg-rose-500/10"
                      }`}
                    >
                      {c.count === 0 ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : c.severity === "auto" ? (
                        <Wand2 size={14} className="text-amber-400" />
                      ) : (
                        <AlertTriangle size={14} className="text-rose-400" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-foreground">{c.label}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{c.help}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block font-mono text-sm font-black text-foreground tabular-nums">
                        {c.count}
                      </span>
                      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                        ₹{fmtINR(c.total)}
                      </span>
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-muted-foreground shrink-0 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isOpen && c.count > 0 && (
                    <div className="px-4 pb-4 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground uppercase tracking-wider text-[10px]">
                            {cols.map((col) => (
                              <th key={col.label} className="py-2 pr-4 font-black">{col.label}</th>
                            ))}
                            {c.severity === "auto" && <th className="py-2 font-black text-right">Repair</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {c.items.map((item, i) => (
                            <tr key={i} className="border-t border-border/60">
                              {cols.map((col) => (
                                <td
                                  key={col.label}
                                  className="py-2 pr-4 text-foreground font-mono tabular-nums break-all"
                                >
                                  {col.keys.map((k) => renderValue(k, item[k])).join(" ")}
                                </td>
                              ))}
                              {c.severity === "auto" && (
                                <td className="py-2 text-right">
                                  <button
                                    onClick={() => repair.mutate(String(item.walletId))}
                                    disabled={repair.isPending}
                                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] font-bold flex items-center gap-1 ml-auto disabled:opacity-50"
                                  >
                                    {repair.isPending ? (
                                      <Loader2 size={11} className="animate-spin" />
                                    ) : (
                                      <Wand2 size={11} />
                                    )}
                                    Recompute
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isOpen && c.count === 0 && (
                    <p className="px-4 pb-4 text-[11px] text-muted-foreground">
                      Ran across the whole database and found nothing.
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Balance is never rewritten from a button: a correction is only safe when the ledger rows
            that produced it are trustworthy, and this database has held rows whose sign contradicted
            their type. Those are listed above so they can be fixed at the source.
          </p>
        </>
      )}
    </motion.div>
  );
}
