"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// apps/web/components/navigation/TopNavBar.tsx
//  • Dark/light toggle via next-themes (persists)
//  • Notification bell → /notifications with live badge
//  • Wallet balance with realtime updates
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Bell, IndianRupee, UserCircle } from "lucide-react";
import {
  useChannel, useConnection, channels,
  type BroadcastChange,
} from "@zeal/realtime";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/lib/store/appStore";

interface NotificationRow {
  id?: string;
  type?: string;
  message?: string;
  redirectUrl?: string | null;
  createdAt?: string;
}

export function TopNavBar({
  userId,
  initialBalance,
}: {
  userId: string | null;
  initialBalance: number;
}) {
  const pathname = usePathname();
  const connection = useConnection();

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  // Wallet
  const { balance: liveBalance } = useWallet(userId);
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    if (typeof liveBalance === "number" && liveBalance > 0) setBalance(liveBalance);
  }, [liveBalance]);

  useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance]);

  // Notifications
  const storeUnread = useAppStore((s) => s.unreadCount);
  const addNotification = useAppStore((s) => s.addNotification);
  const [localUnread, setLocalUnread] = useState(0);

  useEffect(() => setLocalUnread(storeUnread), [storeUnread]);

  useChannel<BroadcastChange<NotificationRow>>({
    channel: userId ? channels.userNotifications(userId) : null,
    event: "*",
    onMessage: (payload) => {
      const row = payload?.record;
      if (!row?.message) return;
      addNotification({
        id: row.id ?? `notif-${Date.now()}`,
        type: (row.type as never) ?? "system",
        message: row.message,
        redirectUrl: row.redirectUrl ?? null,
        read: false,
        actorId: "system",
      });
      setLocalUnread((n) => n + 1);
    },
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch("/api/notifications/unread-count", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.count === "number") setLocalUnread(d.count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, pathname]);

  const showUnread = localUnread > 0;

  const themeIcon = () => {
    if (!mounted) return <Moon size={18} />;
    return isDark ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 bg-slate-950/80 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-3 sm:px-8">
      {/* Theme toggle */}
      <div className="flex-1 flex items-center">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light" : "Switch to dark"}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/80 active:scale-90 transition-all"
        >
          {themeIcon()}
        </button>
      </div>

      {/* Logo */}
      <div className="flex-1 flex justify-center">
        <Link href="/" className="relative flex items-center justify-center group">
          <div className="absolute w-12 h-12 sm:w-16 sm:h-16 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/40 transition-all duration-500 pointer-events-none" />
          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-200 to-purple-600 relative z-10">
            Zeal
          </h1>
        </Link>
      </div>

      {/* Balance + Bell */}
      <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
        {userId ? (
          <>
            <Link
              href="/wallet"
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-500/50 text-white hover:from-emerald-500 hover:to-emerald-800 transition-all active:scale-95"
            >
              <IndianRupee size={16} />
              <span className="font-black text-sm tracking-wide tabular-nums">
                {Number(balance).toFixed(2)}
              </span>
            </Link>

            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/80 active:scale-90 transition-all"
            >
              <Bell size={18} />
              {showUnread && (
                <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full border-2 border-slate-950 flex items-center justify-center text-white text-[10px] font-bold">
                  {localUnread > 99 ? "99+" : localUnread}
                </span>
              )}
            </Link>

            {process.env.NODE_ENV !== "production" && (
              <span
                className={`hidden md:inline-flex items-center gap-1 text-[10px] font-bold ${
                  connection === "connected" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  connection === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`} />
                {connection === "connected" ? "Live" : connection}
              </span>
            )}
          </>
        ) : (
          <Link
            href={`/login?redirectedFrom=${encodeURIComponent(pathname)}`}
            className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 border border-purple-500/50 text-white hover:from-purple-500 hover:to-indigo-600 active:scale-95 transition-all"
          >
            <UserCircle size={16} />
            <span className="font-black text-xs sm:text-sm tracking-wide">Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
