"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// AnimatedZealMark
// ═══════════════════════════════════════════════════════════════════════════════
// Path morphing is done with NATIVE SVG <animate> (SMIL) — not Framer Motion.
// Framer Motion's `animate={{ d: [...] }}` interpolation is unreliable across
// browsers and can emit `d="undefined"` when command sequences don't align.
// Native SMIL is deterministic, GPU-composited, and requires no JS at runtime.
// ═══════════════════════════════════════════════════════════════════════════════

import { useId } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "./utils";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
  animate?: boolean;
  variant?: "brand" | "mono";
}

// All paths are valid "M … L …" strings with equal command counts so SMIL
// can morph between them without interpolation artifacts.
const Z        = "M 8 10 L 40 10 L 8 38 L 40 38";
const TRIANGLE = "M 24 8 L 40 34 L 8 34 L 40 34";
const DIAMOND  = "M 24 8 L 40 24 L 24 40 L 8 24";
const SQUARE   = "M 8 8 L 40 8 L 40 40 L 8 40";

const SEQUENCE_VALUES = `${Z}; ${TRIANGLE}; ${DIAMOND}; ${SQUARE}; ${Z}`;

function safePath(d: string | undefined | null): string {
  if (typeof d !== "string" || d.length === 0) return Z;
  if (!/^[Mm]/.test(d.trim())) return Z;
  return d;
}

export function AnimatedZealMark({
  size = 28,
  className,
  glow = true,
  animate = true,
  variant = "brand",
}: Props) {
  const raw = useId();
  const safe = raw.replace(/:/g, "");
  const gradientId = `zeal-mark-grad-${safe}`;
  const filterId   = `zeal-mark-glow-${safe}`;
  const stroke = variant === "brand" ? `url(#${gradientId})` : "currentColor";
  const d0 = safePath(Z);

  const prefersReduced = useReducedMotion();
  const shouldAnimate = animate && !prefersReduced;

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label="Zeal"
      role="img"
    >
      {glow && (
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              variant === "brand"
                ? "radial-gradient(circle, rgba(157,125,197,0.5) 0%, rgba(83,58,253,0) 70%)"
                : "radial-gradient(circle, currentColor 0%, transparent 70%)",
          }}
          animate={
            shouldAnimate
              ? { scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] }
              : undefined
          }
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        className="relative z-10"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#9D7DC5" />
            <stop offset="50%"  stopColor="#7A5A9E" />
            <stop offset="100%" stopColor="#533AFD" />
          </linearGradient>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={d0}
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          {shouldAnimate && (
            <animate
              attributeName="d"
              dur="12s"
              repeatCount="indefinite"
              values={SEQUENCE_VALUES}
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          )}
        </path>
      </svg>
    </span>
  );
}
