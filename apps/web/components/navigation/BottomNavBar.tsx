"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// BottomNavBar — a premium floating glass dock
// ─────────────────────────────────────────────────────────────────────────────
// Home · Explore · (Morph-Z brand orb) · Chat · Me
//
// Design intent: industry-grade, brand-forward, buttery, and stable.
//   • Floating "island" dock — luxury glass, gold hairline ring, deep shadow.
//   • Magic-move active capsule (shared layoutId) glides between tabs.
//   • Central Z orb = the brand anchor: rotating conic aura + concentric
//     pulse rings + SMIL path-morphing mark + spring press feedback.
//   • Top-edge light sweep for a living, glassy surface.
//   • All infinite/ambient motion is gated by prefers-reduced-motion for
//     accessibility and to avoid needless GPU churn.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Compass, Home, MessageCircle, User } from "lucide-react";
import { AnimatedZealMark, cn } from "@zeal/ui";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { useEffect, useState } from "react";

interface MessageRow {
  senderId?: string;
  conversationId?: string;
  createdAt?: string;
}

// ─── Motion presets (tuned for a weighted, expensive feel) ───────────────────
const GLIDE = { type: "spring", stiffness: 300, damping: 26, mass: 0.9 } as const;
const POP   = { type: "spring", stiffness: 520, damping: 20, mass: 0.7 } as const;
const DOCK_ENTRY: Variants = {
  hidden: { y: 88, opacity: 0, filter: "blur(6px)" },
  show: {
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { type: "spring", stiffness: 220, damping: 26, mass: 1.05, delay: 0.08 },
  },
};

interface DockItemProps {
  href: string;
  icon: typeof Home;
  label: string;
  active: boolean;
  badge?: number;
}

// ─── A single tab: icon + label, with a gliding capsule behind the active one ─
function DockItem({ href, icon: Icon, label, active, badge = 0 }: DockItemProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-full flex-1 flex-col items-center justify-center",
        "gap-1 rounded-2xl select-none touch-manipulation outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50",
      )}
    >
      {/* Magic-move capsule */}
      {active && (
        <motion.span
          layoutId="dock-active-capsule"
          transition={GLIDE}
          className="pointer-events-none absolute inset-x-1.5 inset-y-1 rounded-2xl
                     bg-gradient-to-b from-[var(--color-primary)]/18
                     via-[var(--color-primary)]/10 to-[var(--color-luxury-gold)]/12
                     ring-1 ring-inset ring-[var(--color-primary)]/25"
          style={{ boxShadow: "0 0 24px -8px rgba(157,125,197,0.6)" }}
        />
      )}

      <motion.span
        initial={false}
        animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}
        whileTap={{ scale: 0.8 }}
        transition={POP}
        className="relative z-10"
      >
        <Icon
          size={21}
          strokeWidth={active ? 2.5 : 1.9}
          className={cn(
            "transition-colors duration-200",
            active
              ? "text-[var(--color-primary)]"
              : "text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)]",
          )}
          style={active ? { filter: "drop-shadow(0 0 8px rgba(157,125,197,0.5))" } : undefined}
        />

        {badge > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={POP}
            className="absolute -top-1.5 -right-2 grid min-w-[16px] place-items-center
                       rounded-full bg-gradient-to-br from-rose-500 to-rose-600 px-1
                       text-[9px] font-black text-white
                       shadow-[0_2px_8px_-1px_rgba(244,63,94,0.7)] ring-2 ring-[var(--color-surface)]"
          >
            {badge > 9 ? "9+" : badge}
          </motion.span>
        )}
      </motion.span>

      <span
        className={cn(
          "relative z-10 text-[9.5px] font-black uppercase tracking-[0.14em]",
          "transition-colors duration-200",
          active
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

// ─── The central brand orb ───────────────────────────────────────────────────
function BrandOrb({ reduced }: { reduced: boolean }) {
  return (
    <Link
      href="/services"
      aria-label="Services"
      className={cn(
        "group relative z-20 grid h-16 w-16 -translate-y-8 place-items-center rounded-[22px]",
        "select-none touch-manipulation outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--color-luxury-gold)]/60",
      )}
    >
      {/* Ambient floor glow, sitting just under the orb */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-24 -translate-x-1/2 -translate-y-1/2
                   rounded-full bg-[var(--color-primary)]/30 blur-2xl"
      />

      {/* Rotating conic aura (the signature) */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1.5 rounded-[26px] opacity-80"
        style={{
          background:
            "conic-gradient(from 0deg, var(--color-primary), var(--color-luxury-gold), var(--color-primary-hover), var(--color-primary), var(--color-luxury-gold), var(--color-primary))",
          filter: "blur(9px)",
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={reduced ? undefined : { duration: 9, repeat: Infinity, ease: "linear" }}
      />

      {/* Counter-rotating inner shimmer ring for depth */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[22px] opacity-60"
        style={{
          background:
            "conic-gradient(from 180deg, transparent, rgba(255,255,255,0.35), transparent 40%)",
          maskImage: "radial-gradient(circle, transparent 58%, black 62%, black 100%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 58%, black 62%, black 100%)",
        }}
        animate={reduced ? undefined : { rotate: -360 }}
        transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {/* Expanding pulse rings */}
      {!reduced &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[22px] border border-[var(--color-luxury-gold)]/50"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: i * 1.3 }}
          />
        ))}

      {/* Orb face */}
      <motion.span
        whileHover={{ scale: 1.06, rotate: 2 }}
        whileTap={{ scale: 0.9, rotate: -5 }}
        transition={POP}
        className="relative grid h-14 w-14 place-items-center rounded-[18px]
                   bg-gradient-to-br from-[var(--color-primary)] via-[#7A5A9E] to-[var(--color-primary-hover)]
                   ring-1 ring-white/25
                   shadow-[0_10px_28px_-8px_rgba(83,58,253,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)]"
      >
        {/* Glass top sheen */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px]
                     bg-gradient-to-b from-white/25 to-transparent"
        />
        <AnimatedZealMark
          size={30}
          glow={false}
          variant="mono"
          className="relative z-10 text-white"
        />
      </motion.span>
    </Link>
  );
}

export function BottomNavBar({ userId }: { userId?: string | null }) {
  const pathname = usePathname();
  const reduced = useReducedMotion() === true;
  const [unreadChat, setUnreadChat] = useState(0);

  useChannel<BroadcastChange<MessageRow>>({
    channel: userId ? channels.userInbox(userId) : null,
    event: "*",
    onMessage: (p) => {
      if (p?.record?.senderId && p.record.senderId !== userId) {
        setUnreadChat((n) => Math.min(99, n + 1));
      }
    },
  });

  useEffect(() => {
    if (pathname?.startsWith("/chat")) setUnreadChat(0);
  }, [pathname]);

  const isHome = pathname === "/";
  const isExplore = pathname?.startsWith("/explore") ?? false;
  const isServices = pathname?.startsWith("/services") ?? false;
  const isChat = pathname?.startsWith("/chat") ?? false;
  const isMe = pathname?.startsWith("/profile") ?? false;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center">
      <motion.div
        variants={DOCK_ENTRY}
        initial="hidden"
        animate="show"
        className={cn(
          "pointer-events-auto relative",
          "mb-[max(env(safe-area-inset-bottom),12px)] w-[min(calc(100%-16px),460px)]",
        )}
      >
        {/* Gold-tinted hairline ring wraps the glass */}
        <div
          className="rounded-[30px] bg-gradient-to-b p-px
                     from-white/25 via-[var(--color-luxury-glass-border)]
                     to-[var(--color-luxury-gold)]/45"
          style={{ boxShadow: "var(--shadow-luxury-glow)" }}
        >
          {/* Clipped glass surface + decorative light */}
          <div className="relative h-16 overflow-hidden rounded-[29px]
                         border border-[var(--color-luxury-glass-border)]
                         bg-[var(--color-luxury-glass)] backdrop-blur-2xl">
            {/* Inner top highlight for the glassy bevel */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px
                         bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            {/* Sweeping edge light along the top hairline */}
            {!reduced && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute top-0 left-0 h-px w-1/3
                           bg-gradient-to-r from-transparent via-[var(--color-luxury-gold)]/90 to-transparent"
                initial={{ x: "-140%" }}
                animate={{ x: "360%" }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.6 }}
              />
            )}
            {/* Warm floor glow beneath the brand orb */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 bottom-[-40%] h-24 w-40 -translate-x-1/2
                         rounded-full bg-[var(--color-primary)]/22 blur-2xl"
            />

            {/* Tab row */}
            <div className="relative flex h-full items-center px-2">
              <DockItem href="/" icon={Home} label="Home" active={isHome && !isServices} />
              <DockItem href="/explore" icon={Compass} label="Explore" active={isExplore} />

              {/* Center slot: reserves the middle + the label baseline.
                  The brand orb itself is drawn in a non-clipped overlay below. */}
              <div className="relative flex h-full flex-1 items-center justify-center">
                <span
                  className={cn(
                    "relative z-10 text-[9.5px] font-black uppercase tracking-[0.14em]",
                    "transition-colors duration-200",
                    isServices
                      ? "text-[var(--color-luxury-gold)]"
                      : "text-[var(--color-muted-foreground)]",
                  )}
                >
                  Services
                </span>
              </div>

              <DockItem href="/chat" icon={MessageCircle} label="Chat" active={isChat} badge={unreadChat} />
              <DockItem href="/profile" icon={User} label="Me" active={isMe} />
            </div>
          </div>
        </div>

        {/* Brand orb — rendered above the clipped glass so it can rise out of
            the dock without being cut off. Centered on the bar, raised upward. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
          <div className="pointer-events-auto">
            <BrandOrb reduced={reduced} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
