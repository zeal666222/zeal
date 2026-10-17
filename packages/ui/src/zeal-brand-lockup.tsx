"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ZealBrandLockup — the animated brand signature: morphing Z mark + wordmark
// ═──────────────────────────────────────────────────────────────────────────────
// Choreography (all CSS keyframes in ./tokens.css + native SMIL, zero JS):
//   1. halo ring strokes itself in
//   2. the Z draws, then morphs Z → triangle → diamond → square on a 12s loop
//   3. two sparks orbit the mark on counter-rotating paths, twinkling
//   4. "ZEAL" letters rise out of blur with a tracking settle, then a
//      continuous shine sweeps the gradient fill
//   5. a gold hairline rule scales in beneath the word and carries a spark
//   6. hover: the flip accelerates and the letters lift in a wave
// prefers-reduced-motion freezes the whole sequence at its end state.
// ═══════════════════════════════════════════════════════════════════════════════

import { useId, type CSSProperties } from "react";
import { cn } from "./utils";

interface Props {
  size?: number;
  className?: string;
  wordClassName?: string;
  showWordmark?: boolean;
}

// Equal "M … L …" command counts so SMIL interpolates without artifacts.
const Z        = "M 8 10 L 40 10 L 8 38 L 40 38";
const TRIANGLE = "M 24 8 L 40 34 L 8 34 L 40 34";
const DIAMOND  = "M 24 8 L 40 24 L 24 40 L 8 24";
const SQUARE   = "M 8 8 L 40 8 L 40 40 L 8 40";
const MORPH    = `${Z}; ${TRIANGLE}; ${DIAMOND}; ${SQUARE}; ${Z}`;

const LETTERS = ["Z", "E", "A", "L"] as const;

export function ZealBrandLockup({
  size = 34,
  className,
  wordClassName,
  showWordmark = true,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const gradId = `zeal-lockup-grad-${uid}`;
  const glowId = `zeal-lockup-glow-${uid}`;

  return (
    <span className={cn("zeal-lockup", className)}>
      <span className="zeal-mark-shell" style={{ width: size, height: size }}>
        <span className="zeal-mark-flip">
          <span className="zeal-mark-breathe">
            <svg
              viewBox="0 0 48 48"
              width={size}
              height={size}
              fill="none"
              aria-hidden
            >
              <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--zeal-g1)" />
                  <stop offset="45%" stopColor="var(--zeal-g2)" />
                  <stop offset="100%" stopColor="var(--zeal-g3)" />
                </linearGradient>
                <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Halo — strokes itself in once on mount */}
              <circle
                className="zeal-halo"
                cx="24"
                cy="24"
                r="22"
                stroke={`url(#${gradId})`}
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeLinecap="round"
                pathLength={1}
              />

              {/* Orbiting sparks on counter-rotating paths */}
              <g className="zeal-orbit">
                <circle
                  className="zeal-orbit-dot"
                  cx="24"
                  cy="2"
                  r="1.6"
                  fill="var(--zeal-gold)"
                />
              </g>
              <g className="zeal-orbit zeal-orbit--slow">
                <circle
                  className="zeal-orbit-dot"
                  cx="46"
                  cy="24"
                  r="1.1"
                  fill="var(--zeal-g2)"
                  style={{ animationDelay: "1.2s" }}
                />
              </g>

              {/* The mark */}
              <path
                d={Z}
                stroke={`url(#${gradId})`}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowId})`}
              >
                <animate
                  attributeName="d"
                  dur="12s"
                  repeatCount="indefinite"
                  values={MORPH}
                  keyTimes="0; 0.25; 0.5; 0.75; 1"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
                />
              </path>
            </svg>
          </span>
        </span>
      </span>

      {showWordmark && (
        <span className="flex min-w-0 flex-col items-start gap-[3px]">
          <span
            className={cn("zeal-wordmark", wordClassName)}
            aria-hidden
          >
            {LETTERS.map((ch, i) => (
              <span key={ch} className="zeal-letter-hop">
                <span
                  className="zeal-letter"
                  style={{ "--zeal-delay": `${320 + i * 80}ms` } as CSSProperties}
                >
                  {ch}
                </span>
              </span>
            ))}
          </span>
          <span className="zeal-rule w-full" aria-hidden />
        </span>
      )}

      <span className="sr-only">Zeal</span>
    </span>
  );
}
