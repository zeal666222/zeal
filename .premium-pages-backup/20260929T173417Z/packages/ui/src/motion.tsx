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
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domMax} strict>
      {children}
    </LazyMotion>
  );
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
