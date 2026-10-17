"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// BottomNavBar — a premium floating glass dock
// ─────────────────────────────────────────────────────────────────────────────
// Home · Explore · (brand orb) · Chat · Me
//
// Design intent: industry-grade, brand-forward, buttery, and stable.
//   • Floating "island" dock — luxury glass, gold hairline ring, deep shadow.
//   • Magic-move active capsule (shared layoutId) glides between tabs.
//   • Central orb = ZealMark, the same chart geometry the header lockup uses,
//     on a night-sky tile with a rotating conic aura and a spring press.
//   • Top-edge light sweep for a living, glassy surface.
//   • All infinite/ambient motion is gated by prefers-reduced-motion for
//     accessibility and to avoid needless GPU churn.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Home, MessageCircle, User } from "lucide-react";
import { ZealMark, ZealBurst, cn } from "@zeal/ui";
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
          className="app-dock-capsule pointer-events-none absolute inset-x-1.5 inset-y-1 rounded-2xl"
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
          className="transition-colors duration-200"
          style={{
            color: active
              ? "var(--appdock-accent)"
              : "var(--appdock-muted)",
            filter: active ? "drop-shadow(0 0 9px color-mix(in srgb, var(--appdock-accent) 55%, transparent))" : undefined,
          }}
        />

        {badge > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={POP}
            className="absolute -top-1.5 -right-2 grid min-w-[16px] place-items-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 px-1 text-[9px] font-black text-white shadow-[0_2px_8px_-1px_rgba(244,63,94,0.7)] ring-2 ring-[var(--appdock-1)]"
          >
            {badge > 9 ? "9+" : badge}
          </motion.span>
        )}
      </motion.span>

      <span
        className="relative z-10 text-[9.5px] font-black uppercase tracking-[0.14em] transition-colors duration-200"
        style={{ color: active ? "var(--appdock-accent)" : "var(--appdock-muted)" }}
      >
        {label}
      </span>
    </Link>
  );
}

// ─── The central brand orb ───────────────────────────────────────────────────
// A piece of night sky parked in the middle of the dock: the canonical chart
// mark on a deep tile, one rotating conic aura, one bloom ring. Ambient loops
// are CSS (they survive HMR, never touch layout, and cost no JS); only press
// feedback stays spring-driven.
function BrandOrb({ reduced, active }: { reduced: boolean; active: boolean }) {
  const [burstKey, setBurstKey] = useState(0);

  return (
    <Link
      href="/services"
      aria-label="Services"
      onPointerDown={() => setBurstKey((n) => n + 1)}
      className={cn(
        "group relative z-20 grid h-16 w-16 -translate-y-8 place-items-center rounded-[22px]",
        "select-none touch-manipulation outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--zeal-gold)]",
      )}
    >
      {/* Light pooling under the orb */}
      <span
        aria-hidden
        className="orb-pool pointer-events-none absolute left-1/2 top-1/2 h-20 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ opacity: active ? 1 : 0.7 }}
      />

      <span
        aria-hidden
        className="orb-aura"
        style={{ opacity: active ? 0.95 : 0.68 }}
      />
      <span aria-hidden className="orb-aura orb-aura--counter" />

      {!reduced && (
        <>
          <span aria-hidden className="orb-pulse" />
          <span aria-hidden className="orb-pulse orb-pulse--late" />
        </>
      )}

      {burstKey > 0 && <ZealBurst key={burstKey} radius={30} />}

      <motion.span
        whileHover={{ scale: 1.06, y: -3 }}
        whileTap={{ scale: 0.9 }}
        transition={POP}
        className="orb-tile relative z-10 grid place-items-center"
      >
        <ZealMark size={38} detail="full" title="Zeal services" />
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
      <div
        className={cn(
          "dock-entry pointer-events-auto relative",
          "mb-[max(env(safe-area-inset-bottom),12px)] w-[min(calc(100%-16px),460px)]",
        )}
      >
        {/* Gold-tinted hairline ring wraps the glass */}
        <div
          className="rounded-[30px] p-px"
          style={{
            backgroundImage:
              "linear-gradient(180deg, var(--appdock-hairline), color-mix(in srgb, var(--color-luxury-gold) 55%, transparent))",
          }}
        >
          {/* Clipped glass surface + decorative light */}
          <div className="app-dock relative h-16 overflow-hidden rounded-[29px] border border-[var(--appdock-hairline)]">
            {/* Inner top highlight for the glassy bevel */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--appdock-hairline)] to-transparent"
            />
            {/* Sweeping edge light along the top hairline */}
            {!reduced && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute top-0 left-0 h-px w-1/3 bg-gradient-to-r from-transparent via-[var(--color-luxury-gold)] to-transparent"
                initial={{ x: "-140%" }}
                animate={{ x: "360%" }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.6 }}
              />
            )}
            {/* Warm floor glow beneath the brand orb */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 bottom-[-40%] h-24 w-40 -translate-x-1/2 rounded-full blur-2xl"
              style={{ background: "color-mix(in srgb, var(--color-primary) 26%, transparent)" }}
            />

            {/* Tab row */}
            <div className="relative flex h-full items-center px-2">
              <DockItem href="/" icon={Home} label="Home" active={isHome && !isServices} />
              <DockItem href="/explore" icon={Compass} label="Explore" active={isExplore} />

              {/* Center slot: reserves the middle + the label baseline.
                  The brand orb itself is drawn in a non-clipped overlay below. */}
              <div className="relative flex h-full flex-1 items-center justify-center">
                <span
                  className="relative z-10 text-[9.5px] font-black uppercase tracking-[0.14em] transition-colors duration-200"
                  style={{
                    color: isServices ? "var(--appdock-accent)" : "var(--appdock-muted)",
                    letterSpacing: "0.14em",
                  }}
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
            <BrandOrb reduced={reduced} active={isServices} />
          </div>
        </div>
      </div>
    </div>
  );
}
