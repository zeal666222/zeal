"use client";

import { useState, useEffect } from "react";
import { getWalletBalance, topUpWalletAction } from "@/actions/wallet";
import { IndianRupee, CreditCard, ShieldCheck, Sparkles, Loader2, ArrowUpRight } from "lucide-react";

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>("500");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadBalance() {
      const res = await getWalletBalance();
      setBalance(res.balance);
      setLoading(false);
    }
    loadBalance();
  }, []);

  const handleTopUp = async (amountToAdd: number) => {
    setProcessing(true);
    setMessage(null);

    const res = await topUpWalletAction(amountToAdd);
    if (res.success && res.newBalance !== undefined) {
      setBalance(res.newBalance);
      setMessage(`Successfully added ₹${amountToAdd} to your vault.`);
    } else {
      setMessage(res.error || "Transaction error occurred.");
    }
    setProcessing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
              <ShieldCheck size={14} /> Secure Vault
            </div>
            <h1 className="text-3xl font-black text-white">Zeal Credits & Wallet</h1>
          </div>
        </div>

        {/* Balance Card */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 border border-emerald-500/30 mb-8 relative z-10 shadow-xl">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Available Balance</p>
          <div className="flex items-center gap-2">
            <IndianRupee size={36} className="text-emerald-400" />
            <span className="text-4xl sm:text-5xl font-black text-white">
              {loading ? <Loader2 className="animate-spin inline text-emerald-400" size={36} /> : Number(balance).toFixed(2)}
            </span>
          </div>
        </div>

        {message && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold text-center animate-in fade-in">
            {message}
          </div>
        )}

        {/* Quick Top-Up Options */}
        <div className="space-y-6 relative z-10">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Select Top-Up Package</h3>
          
          <div className="grid grid-cols-3 gap-4">
            {[100, 500, 1000].map((amt) => (
              <button
                key={amt}
                disabled={processing}
                onClick={() => handleTopUp(amt)}
                className="btn-3d p-4 rounded-2xl bg-slate-950 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/40 text-center transition-all active:scale-95 group"
              >
                <span className="block text-lg font-black text-white group-hover:text-emerald-400">₹{amt}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Instant Add</span>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-white/10">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Custom Amount (₹)</label>
            <div className="flex gap-3">
              <input 
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-emerald-500"
              />
              <button
                disabled={processing}
                onClick={() => handleTopUp(Number(customAmount))}
                className="btn-3d px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <>Add Funds <ArrowUpRight size={16} /></>}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
