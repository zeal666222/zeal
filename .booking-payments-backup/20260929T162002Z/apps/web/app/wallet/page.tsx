"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// apps/web/app/wallet/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium wallet surface: balance, ledger, Razorpay top-up, auto-reload.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, IndianRupee, Info,
  Loader2, Plus, RefreshCw, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import { useWallet, loadRazorpayScript, type LedgerEntry } from "@/hooks/useWallet";
import { toast } from "@/components/ui/toaster";

const PRESETS = [100, 500, 1000, 2000] as const;

function formatINR(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function WalletPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("500");
  const [processing, setProcessing] = useState(false);
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);

  const idemRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/users/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { id: string } } | null) => {
        if (d?.user?.id) setUserId(d.user.id);
      })
      .catch(() => {});
    void loadRazorpayScript();
  }, []);

  const {
    wallet, transactions, loading, error, refresh, topUp, openCheckout,
  } = useWallet(userId);

  const handleTopUp = useCallback(
    async (amount: number) => {
      if (!Number.isFinite(amount) || amount < 10 || amount > 100_000) {
        toast({ title: "Amount must be between ₹10 and ₹1,00,000", variant: "destructive" });
        return;
      }
      setProcessing(true);
      try {
        if (!idemRef.current) idemRef.current = crypto.randomUUID();
        const order = await topUp(amount, idemRef.current);
        const result = await openCheckout(order, `Wallet top-up ₹${formatINR(amount)}`);
        if (result?.verified) {
          toast({
            title: `Added ₹${formatINR(amount)} to your wallet`,
            variant: "success",
          });
          await refresh();
        } else {
          toast({ title: "Payment cancelled", variant: "default" });
        }
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Top-up failed",
          variant: "destructive",
        });
      } finally {
        idemRef.current = null;
        setProcessing(false);
      }
    },
    [topUp, openCheckout, refresh],
  );

  const stats = useMemo(() => {
    const credits = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const debits = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { credits, debits };
  }, [transactions]);

  if (loading) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
          <p className="text-xs text-muted-foreground font-medium">Loading your vault…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-app bg-background text-foreground px-4 py-8 pb-24">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ─── Header ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                            bg-emerald-500/10 border border-emerald-500/20
                            text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">
              <ShieldCheck size={11} /> Secure Vault
            </div>
            <h1 className="text-3xl font-black tracking-tight">Wallet</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Top up, spend, and track every rupee.
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="p-2.5 rounded-xl bg-surface border border-border hover:border-[var(--color-primary)]/40 transition-all active:scale-95"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
        </motion.div>

        {/* ─── Balance card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl
                     bg-gradient-to-br from-emerald-950/60 via-surface to-surface
                     border border-emerald-500/30 p-6 md:p-8 shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">
              Available Balance
            </p>
            <div className="flex items-center gap-2">
              <IndianRupee size={32} className="text-emerald-400" />
              <span className="text-4xl md:text-5xl font-black font-mono tracking-tight">
                {formatINR(wallet.balance)}
              </span>
            </div>

            {(wallet.escrow > 0 || wallet.pendingOut > 0 || wallet.pendingIn > 0) && (
              <div className="mt-5 pt-5 border-t border-white/5 grid grid-cols-3 gap-3">
                {wallet.escrow > 0 && (
                  <MiniStat label="In escrow" value={`₹${formatINR(wallet.escrow)}`} tone="amber" />
                )}
                {wallet.pendingIn > 0 && (
                  <MiniStat label="Pending in" value={`₹${formatINR(wallet.pendingIn)}`} tone="sky" />
                )}
                {wallet.pendingOut > 0 && (
                  <MiniStat label="Pending out" value={`₹${formatINR(wallet.pendingOut)}`} tone="rose" />
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── Top-up ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-border bg-surface p-5 md:p-6 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--color-primary)]" />
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Quick Top-Up
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRESETS.map((amt) => (
              <button
                key={amt}
                onClick={() => void handleTopUp(amt)}
                disabled={processing}
                className="group relative p-4 rounded-2xl
                           bg-surface-raised hover:bg-[var(--color-primary)]/10
                           border border-border hover:border-[var(--color-primary)]/50
                           transition-all active:scale-[0.97]
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block text-lg font-black font-mono text-foreground
                                 group-hover:text-[var(--color-primary)] transition-colors">
                  ₹{amt}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  Instant
                </span>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              Custom Amount
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IndianRupee size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  value={customAmount}
                  min={10}
                  max={100000}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCustomAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl
                             bg-background border border-border
                             text-sm font-mono text-foreground
                             outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <button
                onClick={() => void handleTopUp(Number(customAmount))}
                disabled={processing || !customAmount}
                className="px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600
                           text-white font-black text-sm shadow-lg shadow-emerald-600/20
                           hover:opacity-95 active:scale-[0.97] transition-all
                           disabled:opacity-40 flex items-center gap-2"
              >
                {processing ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
              {error}
            </div>
          )}
        </motion.div>

        {/* ─── Auto-reload ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl border border-border bg-surface p-5 md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                Auto-Reload
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Automatically add ₹500 when your balance drops below ₹100.
              </p>
            </div>
            <button
              onClick={() => setAutoReloadEnabled((v) => !v)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                autoReloadEnabled ? "bg-emerald-500" : "bg-surface-raised border border-border"
              }`}
              aria-label="Toggle auto-reload"
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md ${
                  autoReloadEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {autoReloadEnabled && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20
                            text-amber-400 text-[11px] font-bold flex items-center gap-2">
              <Info size={11} />
              Auto-reload uses a Razorpay mandate. You&apos;ll authorize once; charges are automatic.
            </div>
          )}
        </motion.div>

        {/* ─── Ledger ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl border border-border bg-surface p-5 md:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet size={14} /> Recent Activity
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
              <span className="text-emerald-400">↑ ₹{formatINR(stats.credits)}</span>
              <span className="text-rose-400">↓ ₹{formatINR(stats.debits)}</span>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet size={32} className="text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Top up to get started
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {transactions.slice(0, 20).map((tx, idx) => (
                  <LedgerRow key={tx.id} tx={tx} index={idx} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "amber" | "sky" | "rose" }) {
  const colors = {
    amber: "text-amber-400",
    sky: "text-sky-400",
    rose: "text-rose-400",
  } as const;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
      <p className={`text-sm font-black font-mono mt-0.5 ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function LedgerRow({ tx, index }: { tx: LedgerEntry; index: number }) {
  const credit = tx.amount > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="flex items-center justify-between gap-3 p-3 rounded-xl
                 bg-surface-raised hover:bg-surface-overlay transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          credit ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
        }`}>
          {credit ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate">
            {tx.description || (credit ? "Credit" : "Debit")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {relativeTime(tx.createdAt)}
          </p>
        </div>
      </div>
      <span className={`text-sm font-black font-mono shrink-0 ${
        credit ? "text-emerald-400" : "text-foreground"
      }`}>
        {credit ? "+" : "−"}₹{formatINR(Math.abs(tx.amount))}
      </span>
    </motion.div>
  );
}
