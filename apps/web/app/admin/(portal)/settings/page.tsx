"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Settings hub — platform defaults (live, editable) + entry points to the
// two functional sub-consoles (Admins, API Keys).
//
// Both fields write to public."AdminSetting" and are read back by the code that
// moves money, so a saved value is a real value:
//   fee            → stamped on bookings created from now on
//   min withdrawal → enforced on every payout request
// Anything decided inside a database RPC (the 20% AI-session cut) is shown as
// read-only below rather than offered as a knob it isn't.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Globe,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";
import { channels, useChannel, type BroadcastChange } from "@zeal/realtime";
import { toast } from "@/components/ui/toaster";

interface PlatformSettings {
  platformFeePercent: number;
  minimumWithdrawalRupees: number;
}

const RANGES = {
  platformFeePercent: { min: 0, max: 50, step: 0.5, suffix: "%" },
  minimumWithdrawalRupees: { min: 50, max: 100000, step: 50, suffix: " ₹" },
} as const;

function Field({
  label,
  hint,
  field,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  field: keyof PlatformSettings;
  value: string;
  onChange: (v: string) => void;
}) {
  const range = RANGES[field];
  return (
    <label className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition focus-within:border-[var(--color-primary)]/50">
      <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span>
      <div className="mt-1.5 flex items-baseline gap-1">
        {field === "minimumWithdrawalRupees" && (
          <span className="text-lg font-semibold text-white/70">₹</span>
        )}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={range.min}
          max={range.max}
          step={range.step}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 bg-transparent text-lg font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        {field === "platformFeePercent" && (
          <span className="text-lg font-semibold text-white/70">%</span>
        )}
      </div>
      <span className="mt-1 block text-[11px] leading-snug text-white/35">{hint}</span>
    </label>
  );
}

function validate(field: keyof PlatformSettings, raw: string): number | string {
  const num = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(num)) return `${field} must be a number`;
  const range = RANGES[field];
  if (num < range.min || num > range.max) {
    const label = field === "platformFeePercent" ? "Platform fee" : "Minimum withdrawal";
    return `${label} must be between ${range.min} and ${range.max}`;
  }
  return num;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<keyof PlatformSettings, string>>({
    platformFeePercent: "",
    minimumWithdrawalRupees: "",
  });

  const { data, isLoading, isError, refetch } = useQuery<PlatformSettings>({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  // Seed the inputs from the server. Only while untouched, so a background
  // refetch cannot overwrite a half-typed value.
  useEffect(() => {
    if (!data) return;
    setForm((prev) => {
      const dirty =
        prev.platformFeePercent !== "" || prev.minimumWithdrawalRupees !== "";
      if (dirty) return prev;
      return {
        platformFeePercent: String(data.platformFeePercent),
        minimumWithdrawalRupees: String(data.minimumWithdrawalRupees),
      };
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async (patch: Partial<PlatformSettings>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error || "Save failed");
      }
      return res.json() as Promise<PlatformSettings>;
    },
    onSuccess: (next) => {
      qc.setQueryData(["admin", "settings"], next);
      setForm({
        platformFeePercent: String(next.platformFeePercent),
        minimumWithdrawalRupees: String(next.minimumWithdrawalRupees),
      });
      toast({ title: "Settings saved", variant: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save settings", description: err.message, variant: "destructive" });
    },
  });

  // Another console saved a value — show it without a refresh.
  useChannel<BroadcastChange>({
    channel: channels.adminSettings(),
    event: "settings:updated",
    onMessage: () => void refetch(),
  });

  const pending = useMemo(() => {
    if (!data) return {} as Partial<PlatformSettings>;
    const patch: Partial<PlatformSettings> = {};
    const fee = validate("platformFeePercent", form.platformFeePercent);
    const min = validate("minimumWithdrawalRupees", form.minimumWithdrawalRupees);
    if (typeof fee === "number" && fee !== data.platformFeePercent) {
      patch.platformFeePercent = fee;
    }
    if (typeof min === "number" && min !== data.minimumWithdrawalRupees) {
      patch.minimumWithdrawalRupees = min;
    }
    return patch;
  }, [data, form]);

  const hasTypeError =
    typeof validate("platformFeePercent", form.platformFeePercent) === "string" ||
    typeof validate("minimumWithdrawalRupees", form.minimumWithdrawalRupees) === "string";

  const dirty = Object.keys(pending).length > 0;
  const cards = [
    {
      href: "/admin/settings/admins",
      icon: ShieldCheck,
      title: "Administrators",
      desc: "Invite, promote and revoke staff accounts across every role.",
    },
    {
      href: "/admin/settings/api-keys",
      icon: KeyRound,
      title: "API Keys",
      desc: "Issue and rotate machine-to-machine keys for integrations.",
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/50">
          Platform configuration and access management.
        </p>
      </header>

      {/* Platform defaults */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-white">Platform defaults</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="space-y-3">
            <p className="text-sm text-rose-400">Could not load platform settings.</p>
            <button
              onClick={() => void refetch()}
              className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Platform fee"
                hint="Cut kept from every new booking. Bookings already created keep the rate they were made at."
                field="platformFeePercent"
                value={form.platformFeePercent}
                onChange={(v) => setForm((f) => ({ ...f, platformFeePercent: v }))}
              />
              <Field
                label="Minimum withdrawal"
                hint="Smallest payout a consultant can request. Applied on every withdrawal attempt."
                field="minimumWithdrawalRupees"
                value={form.minimumWithdrawalRupees}
                onChange={(v) => setForm((f) => ({ ...f, minimumWithdrawalRupees: v }))}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => save.mutate(pending)}
                disabled={!dirty || hasTypeError || save.isPending}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </button>
              {hasTypeError && (
                <span className="text-xs text-rose-400">
                  Fix the highlighted values first.
                </span>
              )}
              {!hasTypeError && dirty && (
                <span className="text-xs text-amber-400">
                  Unsaved: {Object.entries(pending).map(([k, v]) => `${k} → ${v}`).join(", ")}
                </span>
              )}
              {!dirty && !hasTypeError && (
                <span className="text-xs text-white/35">Everything matches the server.</span>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
              <p className="text-[11px] leading-snug text-white/40">
                <Info className="mr-1 inline h-3 w-3" />
                The 20% platform cut on AI chat sessions is not editable here — it is
                applied inside the billing RPC that moves the money, so changing the
                report without the ledger would silently break reconciliation.
              </p>
            </div>
          </>
        )}
      </section>

      {/* Entry points */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.href}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={c.href}
              className="group flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 rounded-2xl bg-[var(--color-primary)]/15 p-2.5 text-[var(--color-primary)]">
                <c.icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{c.title}</h3>
                <p className="mt-1 text-sm text-white/50">{c.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
