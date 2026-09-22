"use client";
import { useId } from "react";
import { m } from "framer-motion";
import { cn } from "./utils";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
  animate?: boolean;
  variant?: "brand" | "mono";
}

const PATHS = {
  z:        "M 8 10 L 40 10 L 8 38 L 40 38",
  triangle: "M 24 8 L 40 34 L 8 34 L 40 34",
  diamond:  "M 24 8 L 40 24 L 24 40 L 8 24",
  square:   "M 8 8 L 40 8 L 40 40 L 8 40",
} as const;

const SEQUENCE = [PATHS.z, PATHS.triangle, PATHS.diamond, PATHS.square, PATHS.z];

function safePath(d: string | undefined | null): string {
  if (typeof d !== "string" || d.length === 0) return PATHS.z;
  if (!/^[Mm]/.test(d.trim())) return PATHS.z;
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
  const glowId = `zeal-mark-glow-${safe}`;
  const stroke = variant === "brand" ? `url(#${gradientId})` : "currentColor";
  const d0 = safePath(PATHS.z);

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label="Zeal"
    >
      {glow && (
        <m.span
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
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
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#9D7DC5" />
            <stop offset="50%"  stopColor="#7A5A9E" />
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
          <m.path
            d={d0}
            stroke={stroke}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
            animate={{ d: SEQUENCE }}
            transition={{
              duration: 12,
              repeat: Infinity,
              times: [0, 0.25, 0.5, 0.75, 1],
              ease: "easeInOut",
            }}
          />
        ) : (
          <path
            d={d0}
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
