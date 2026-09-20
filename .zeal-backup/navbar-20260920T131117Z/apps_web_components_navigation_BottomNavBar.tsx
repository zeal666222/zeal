"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// BottomNavBar — 5 items + long-coded morph Z button
// ─────────────────────────────────────────────────────────────────────────────
// Center button: 12-second SVG morph sequence (Z → triangle → diamond →
// lightning → Z). Radial pulse behind. Haptic bounce on tap. Glow ring.
// Side items: icon + label, active state glow, subtle bounce on tap.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Compass, MessageCircle, User } from "lucide-react";
import { AnimatedZealMark } from "@zeal/ui";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { useState, useEffect } from "react";
import { cn } from "@zeal/ui";

interface MessageRow {
  senderId?: string;
  conversationId?: string;
  createdAt?: string;
}

function NavIcon({
  href,
  icon: Icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-full select-none"
      aria-label={label}
    >
      {/* Active indicator — spring-animated underline */}
      {active && (
        <motion.span
          layoutId="bottomnav-active"
          className="absolute -top-0.5 w-10 h-0.5 rounded-full bg-gradient-to-r from-[#9D7DC5] to-[#533AFD]"
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      )}

      <motion.div
        whileTap={{ scale: 0.82, rotate: active ? 0 : -8 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="relative"
      >
        <Icon
          size={22}
          strokeWidth={active ? 2.5 : 1.8}
          className={cn(
            "transition-all duration-200",
            active
              ? "text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(157,125,197,0.5)]"
              : "text-[var(--color-muted-foreground)]",
          )}
        />

        {badge !== undefined && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full
                       bg-rose-500 text-white text-[9px] font-black
                       flex items-center justify-center
                       shadow-md shadow-rose-500/40"
          >
            {badge > 9 ? "9+" : badge}
          </motion.span>
        )}
      </motion.div>

      <span
        className={cn(
          "text-[9px] font-black uppercase tracking-wider transition-colors duration-200",
          active
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-muted-foreground)]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function BottomNavBar({ userId }: { userId?: string | null }) {
  const pathname = usePathname();
  const [unreadChat, setUnreadChat] = useState(0);

  // Live unread chat counter — decoupled from any store
  useChannel<BroadcastChange<MessageRow>>({
    channel: userId ? channels.userInbox(userId) : null,
    event: "*",
    onMessage: (p) => {
      if (p?.record?.senderId && p.record.senderId !== userId) {
        setUnreadChat((n) => Math.min(99, n + 1));
      }
    },
  });

  // Clear chat badge when entering /chat
  useEffect(() => {
    if (pathname?.startsWith("/chat")) setUnreadChat(0);
  }, [pathname]);

  return (
    <motion.nav
      initial={{ y: 72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="fixed bottom-0 left-0 right-0 z-50 h-20
                 bg-[var(--color-surface)]/85 backdrop-blur-2xl
                 border-t border-[var(--color-border)]
                 flex items-center justify-around px-2
                 pb-safe"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <NavIcon href="/"        icon={Home}           label="Home"    active={pathname === "/"} />
      <NavIcon href="/explore" icon={Compass}        label="Explore" active={pathname?.startsWith("/explore") ?? false} />

      {/* ─── CENTER: morph Z button ─────────────────────────────────────── */}
      <Link
        href="/services"
        className="relative -top-7 sm:-top-8 select-none group"
        aria-label="Services"
      >
        {/* Radial pulse behind button */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(157,125,197,0.35) 0%, rgba(83,58,253,0) 70%)",
          }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0.15, 0.55] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Rotating conic gradient ring */}
        <motion.span
          aria-hidden
          className="absolute -inset-1 rounded-2xl opacity-70"
          style={{
            background:
              "conic-gradient(from 0deg, #9D7DC5, #533AFD, #9D7DC5, #533AFD, #9D7DC5)",
            filter: "blur(6px)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        <motion.div
          whileHover={{ scale: 1.08, rotate: 3 }}
          whileTap={{ scale: 0.88, rotate: -6 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
          className="relative w-16 h-16 sm:w-[68px] sm:h-[68px]
                     rounded-2xl
                     bg-gradient-to-br from-[#9D7DC5] via-[#7A5A9E] to-[#533AFD]
                     border border-purple-400/40
                     flex items-center justify-center
                     shadow-[0_8px_24px_-6px_rgba(83,58,253,0.55),0_0_24px_-4px_rgba(157,125,197,0.55)]"
        >
          {/* Inner highlight */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl
                       bg-gradient-to-b from-white/15 to-transparent
                       pointer-events-none"
          />
          <AnimatedZealMark size={30} glow={false} variant="mono" className="text-white relative z-10" />
        </motion.div>

        {/* Label under button */}
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2
                         text-[9px] font-black uppercase tracking-wider
                         text-[var(--color-primary)]
                         drop-shadow-[0_0_6px_rgba(157,125,197,0.4)]">
          Services
        </span>
      </Link>

      <NavIcon
        href="/chat"
        icon={MessageCircle}
        label="Chat"
        active={pathname?.startsWith("/chat") ?? false}
        badge={unreadChat}
      />
      <NavIcon
        href="/profile"
        icon={User}
        label="Me"
        active={pathname?.startsWith("/profile") ?? false}
      />
    </motion.nav>
  );
}
