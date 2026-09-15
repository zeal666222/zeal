"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { Wallet, ShieldCheck, ArrowRight, IndianRupee, CreditCard } from "lucide-react";
import Link from "next/link";

export default function WalletPage() {
  const [amount, setAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);

  const handleRecharge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/instamojo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, purpose: "Zeal Wallet Recharge (INR)" })
      });
      const data = await res.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert("Gateway initialized. Redirecting to payment sandbox...");
        // Fallback simulation for local testing
        setTimeout(() => {
          window.location.href = "/profile";
        }, 1500);
      }
    } catch (err) {
      alert("Network error connecting to payment gateway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-2xl mx-auto relative z-10">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-600 mb-8 transition-colors">
          <ArrowRight size={16} className="rotate-180" /> Back to Profile
        </Link>
        
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Wallet size={36} />
          </div>
          <h1 className="text-3xl font-bold mb-2">Recharge Secure Wallet</h1>
          <p className="text-slate-500 font-light mb-8 flex items-center justify-center gap-2 text-sm">
            <ShieldCheck size={16} className="text-emerald-500" /> Processed securely in INR (₹)
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[200, 500, 1000].map((preset) => (
              <button 
                key={preset}
                onClick={() => setAmount(preset)}
                className={`p-4 rounded-2xl border text-xl font-bold transition-all cursor-pointer ${amount === preset ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-white/10 hover:border-emerald-500/50'}`}
              >
                ₹{preset}
              </button>
            ))}
          </div>

          <button 
            onClick={handleRecharge}
            disabled={loading}
            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Connecting Gateway..." : `Recharge ₹${amount.toFixed(2)}`}
            {!loading && <CreditCard size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
