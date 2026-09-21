"use client";
import {motion} from "framer-motion";
import { ArrowDownRight, ArrowUpRight, IndianRupee, Loader2, Wallet } from "lucide-react";
import {useWalletLedger} from "@/hooks/useWalletLedger";

export function WalletLedgerPanel({ userId }: { userId: string }) {
  const { entries, wallet, loading } = useWalletLedger(userId);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Available Balance</span>
        </div>
        <div className="flex items-center gap-2 text-white">
          <IndianRupee className="w-7 h-7 text-emerald-400" />
          <span className="text-3xl lg:text-4xl font-black font-mono">{Number(wallet.balance).toFixed(2)}</span>
        </div>
        {(wallet.escrow > 0 || wallet.pendingOut > 0) && (
          <div className="mt-4 pt-4 border-t border-white/5 flex gap-6 text-xs">
            {wallet.escrow > 0 && <span className="text-amber-400">In escrow: <strong className="font-mono">₹{wallet.escrow.toFixed(2)}</strong></span>}
            {wallet.pendingOut > 0 && <span className="text-slate-400">Pending: <strong className="font-mono">₹{wallet.pendingOut.toFixed(2)}</strong></span>}
          </div>
        )}
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5">
        <h3 className="text-sm font-black text-white mb-4">Recent Transactions</h3>
        {entries.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 15).map((tx, idx) => {
              const credit = tx.amount > 0;
              return (
                <motion.div key={tx.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${credit ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                      {credit ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{tx.description}</p>
                      <p className="text-[10px] text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold font-mono shrink-0 ${credit ? "text-emerald-400" : "text-slate-300"}`}>
                    {credit ? "+" : "-"}₹{Math.abs(tx.amount).toFixed(2)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
