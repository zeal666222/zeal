"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {Wallet, IndianRupee, ArrowUpRight, ArrowDownRight, Loader2, TrendingUp} from "lucide-react";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";

interface Tx {
  id: string; type: string; amount: number; balance: number;
  description: string; createdAt: string;
}

export default function ConsultantEarningsPage() {
  const [balance, setBalance] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [pendingOut, setPendingOut] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [earnRes, meRes] = await Promise.all([
        fetch("/api/consultant/earnings", { cache: "no-store" }),
        fetch("/api/users/me/profile", { cache: "no-store" }),
      ]);
      if (earnRes.ok) {
        const d = await earnRes.json();
        setBalance(d.balance ?? 0);
        setEscrow(d.escrow ?? 0);
        setPendingOut(d.pendingOut ?? 0);
        setTxs(d.transactions ?? []);
      }
      if (meRes.ok) {
        const me = await meRes.json();
        if (me?.user?.id) setUserId(me.user.id);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useChannel<BroadcastChange<{ balance?: number }>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: () => { void load(); },
  });

  useChannel<BroadcastChange<Tx>>({
    channel: userId ? channels.userWalletLedger(userId) : null,
    event: "*",
    onMessage: (payload) => {
      if (payload?.type !== "INSERT") return;
      const tx = payload.record;
      if (!tx?.id) return;
      setTxs((prev) => (prev.some((t) => t.id === tx.id) ? prev : [tx, ...prev].slice(0, 60)));
    },
  });

  const stats = useMemo(() => {
    const earned = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const paid = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const last7 = txs
      .filter((t) => t.amount > 0 && new Date(t.createdAt) > new Date(Date.now() - 7 * 864e5))
      .reduce((s, t) => s + t.amount, 0);
    return { earned, paid, last7 };
  }, [txs]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Earnings</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time wallet and payout history</p>
      </div>

      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Available Balance</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <IndianRupee className="w-8 h-8 text-emerald-400" />
            <span className="text-3xl lg:text-5xl font-black font-mono tracking-tight">{Number(balance).toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Lifetime earned</p>
              <p className="text-sm font-black font-mono text-emerald-400 mt-1">₹{stats.earned.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Last 7 days</p>
              <p className="text-sm font-black font-mono text-purple-400 mt-1 flex items-center gap-1">
                <TrendingUp size={11} /> ₹{stats.last7.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Withdrawn</p>
              <p className="text-sm font-black font-mono text-slate-300 mt-1">₹{stats.paid.toFixed(0)}</p>
            </div>
          </div>
          {(escrow > 0 || pendingOut > 0) && (
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-6 text-xs">
              {escrow > 0 && <span className="text-amber-400">In escrow: <strong className="font-mono">₹{escrow.toFixed(2)}</strong></span>}
              {pendingOut > 0 && <span className="text-slate-400">Pending withdrawal: <strong className="font-mono">₹{pendingOut.toFixed(2)}</strong></span>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5 lg:p-6">
        <h2 className="text-base lg:text-lg font-bold text-white mb-4">Recent Transactions</h2>
        {txs.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {txs.slice(0, 30).map((tx) => {
              const credit = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${credit ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                      {credit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{tx.description}</p>
                      <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold font-mono flex-shrink-0 ${credit ? "text-emerald-400" : "text-slate-300"}`}>
                    {credit ? "+" : "-"}₹{Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
