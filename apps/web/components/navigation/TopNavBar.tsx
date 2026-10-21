"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// TopNavBar — theme | animated mark + ZEAL | wallet + bell + avatar
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, LogOut, Settings, Shield, Sparkles, UserCircle, Wallet } from "lucide-react";
import {
  ZealLockup,
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
import { getImageUrl } from "@/lib/storage/r2";

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
  const [adminRole, setAdminRole] = useState<string | null>(null);

  // Role lives in the DB, not the JWT, so poll it lightly (30s + on focus).
  // This is what makes the panel button appear/disappear "realtime" after an
  // owner grants or revokes staff access.
  useEffect(() => {
    if (!userId) { setAdminRole(null); return; }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { role?: string | null };
        if (!cancelled) setAdminRole(data.role ?? null);
      } catch { /* keep last known role */ }
    };
    void check();
    const interval = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, [userId]);

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
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
  };

  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 h-16 border-b transition-all duration-300 ${
        scrolled ? "app-bar" : "border-transparent bg-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-7xl h-full px-3 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-surface-raised border border-border text-foreground hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] active:scale-95 transition-all"
          >
            <Home size={15} />
          </Link>
        </div>

        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 flex items-center"
          aria-label="Zeal home"
        >
          <ZealLockup
            size={34}
            glow
            wordClassName="text-[15px] sm:text-lg"
          />
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {userId ? (
            <>
              <WalletChip userId={userId} initialBalance={initialBalance} compact />

              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-black text-sm ring-2 ring-transparent hover:ring-[var(--color-primary)]/40 transition-all duration-200 active:scale-95"
                    aria-label="Account menu"
                  >
                    {user?.avatar ? (
                      <Image src={getImageUrl(user.avatar, "avatar-sm")} alt="" fill sizes="36px" className="object-cover" />
                    ) : (
                      (user?.name || user?.email || "?").charAt(0).toUpperCase()
                    )}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user?.name || "Your account"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {adminRole && (
                    <DropdownMenuItem onSelect={() => router.push("/admin/dashboard")}>
                      <Shield size={14} /> {adminRole === "SUPER_ADMIN" ? "Super Admin Panel" : "Admin Panel"}
                    </DropdownMenuItem>
                  )}
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
                <span
                  className={`hidden md:inline-flex items-center gap-1 text-[10px] font-bold ${
                    connection === "connected" ? "text-emerald-500" : "text-amber-500"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connection === "connected"
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-500"
                    }`}
                  />
                  {connection === "connected" ? "Live" : connection}
                </span>
              )}
            </>
          ) : (
            <Link
              href={`/login?redirectedFrom=${encodeURIComponent(pathname)}`}
              className="flex items-center gap-2 px-4 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white font-black text-xs hover:opacity-95 active:scale-95 transition-all"
            >
              <UserCircle size={14} /> Sign in
            </Link>
          )}
        </div>
      </div>
    </motion.header>
  );
}
