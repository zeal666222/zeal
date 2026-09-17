"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { Wallet, Home, ArrowRight } from "lucide-react";

export default function ConsultantEarningsPage() {
  const [balance, setBalance] = useState(1450.00);
  const daily = [
    { day: "Mon", amount: 200 },
    { day: "Tue", amount: 350 },
    { day: "Wed", amount: 450 }
  ];
  const max = Math.max(...daily.map((d: any) => d.amount), 1);

  const handleWithdraw = () => {
    alert("Withdrawal request submitted successfully.");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => window.location.href = "/consultant/dashboard"} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-400 mb-8">
          <Home size={16} /> Back to Dashboard
        </button>

        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Earnings & Payouts</h1>
              <p className="text-slate-400 text-sm mt-1">Manage your professional practice revenue.</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-400 font-bold">Available</p>
              <p className="text-3xl font-bold text-emerald-400">${balance.toFixed(2)}</p>
            </div>
          </div>

          <div className="mb-8 p-6 bg-slate-950/50 rounded-2xl border border-white/5">
            <h4 className="font-bold mb-4">Weekly Revenue Trend</h4>
            <div className="flex items-end gap-4 h-32 pt-6">
              {daily.map((d: any) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <div style={{ height: `${(d.amount / max) * 100}%` }} className="w-full bg-purple-600 rounded-t-lg" />
                  <span className="text-xs text-slate-400">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleWithdraw} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all shadow-xl">
            Request Payout
          </button>
        </div>
      </div>
    </div>
  );
}
