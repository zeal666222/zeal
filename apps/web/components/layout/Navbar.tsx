"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Bell, IndianRupee, Sparkles } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

export function Navbar() {
  const [darkMode, setDarkMode] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(1250.00);
  const [unreadNotifications, setUnreadNotifications] = useState(2);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zyrunsnweznyrhuroduo.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5cnVuc253ZXpueXJodXJvZHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTc2MDgsImV4cCI6MjEwMzA3MzYwOH0.kOPtlaJvT0fnGYit6dG43rekXDin3HoinUNrFB8vtL0";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // Sync theme state
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark") || true;
    setDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 transition-colors duration-500">
      <div className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* CORNER 1: Theme Change Toggle */}
        <div className="flex items-center">
          <button 
            onClick={toggleTheme}
            className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-yellow-400 hover:scale-105 transition-all cursor-pointer shadow-sm"
            title="Toggle Theme"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* CENTER: High-End Relaxing & Animated ZEAL Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-pointer" onClick={() => window.location.href = "/"}>
          <div className="relative flex items-center gap-2 group">
            {/* Ambient breathing aura */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 blur-xl opacity-40 group-hover:opacity-75 transition-opacity animate-pulse rounded-full" />
            
            {/* Animated relaxing symbol */}
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-lg animate-[spin_12s_linear_infinite]">
              <Sparkles size={20} className="animate-pulse" />
            </div>

            {/* Typography with relaxing tracking */}
            <span className="relative text-2xl font-black tracking-[0.2em] bg-gradient-to-r from-slate-900 via-purple-900 to-slate-800 dark:from-white dark:via-purple-200 dark:to-slate-300 bg-clip-text text-transparent">
              ZEAL
            </span>
          </div>
        </div>

        {/* CORNER 2: Notification Bell & Realtime Wallet Button */}
        <div className="flex items-center gap-3">
          
          {/* Notification Bell */}
          <button 
            onClick={() => alert("No new system notifications.")}
            className="relative w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:scale-105 transition-all cursor-pointer shadow-sm"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadNotifications > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
            {unreadNotifications > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Real-time Wallet Button (INR ₹) */}
          <button 
            onClick={() => window.location.href = "/wallet"}
            className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-sm transition-all cursor-pointer shadow-sm group"
            title="Manage Wallet Balance"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
              <IndianRupee size={13} />
            </div>
            <span className="font-mono tracking-tight">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </button>

        </div>

      </div>
    </header>
  );
}
