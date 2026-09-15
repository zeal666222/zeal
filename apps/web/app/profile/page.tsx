"use client";
export const dynamic = "force-dynamic";

import { User, LogOut, ArrowRight, IndianRupee, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ProfilePage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Identity & Wallet</h1>

        {/* INR Wallet Card */}
        <div className="bg-gradient-to-tr from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-8 rounded-[2rem] shadow-xl text-white mb-6 flex justify-between items-center">
          <div>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-1 flex items-center gap-1"><ShieldCheck size={14}/> Secure Balance</p>
            <h2 className="text-5xl font-black flex items-center">
              <IndianRupee size={40} className="mr-1 opacity-80" /> 1,250.00
            </h2>
          </div>
          <Link href="/wallet" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-slate-900 transition-colors shadow-lg">
            Recharge
          </Link>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/60 p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-white/5 space-y-4">
          <Link href="/bookings" className="w-full flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl hover:border-purple-500/50 border border-slate-200 dark:border-white/5 transition-colors group">
            <span className="font-bold">Consultation History</span>
            <ArrowRight className="text-slate-400 group-hover:text-purple-500" size={20} />
          </Link>
          
          <button onClick={handleLogout} className="w-full flex items-center justify-between p-5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors border border-rose-200 dark:border-rose-500/20">
            <span className="font-bold flex items-center gap-2"><LogOut size={20}/> Disconnect Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
