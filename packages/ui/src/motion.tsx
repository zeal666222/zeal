"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// LazyMotion wrapper — reduces Framer Motion from 34KB to <5KB
// ─────────────────────────────────────────────────────────────────────────────
// Usage:
//   import { MotionDiv, MotionButton } from "@zeal/ui/motion";
//   <MotionDiv animate={{ opacity: 1 }}>...</MotionDiv>
//
// The `m` component + LazyMotion is the industry-standard way to ship
// Framer Motion without the 34KB initial payload.
// ═══════════════════════════════════════════════════════════════════════════════

import { LazyMotion, domMax, m, AnimatePresence } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Wrap the app once (in root layout) with this provider.
 * All `Motion*` components below use the lazy-loaded `m` component.
 *
 * NOTE: We intentionally do NOT wrap children in `<LazyMotion>`. The web app
 * uses the full `motion` component from its own framer-motion copy (apps/web
 * has its own node_modules), and packages/ui has a separate copy. Wrapping
 * with `<LazyMotion>` here only affects packages/ui's copy — apps/web's
 * `<motion>` elements never see it, so variants don't propagate and elements
 * stay at their initial state (e.g. opacity 0). Drop the wrapper; the full
 * motion component works on its own.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return <>{children}</>;
}

export { AnimatePresence };

export const MotionDiv      = m.div;
export const MotionSpan     = m.span;
export const MotionButton   = m.button;
export const MotionSection  = m.section;
export const MotionArticle  = m.article;
export const MotionHeader   = m.header;
export const MotionFooter   = m.footer;
export const MotionMain     = m.main;
export const MotionNav      = m.nav;
export const MotionA        = m.a;
export const MotionLi       = m.li;
export const MotionUl       = m.ul;
export const MotionP        = m.p;
export const MotionH1       = m.h1;
export const MotionH2       = m.h2;
export const MotionH3       = m.h3;
export const MotionImg      = m.img;
export const MotionForm     = m.form;

export type MotionDivProps = ComponentProps<typeof m.div>;

/* ═══════════════════════════════════════════════════════════════════════════════
   ZEAL_PHASE1_LUXURY_v1
   Luxury motion primitives. Additive — existing exports above are untouched.
   ─────────────────────────────────────────────────────────────────────────────
   Provides:
     • cardHoverVariants  — 3D tilt on hover (spring 260/20)
     • staggerContainer   — staggered child reveals
     • fadeUp             — standard reveal (spring 200/24)
     • pulseGlow          — infinite ambient pulse
     • LuxuryCard         — reusable glass card with optional tilt
   ═══════════════════════════════════════════════════════════════════════════════ */

import { cn } from "./utils";

export const cardHoverVariants = {
  rest: { scale: 1, rotateX: 0, rotateY: 0, y: 0 },
  hover: {
    scale: 1.02,
    rotateX: 2,
    rotateY: -2,
    y: -4,
    transition: { type: "spring" as const, stiffness: 260, damping: 20 },
  },
} as const;

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
} as const;

export const pulseGlow = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.3, 0.6, 0.3],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
} as const;

export interface LuxuryCardProps extends React.ComponentProps<typeof m.div> {
  interactive?: boolean;
  glow?: boolean;
}

export function LuxuryCard({
  children,
  className,
  interactive = true,
  glow = false,
  ...props
}: LuxuryCardProps) {
  return (
    <m.div
      variants={interactive ? cardHoverVariants : undefined}
      initial={interactive ? "rest" : undefined}
      whileHover={interactive ? "hover" : undefined}
      className={cn(
        "glass-luxury rounded-2xl relative overflow-hidden",
        glow && "shadow-[0_0_40px_-8px_oklch(0.78_0.12_85/0.25)]",
        interactive && "group",
        className,
      )}
      {...props}
    >
      {children}
    </m.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Lenis smooth scroll — momentum scroll for the whole app
   ─────────────────────────────────────────────────────────────────────────────
   Wraps children in a Lenis instance. RAF loop drives lenis.raf(). Respects
   prefers-reduced-motion. Cleans up on unmount.
   ═══════════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
      lerp: 0.1,
    });
    ref.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      ref.current = null;
    };
  }, []);

  return <>{children}</>;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ZEAL_PHASE6_POLISH
   ─────────────────────────────────────────────────────────────────────────────
   Premium motion utilities:
     • ScrollReveal — fade-in-up wrapper using whileInView
     • SuccessCheck — animated checkmark for success states
     • PageTransition — standard page enter animation
   ═══════════════════════════════════════════════════════════════════════════════ */

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}) {
  const dirMap = {
    up:    { y: 24, x: 0 },
    down:  { y: -24, x: 0 },
    left:  { y: 0, x: 24 },
    right: { y: 0, x: -24 },
  } as const;
  const offset = dirMap[direction];

  return (
    <m.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}

export function SuccessCheck({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <m.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn("flex items-center justify-center", className)}
    >
      <m.svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        initial={{ rotate: -10 }}
        animate={{ rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <m.circle
          cx={24} cy={24} r={22}
          stroke="var(--color-success, #22c55e)"
          strokeWidth={3}
          fill="var(--color-success-muted, rgba(34,197,94,0.12))"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <m.path
          d="M14 24l7 7 13-13"
          stroke="var(--color-success, #22c55e)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.3, ease: "easeOut" }}
        />
      </m.svg>
    </m.div>
  );
}

export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
} as const;
