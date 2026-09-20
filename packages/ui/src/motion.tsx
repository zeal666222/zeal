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

import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
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
    <LazyMotion features={domAnimation} strict>
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
