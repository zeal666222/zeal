"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ZealMark / ZealLockup — the single canonical brand mark
// ═══════════════════════════════════════════════════════════════════════════════
// The mark is an astronomical diagram first, a letter second: the sun's traced
// path inside a 12-house chart wheel, with grahas and a morphing aspect polygon
// around it (geometry lives in ./geometry.ts, choreography in ./tokens.css).
//
// Sizes are not just scaled — they are re-composed. Below 26px the wheel would
// turn to mud, so micro shows only the sun path; the wheel returns at compact
// and the full chart at 46px+. `detail` overrides the tier for hero moments.
//
// Motion is CSS keyframes + native SMIL, never Framer Motion: apps/web and
// packages/ui ship separate framer copies with no shared <LazyMotion>, so `m`
// elements in this package freeze at their initial state.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { cn } from "../utils";
import { ASPECTS, ASPECT_CYCLE, GRAHAS, SUN_PATH, TICK_DIAL, WHEEL } from "./geometry";

export type ZealMarkDetail = "auto" | "micro" | "compact" | "full";
export type ZealMarkTone = "brand" | "mono";

export interface ZealMarkProps {
  size?: number;
  detail?: ZealMarkDetail;
  tone?: ZealMarkTone;
  /** Play the one-shot ignition (wheel draws in, light travels the path). */
  draw?: boolean;
  /** Ambient radiance behind the mark. */
  glow?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const CX = 24;
const CY = 24;

const STROKE: Record<"micro" | "compact" | "full", number> = {
  micro: 5.4,
  compact: 4.9,
  full: 4.2,
};

function tierFor(size: number): "micro" | "compact" | "full" {
  if (size < 26) return "micro";
  if (size < 46) return "compact";
  return "full";
}

/**
 * prefers-reduced-motion cannot stop SMIL declaratively and CSS `animation:
 * none` does not reach `<animate>`, so the chart pauses its own clock. Done
 * post-mount to keep the first client render identical to the server's.
 */
function useChartClock(ref: React.RefObject<SVGSVGElement | null>, running: boolean) {
  useEffect(() => {
    const svg = ref.current;
    if (!svg || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches || !running) svg.pauseAnimations?.();
      else svg.unpauseAnimations?.();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [ref, running]);
}

export function ZealMark({
  size = 34,
  detail = "auto",
  tone = "brand",
  draw = true,
  glow = false,
  title = "Zeal",
  className,
  style,
}: ZealMarkProps) {
  const tier = detail === "auto" ? tierFor(size) : detail;
  const uid = useId().replace(/:/g, "");
  const gradId = `zb-grad-${uid}`;
  const aspectId = `zb-aspect-${uid}`;
  const softId = `zb-soft-${uid}`;
  const svgRef = useRef<SVGSVGElement>(null);

  useChartClock(svgRef, draw);

  const stroke = STROKE[tier];
  const showWheel = tier !== "micro";
  const showChart = tier === "full";
  const grahas = tier === "micro" ? [] : GRAHAS.slice(0, showChart ? 3 : 1);

  const sunStroke = tone === "brand" ? `url(#${gradId})` : "currentColor";

  return (
    <span
      className={cn("zb-mark", className)}
      style={{ width: size, height: size, ...style }}
      role="img"
      aria-label={title}
    >
      {glow && <span aria-hidden className="zb-glow" />}

      <svg
        ref={svgRef}
        className="zb-svg"
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--zeal-g1)" />
            <stop offset="46%" stopColor="var(--zeal-g2)" />
            <stop offset="100%" stopColor="var(--zeal-g3)" />
          </linearGradient>
          <linearGradient id={aspectId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--zeal-gold)" />
            <stop offset="100%" stopColor="var(--zeal-g3)" />
          </linearGradient>
          <filter id={softId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.55" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The chart wheel — 12 houses, cardinal axes struck longer */}
        {showWheel && (
          <g className="zb-dial">
            <circle
              className={draw ? "zb-ring zb-draw" : "zb-ring"}
              cx={CX}
              cy={CY}
              r={WHEEL.ring}
              stroke={`url(#${gradId})`}
              strokeOpacity={0.4}
              strokeWidth={0.7}
              pathLength={1}
            />
            {showChart && (
              <path
                className={draw ? "zb-ticks zb-draw" : "zb-ticks"}
                d={TICK_DIAL}
                stroke="var(--zeal-g2)"
                strokeOpacity={0.6}
                strokeWidth={0.75}
                strokeLinecap="round"
              />
            )}
          </g>
        )}

        {/* The aspect: trikona → shadaspatha → chaturbhuj, always behind the sun */}
        {showChart && (
          <g className="zb-aspect">
            <path
              className={draw ? "zb-aspect-path zb-draw" : "zb-aspect-path"}
              d={ASPECTS.trikona}
              stroke={`url(#${aspectId})`}
              strokeOpacity={0.45}
              strokeWidth={0.6}
              strokeLinejoin="round"
              pathLength={1}
            >
              <animate
                attributeName="d"
                values={ASPECT_CYCLE}
                keyTimes="0; 0.33; 0.66; 1"
                dur="27s"
                begin="1.4s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.65 0 0.35 1; 0.65 0 0.35 1; 0.65 0 0.35 1"
              />
            </path>
          </g>
        )}

        {/* Grahas on non-harmonic periods — the configuration never repeats */}
        {grahas.map((g, i) => (
          <g
            key={i}
            className="zb-orbit"
            style={
              {
                "--zb-t-orbit": g.dur,
                "--zb-dir": i % 2 === 1 ? "reverse" : "normal",
              } as CSSProperties
            }
          >
            <circle
              className="zb-graha"
              cx={CX}
              cy={CY - g.radius}
              r={g.size}
              fill={
                g.fill === "gold"
                  ? "var(--zeal-gold)"
                  : g.fill === "core"
                    ? "var(--zeal-core)"
                    : "var(--zeal-g2)"
              }
              style={{ animationDelay: g.delay } as CSSProperties}
            />
          </g>
        ))}

        {/* The sun's traced path */}
        <path
          className={draw ? "zb-sun zb-draw" : "zb-sun"}
          d={SUN_PATH}
          stroke={sunStroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${softId})`}
          pathLength={1}
        />

        {/* Light travelling the path — once at ignition, then on the ambient loop */}
        {draw && (
          <>
            <path
              className="zb-sheen"
              d={SUN_PATH}
              stroke="var(--zeal-core)"
              strokeWidth={Math.max(1, stroke - 1.6)}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
            <path
              className="zb-sheen zb-sheen--response"
              d={SUN_PATH}
              stroke="var(--zeal-core)"
              strokeWidth={Math.max(1, stroke - 2)}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
          </>
        )}
      </svg>
    </span>
  );
}

const LETTERS = ["Z", "E", "A", "L"] as const;

export interface ZealWordmarkProps {
  className?: string;
  style?: CSSProperties;
}

/** The word rises over its own horizon, one beat apart, then holds a slow shine. */
export function ZealWordmark({ className, style }: ZealWordmarkProps) {
  return (
    <span className={cn("zb-word", className)} style={style} aria-hidden>
      {LETTERS.map((ch, i) => (
        <span key={ch} className="zb-horizon">
          <span className="zb-letter" style={{ "--zb-i": i } as CSSProperties}>
            {ch}
          </span>
        </span>
      ))}
    </span>
  );
}

export interface ZealLockupProps extends Omit<ZealMarkProps, "className" | "style"> {
  showWordmark?: boolean;
  showRule?: boolean;
  className?: string;
  style?: CSSProperties;
  wordClassName?: string;
}

export function ZealLockup({
  showWordmark = true,
  showRule = true,
  className,
  style,
  wordClassName,
  ...markProps
}: ZealLockupProps) {
  return (
    <span className={cn("zb-lockup", className)} style={style}>
      <span className="zb-hit">
        <ZealMark {...markProps} />
      </span>

      {showWordmark && (
        <span className="zb-word-stack">
          <ZealWordmark className={wordClassName} />
          {showRule && <span aria-hidden className="zb-rule" />}
        </span>
      )}

      <span className="sr-only">Zeal</span>
    </span>
  );
}

/**
 * Actuation. Re-keyed by the caller on every press so the one-shot replays;
 * only transform/opacity animate, and the angles are constants — nothing here
 * is random, so server and client always agree.
 */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export function ZealBurst({
  radius = 30,
  className,
}: {
  radius?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("zb-burst", className)}
      style={{ "--zb-spark-r": `${radius}px` } as CSSProperties}
    >
      <span className="zb-burst-ring" />
      {SPARK_ANGLES.map((a) => (
        <span key={a} className="zb-spark" style={{ "--zb-a": `${a}deg` } as CSSProperties} />
      ))}
    </span>
  );
}
