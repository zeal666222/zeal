"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// AnimatedZealMark — morphing Z mark with glow pulse
// ─────────────────────────────────────────────────────────────────────────────
// Renders an SVG "Z" that continuously cycles through a 6-second morph
// sequence: Z → Triangle → Diamond → Z. An outer glow ring pulses in sync.
// Sizes adapt from 16px (inline) to 96px (hero).
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion";
import { cn } from "./utils";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
  animate?: boolean;
  variant?: "brand" | "mono";
}

export function AnimatedZealMark({
  size = 28,
  className,
  glow = true,
  animate = true,
  variant = "brand",
}: Props) {
  const gradientId = `zeal-mark-gradient-${Math.random().toString(36).slice(2, 8)}`;
  const glowId = `zeal-mark-glow-${Math.random().toString(36).slice(2, 8)}`;

  // Morph path sequences — each is a full SVG path the Z transitions between.
  // All share the same starting and ending point so the loop is seamless.
  const paths = {
    z: "M 8 10 L 40 10 L 8 38 L 40 38",
    triangle: "M 24 8 L 40 34 L 8 34 Z",
    diamond: "M 24 8 L 40 24 L 24 40 L 8 24 Z",
    lightning: "M 22 8 L 36 8 L 26 22 L 38 22 L 16 42 L 22 24 L 12 24 Z",
  };

  const sequence = [paths.z, paths.triangle, paths.diamond, paths.lightning, paths.z];
  const duration = 12;

  const stroke =
    variant === "brand"
      ? `url(#${gradientId})`
      : "currentColor";

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label="Zeal"
    >
      {/* Outer glow pulse */}
      {glow && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              variant === "brand"
                ? "radial-gradient(circle, rgba(157,125,197,0.5) 0%, rgba(83,58,253,0) 70%)"
                : "radial-gradient(circle, currentColor 0%, transparent 70%)",
          }}
          animate={animate ? { scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        className="relative z-10"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9D7DC5" />
            <stop offset="50%" stopColor="#7A5A9E" />
            <stop offset="100%" stopColor="#533AFD" />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {animate ? (
          <motion.path
            d={paths.z}
            stroke={stroke}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
            animate={{ d: sequence }}
            transition={{
              duration,
              repeat: Infinity,
              times: [0, 0.25, 0.5, 0.75, 1],
              ease: "easeInOut",
            }}
          />
        ) : (
          <path
            d={paths.z}
            stroke={stroke}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />
        )}
      </svg>
    </span>
  );
}
