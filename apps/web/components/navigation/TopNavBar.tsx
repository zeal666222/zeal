"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, Moon, Bell, IndianRupee } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

export function TopNavBar({ userId, initialBalance }: { userId: string | null; initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);
  const [isDark, setIsDark] = useState(true);

  // Real-time Wallet Sync
  useEffect(() => {
    if (!userId) return;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel('wallet_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, 
        (payload) => {
          if (payload.new && payload.new.wallet_balance !== undefined) {
            setBalance(payload.new.wallet_balance);
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-slate-950/80 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-4 sm:px-8">
      
      {/* LEFT: 3D Theme Toggle */}
      <div className="flex-1">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="btn-3d w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center text-slate-300 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/5 rounded-full" />
          {isDark ? <Moon size={20} className="drop-shadow-lg" /> : <Sun size={20} className="drop-shadow-lg text-amber-400" />}
        </button>
      </div>

      {/* CENTER: Premium 3D Logo */}
      <div className="flex-1 flex justify-center">
        <Link href="/" className="relative flex items-center justify-center group no-tap-highlight">
          <div className="absolute w-16 h-16 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/40 transition-all duration-500" />
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-200 to-purple-600 text-3d relative z-10">
            Zeal
          </h1>
        </Link>
      </div>

      {/* RIGHT: Real-Time Wallet & 3D Bell */}
      <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4">
        {userId && (
          <Link href="/wallet" className="btn-3d flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-500/50 text-white relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <IndianRupee size={16} className="drop-shadow-md" />
            <span className="font-black text-sm tracking-wide drop-shadow-md">{Number(balance).toFixed(2)}</span>
          </Link>
        )}
        
        <button className="btn-3d w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center text-slate-300 relative">
          <Bell size={20} className="drop-shadow-lg" />
          {/* Notification Dot */}
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
        </button>
      </div>
    </header>
  );
}
