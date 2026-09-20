"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// TopNavBar — seeker portal (theme toggle, balance chip, notification bell)
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, IndianRupee, UserCircle } from "lucide-react";
import { useChannel, useConnection, channels, type BroadcastChange } from "@zeal/realtime";
import { useWallet } from "@/hooks/useWallet";
import { useAppStore } from "@/lib/store/appStore";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface NotifRow {
  id?: string;
  type?: string;
  message?: string;
  redirectUrl?: string | null;
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

  const { balance: liveBalance } = useWallet(userId);
  const [balance, setBalance] = useState(initialBalance);
  useEffect(() => {
    if (typeof liveBalance === "number" && liveBalance > 0) setBalance(liveBalance);
  }, [liveBalance]);
  useEffect(() => setBalance(initialBalance), [initialBalance]);

  const addNotification = useAppStore((s) => s.addNotification);

  useChannel<BroadcastChange<NotifRow>>({
    channel: userId ? channels.userNotifications(userId) : null,
    event: "*",
    onMessage: (p) => {
      const r = p?.record;
      if (!r?.message) return;
      addNotification({
        id: r.id ?? `n-${Date.now()}`,
        type: (r.type as never) ?? "system",
        message: r.message,
        redirectUrl: r.redirectUrl ?? null,
        read: false,
        actorId: "system",
      });
    },
  });

  const icon = !mounted ? <Moon size={18} /> : isDark ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 bg-slate-950/80 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between px-3 sm:px-8">
      <div className="flex-1 flex items-center">
        <button type="button" onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-all">
          {icon}
        </button>
      </div>

      <div className="flex-1 flex justify-center">
        <Link href="/" className="relative flex items-center justify-center group">
          <div className="absolute w-12 h-12 sm:w-16 sm:h-16 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/40 transition-all pointer-events-none" />
          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-200 to-purple-600 relative z-10">
            Zeal
          </h1>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
        {userId ? (
          <>
            <Link href="/wallet"
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-500/50 text-white hover:from-emerald-500 active:scale-95 transition-all">
              <IndianRupee size={16} />
              <span className="font-black text-sm tabular-nums">{Number(balance).toFixed(2)}</span>
            </Link>

            <NotificationBell />

            {process.env.NODE_ENV !== "production" && (
              <span className={`hidden md:inline-flex items-center gap-1 text-[10px] font-bold ${
                connection === "connected" ? "text-emerald-400" : "text-amber-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  connection === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`} />
                {connection === "connected" ? "Live" : connection}
              </span>
            )}
          </>
        ) : (
          <Link href={`/login?redirectedFrom=${encodeURIComponent(pathname)}`}
            className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 border border-purple-500/50 text-white active:scale-95 transition-all">
            <UserCircle size={16} />
            <span className="font-black text-xs sm:text-sm">Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
