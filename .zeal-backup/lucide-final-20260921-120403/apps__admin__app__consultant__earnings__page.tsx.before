"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant Earnings — realtime balance, ledger, withdrawal modal
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, IndianRupee, ArrowUpRight, ArrowDownRight, Loader2, TrendingUp, X, Check,
} from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { ConfirmDialog } from "@zeal/ui";

interface Tx {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

export default function ConsultantEarningsPage() {
  const [balance, setBalance] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [pendingOut, setPendingOut] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [upiId, setUpiId] = useState("");
  const [withdrawErr, setWithdrawErr] = useState<string | null>(null);
  const [withdrawOk, setWithdrawOk] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/consultant/earnings", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as {
        balance?: number;
        escrow?: number;
        pendingOut?: number;
        transactions?: Tx[];
      };
      setBalance(d.balance ?? 0);
      setEscrow(d.escrow ?? 0);
      setPendingOut(d.pendingOut ?? 0);
      setTxs(d.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/users/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, [load]);

  // Realtime wallet
  useChannel<BroadcastChange<{ balance?: number }>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: useCallback((p) => {
      const b = p?.record?.balance;
      if (typeof b === "number") setBalance(b);
    }, []),
  });

  useChannel<BroadcastChange<unknown>>({
    channel: userId ? channels.userWalletLedger(userId) : null,
    event: "*",
    onMessage: useCallback(() => { void load(); }, [load]),
  });

  const stats = useMemo(() => {
    const earned = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const paid = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const last7 = txs
      .filter((t) => t.amount > 0 && new Date(t.createdAt) > new Date(Date.now() - 7 * 864e5))
      .reduce((s, t) => s + t.amount, 0);
    return { earned, paid, last7 };
  }, [txs]);

  const submitWithdraw = async () => {
    setWithdrawErr(null);
    if (amount < 100) { setWithdrawErr("Minimum ₹100"); throw new Error("min"); }
    if (amount > balance) { setWithdrawErr("Insufficient balance"); throw new Error("bal"); }
    if (!upiId || upiId.length < 3) { setWithdrawErr("Valid UPI ID required"); throw new Error("upi"); }
    const res = await fetch("/api/consultant/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, upiId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: string }).error || "Withdrawal failed";
      setWithdrawErr(msg);
      throw new Error(msg);
    }
    setWithdrawOk(true);
    await load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-[var(--color-foreground)]">Earnings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Real-time wallet and payout history</p>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden p-6 lg:p-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-[var(--color-surface)] to-[var(--color-surface)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Available Balance</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-foreground)]">
            <IndianRupee className="w-8 h-8 text-emerald-500" />
            <span className="text-3xl lg:text-5xl font-black font-mono tracking-tight">
              {Number(balance).toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setWithdrawOpen(true)}
            disabled={balance < 100}
            className="mt-4 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold text-[var(--color-foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Withdraw Funds
          </button>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-[var(--color-border)]">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Lifetime earned</p>
              <p className="text-sm font-black font-mono text-emerald-500 mt-1">₹{stats.earned.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Last 7 days</p>
              <p className="text-sm font-black font-mono text-[var(--color-primary)] mt-1 flex items-center gap-1">
                <TrendingUp size={11} /> ₹{stats.last7.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Withdrawn</p>
              <p className="text-sm font-black font-mono text-[var(--color-foreground)] mt-1">₹{stats.paid.toFixed(0)}</p>
            </div>
          </div>

          {(escrow > 0 || pendingOut > 0) && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex gap-6 text-xs">
              {escrow > 0 && (
                <span className="text-amber-500">
                  In escrow: <strong className="font-mono">₹{escrow.toFixed(2)}</strong>
                </span>
              )}
              {pendingOut > 0 && (
                <span className="text-[var(--color-muted-foreground)]">
                  Pending withdrawal: <strong className="font-mono">₹{pendingOut.toFixed(2)}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:p-6">
        <h2 className="text-base lg:text-lg font-bold text-[var(--color-foreground)] mb-4">Recent Transactions</h2>

        {txs.length === 0 ? (
          <p className="text-[var(--color-muted-foreground)] text-sm text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {txs.slice(0, 30).map((tx) => {
              const credit = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-overlay)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={"w-9 h-9 rounded-full flex items-center justify-center shrink-0 " + (
                      credit ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                    )}>
                      {credit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--color-foreground)] truncate">{tx.description}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={"text-sm font-bold font-mono shrink-0 " + (credit ? "text-emerald-500" : "text-[var(--color-foreground)]")}>
                    {credit ? "+" : "-"}₹{Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Withdrawal modal */}
      {withdrawOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => { setWithdrawOpen(false); setWithdrawOk(false); setWithdrawErr(null); }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-2xl"
          >
            {withdrawOk ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-black text-[var(--color-foreground)]">Withdrawal Requested</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-2">
                  Awaiting admin approval. Usually processed within 24 hours.
                </p>
                <button
                  onClick={() => { setWithdrawOpen(false); setWithdrawOk(false); }}
                  className="mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] font-bold text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-black text-[var(--color-foreground)]">Withdraw Funds</h3>
                  <button
                    onClick={() => setWithdrawOpen(false)}
                    className="p-2 rounded-lg hover:bg-[var(--color-surface-raised)]"
                  >
                    <X size={16} className="text-[var(--color-muted-foreground)]" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] mb-5">
                  <p className="text-[10px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest">Available</p>
                  <p className="text-2xl font-black text-emerald-500 font-mono mt-1 flex items-center">
                    <IndianRupee size={20} /> {balance.toFixed(2)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-2">
                      Amount (₹)
                    </label>
                    <input
                      type="number" min={100} max={balance} value={amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl text-[var(--color-foreground)] font-mono outline-none focus:border-[var(--color-primary)]"
                    />
                    <div className="flex gap-2 mt-2">
                      {[500, 1000, Math.floor(balance)].map((amt) =>
                        amt >= 100 && amt <= balance ? (
                          <button
                            key={amt}
                            onClick={() => setAmount(amt)}
                            className="px-3 py-1 rounded-lg bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-overlay)] text-xs font-bold text-[var(--color-foreground)]"
                          >
                            ₹{amt}
                          </button>
                        ) : null,
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-2">
                      UPI ID
                    </label>
                    <input
                      type="text" value={upiId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                      className="w-full px-4 py-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>

                  {withdrawErr && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold">
                      {withdrawErr}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <ConfirmDialog
                    open={false}
                    onOpenChange={() => {}}
                    title=""
                    onConfirm={() => {}}
                  />
                  <button
                    onClick={async () => {
                      try { await submitWithdraw(); } catch { /* handled */ }
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm hover:opacity-90"
                  >
                    Request Withdrawal
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
