#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — 3D FIXED NAVIGATION & MORPHING ANIMATIONS
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"

echo -e "${INFO} 1. Injecting 3D Button & Morphing Keyframes into globals.css..."
cat << 'EOF' > apps/web/app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #020617;
  --foreground: #f8fafc;
}

body {
  color: var(--foreground);
  background: var(--background);
  overscroll-behavior-y: none;
  -webkit-font-smoothing: antialiased;
}

@layer utilities {
  .no-tap-highlight { -webkit-tap-highlight-color: transparent; }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .h-screen-app { height: 100vh; height: 100dvh; }

  /* 3D Premium Button Styles */
  .btn-3d {
    box-shadow: inset 0 2px 4px rgba(255,255,255,0.2), 0 4px 10px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4);
    transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .btn-3d:active {
    transform: translateY(3px) scale(0.96);
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4);
  }

  /* Deep 3D Text for Zeal Logo */
  .text-3d {
    text-shadow: 0 1px 0 #4c1d95, 0 2px 0 #4c1d95, 0 3px 0 #3b0764, 0 4px 0 #3b0764, 0 5px 10px rgba(0,0,0,0.8);
  }
}

/* ==========================================================================
   THE 9-SECOND MORPHING "Z" ANIMATION (Lines -> Z -> Triangle -> Z -> Lines)
   ========================================================================== */
.morph-line {
  position: absolute;
  height: 3px;
  background-color: white;
  border-radius: 4px;
  transition: all 0.3s ease;
  transform-origin: center;
}

.morph-container {
  animation: z-pulse 9s infinite ease-in-out;
}
.morph-container:active .morph-line {
  /* Speed up animation on click if desired, or reset */
  background-color: #a78bfa; 
}

@keyframes z-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes line-top {
  0%, 100% { transform: translateY(-8px) rotate(0deg); width: 24px; }
  25%      { transform: translateY(-10px) rotate(0deg); width: 28px; } /* Z Top */
  50%      { transform: translate(5px, -6px) rotate(60deg); width: 28px; } /* Triangle Right */
  75%      { transform: translateY(-10px) rotate(0deg); width: 28px; } /* Z Top */
}

@keyframes line-mid {
  0%, 100% { transform: translateY(0) rotate(0deg); width: 24px; opacity: 1; }
  25%      { transform: translateY(0) rotate(-45deg); width: 34px; opacity: 1; } /* Z Diagonal */
  50%      { transform: translate(-5px, -6px) rotate(-60deg); width: 28px; opacity: 1; } /* Triangle Left */
  75%      { transform: translateY(0) rotate(-45deg); width: 34px; opacity: 1; } /* Z Diagonal */
}

@keyframes line-bot {
  0%, 100% { transform: translateY(8px) rotate(0deg); width: 24px; }
  25%      { transform: translateY(10px) rotate(0deg); width: 28px; } /* Z Bottom */
  50%      { transform: translateY(8px) rotate(0deg); width: 28px; } /* Triangle Bottom */
  75%      { transform: translateY(10px) rotate(0deg); width: 28px; } /* Z Bottom */
}

.morph-line-1 { animation: line-top 9s infinite cubic-bezier(0.68, -0.55, 0.265, 1.55); }
.morph-line-2 { animation: line-mid 9s infinite cubic-bezier(0.68, -0.55, 0.265, 1.55); }
.morph-line-3 { animation: line-bot 9s infinite cubic-bezier(0.68, -0.55, 0.265, 1.55); }
EOF

echo -e "${INFO} 2. Building Top Nav Bar with Real-Time Wallet (apps/web/components/navigation/TopNavBar.tsx)..."
cat << 'EOF' > apps/web/components/navigation/TopNavBar.tsx
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
EOF

echo -e "${INFO} 3. Building Bottom Nav Bar with 3D Center Button (apps/web/components/navigation/BottomNavBar.tsx)..."
cat << 'EOF' > apps/web/components/navigation/BottomNavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageCircle, User } from "lucide-react";

export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-24 bg-slate-950/90 backdrop-blur-3xl border-t border-white/5 flex items-center justify-between px-6 sm:px-12 pb-4 pt-2">
      
      <NavIcon href="/" icon={Home} label="Home" currentPath={pathname} />
      <NavIcon href="/explore" icon={Compass} label="Explore" currentPath={pathname} />

      {/* CENTER: 9-Second Morphing 3D 'Z' Button */}
      <div className="relative -top-6">
        <button className="btn-3d w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-700 border border-purple-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)] morph-container group">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* The 3 Lines controlled by globals.css keyframes */}
            <div className="morph-line morph-line-1" />
            <div className="morph-line morph-line-2" />
            <div className="morph-line morph-line-3" />
          </div>
        </button>
      </div>

      <NavIcon href="/chat" icon={MessageCircle} label="Chat" currentPath={pathname} />
      <NavIcon href="/profile" icon={User} label="Profile" currentPath={pathname} />
      
    </div>
  );
}

function NavIcon({ href, icon: Icon, label, currentPath }: { href: string, icon: any, label: string, currentPath: string }) {
  const isActive = currentPath === href || (href !== '/' && currentPath.startsWith(href));
  return (
    <Link href={href} className="flex flex-col items-center gap-1 group no-tap-highlight">
      <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/10 text-white scale-110' : 'text-slate-500 group-hover:text-slate-300 group-active:scale-95'}`}>
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="drop-shadow-lg" />
      </div>
      <span className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${isActive ? 'text-white' : 'text-transparent group-hover:text-slate-500'}`}>
        {label}
      </span>
    </Link>
  );
}
EOF

echo -e "${INFO} 4. Upgrading Layout Controller (apps/web/components/navigation/AppLayout.tsx)..."
cat << 'EOF' > apps/web/components/navigation/AppLayout.tsx
"use client";

import React from "react";
import { TopNavBar } from "./TopNavBar";
import { BottomNavBar } from "./BottomNavBar";

export type Profile = {
  id: string;
  role: string;
  wallet_balance: number;
  full_name: string;
  avatar_url: string | null;
} | null;

export function AppLayout({ children, user, profile }: { children: React.ReactNode, user: any, profile: Profile }) {
  const balance = profile?.wallet_balance || 0;

  return (
    <div className="flex flex-col h-screen-app overflow-hidden bg-slate-950 w-full relative">
      {/* 1. Fixed Top Bar */}
      <TopNavBar userId={user?.id || null} initialBalance={balance} />
      
      {/* 2. Scrollable Content Area (Padding applied to prevent clipping under fixed bars) */}
      <main className="flex-1 w-full overflow-y-auto custom-scrollbar pt-20 pb-24">
        {children}
      </main>

      {/* 3. Fixed Bottom Bar */}
      <BottomNavBar />
    </div>
  );
}
EOF

echo -e "${INFO} 5. Verifying TypeScript..."
if npx tsc --noEmit --project apps/web/tsconfig.json; then
    echo -e "${SUCCESS} Build Verified."
else
    echo -e "${ERR_MSG} TS Error."
    exit 1
fi

echo -e "${INFO} 6. Running Production Build..."
if npm run build; then
    echo -e "${SUCCESS} Build Complete!"
    git add -A
    git commit -m "feat(zeal): deploy absolute fixed 3D navigation shell with 9-second morphing Z keyframes and real-time wallet" || true
    git push -u origin main
    echo -e "${SUCCESS} ====================================================================="
    echo -e "${SUCCESS} FIXED 3D NAVIGATION DEPLOYED!"
    echo -e "${SUCCESS} ====================================================================="
else
    echo -e "${ERR_MSG} Build failed."
    exit 1
fi