"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// TopNavBar — 3-column: theme | animated mark | wallet + notif + avatar
// ─────────────────────────────────────────────────────────────────────────────
// • Auto-blur/opacity on scroll
// • Realtime wallet chip with animated delta
// • Animated Zeal mark with morphing SVG
// • Notification bell with unread badge
// • Avatar dropdown (profile, settings, sign out)
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserCircle, LogOut, Settings, Wallet, Sparkles } from "lucide-react";
import {
  AnimatedZealMark,
  ThemeToggle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@zeal/ui";
import { useChannel, useConnection, channels, type BroadcastChange } from "@zeal/realtime";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WalletChip } from "./WalletChip";
import { useAppStore } from "@/lib/store/appStore";

interface NotifRow {
  id?: string;
  type?: string;
  message?: string;
  redirectUrl?: string | null;
}

interface Props {
  userId: string | null;
  initialBalance: number;
}

export function TopNavBar({ userId, initialBalance }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const connection = useConnection();
  const [scrolled, setScrolled] = useState(false);
  const addNotification = useAppStore((s) => s.addNotification);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const handleSignOut = async () => {
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch { /* ignore */ }
    router.push("/login");
  };

  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)] shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* ─── LEFT: theme toggle ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
        </div>

        {/* ─── CENTER: animated Zeal mark ───────────────────────────────── */}
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 group"
          aria-label="Zeal home"
        >
          <motion.div
            whileHover={{ scale: 1.08, rotate: -3 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            <AnimatedZealMark size={34} glow />
          </motion.div>

          <motion.span
            initial={{ opacity: 0, letterSpacing: "0.3em" }}
            animate={{ opacity: 1, letterSpacing: "0.15em" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hidden sm:inline-block text-lg font-black tracking-tight
                       bg-gradient-to-r from-[#9D7DC5] via-purple-300 to-[#533AFD]
                       bg-clip-text text-transparent
                       drop-shadow-[0_0_12px_rgba(157,125,197,0.35)]"
          >
            ZEAL
          </motion.span>
        </Link>

        {/* ─── RIGHT: wallet + notifications + avatar ───────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {userId ? (
            <>
              <div className="hidden sm:block">
                <WalletChip userId={userId} initialBalance={initialBalance} />
              </div>

              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative w-9 h-9 rounded-full overflow-hidden
                               bg-gradient-to-br from-[#9D7DC5] to-[#533AFD]
                               flex items-center justify-center
                               text-white font-black text-sm
                               ring-2 ring-transparent hover:ring-[var(--color-primary)]/40
                               transition-all duration-200 active:scale-95"
                    aria-label="Account menu"
                  >
                    {user?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (user?.name || user?.email || "?").charAt(0).toUpperCase()
                    )}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {user?.name || "Your account"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/profile")}>
                    <UserCircle size={14} /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/wallet")}>
                    <Wallet size={14} /> Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/sparks")}>
                    <Sparkles size={14} /> Sparks
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/profile?tab=settings")}>
                    <Settings size={14} /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={handleSignOut}>
                    <LogOut size={14} /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {process.env.NODE_ENV !== "production" && (
                <span className={`hidden md:inline-flex items-center gap-1 text-[10px] font-bold ${
                  connection === "connected" ? "text-emerald-500" : "text-amber-500"
                }`}>
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
              className="flex items-center gap-2 px-4 h-9 rounded-full
                         bg-gradient-to-br from-[#9D7DC5] to-[#533AFD]
                         text-white font-black text-xs
                         hover:opacity-95 active:scale-95 transition-all"
            >
              <UserCircle size={14} /> Sign in
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  );
}
