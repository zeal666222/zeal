// ============================================================================
// Divisional Chart Component — D1 to D12 with North Indian Diamond Layout
// ============================================================================
// Renders any divisional chart (Varga) with accurate planetary positions.
// Industry-grade SVG with proper Parashara geometry and neon aesthetic.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";

const DIVISIONAL_CHARTS = [
  { num: 1, name: "Rashi", signification: "Birth Chart" },
  { num: 2, name: "Hora", signification: "Wealth" },
  { num: 3, name: "Drekkana", signification: "Siblings" },
  { num: 4, name: "Chaturthamsa", signification: "Education" },
  { num: 5, name: "Panchamsa", signification: "Children" },
  { num: 6, name: "Shashthamsa", signification: "Health" },
  { num: 7, name: "Saptamsa", signification: "Children" },
  { num: 8, name: "Ashtamsa", signification: "Longevity" },
  { num: 9, name: "Navamsa", signification: "Fortune" },
  { num: 10, name: "Dasamsa", signification: "Career" },
  { num: 11, name: "Rudramsha", signification: "Spiritual" },
  { num: 12, name: "Dwadashamsa", signification: "Parents" },
];

const ZODIAC_SIGNS = [
  "Ar", "Ta", "Ge", "Cn", "Le", "Vi",
  "Li", "Sc", "Sg", "Cp", "Aq", "Pi",
];

const SIGN_COLORS: Record<string, string> = {
  Ar: "#ef4444", Ta: "#22c55e", Ge: "#eab308", Cn: "#94a3b8",
  Le: "#f97316", Vi: "#84cc16", Li: "#ec4899", Sc: "#dc2626",
  Sg: "#8b5cf6", Cp: "#6b7280", Aq: "#3b82f6", Pi: "#06b6d4",
};

const PLANET_ABBR: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

// North Indian diamond geometry
const CX = 100, CY = 80;
const TOP = { x: 100, y: 8 };
const RIGHT = { x: 182, y: 80 };
const BOTTOM = { x: 100, y: 152 };
const LEFT = { x: 18, y: 80 };
const MID = {
  TR: { x: 141, y: 44 },
  BR: { x: 141, y: 116 },
  BL: { x: 59, y: 116 },
  TL: { x: 59, y: 44 },
};

const HOUSE_CENTROIDS = [
  { n: 1, x: 100, y: 26 },
  { n: 2, x: 132, y: 46 },
  { n: 3, x: 155, y: 64 },
  { n: 4, x: 155, y: 98 },
  { n: 5, x: 132, y: 116 },
  { n: 6, x: 100, y: 136 },
  { n: 7, x: 68, y: 116 },
  { n: 8, x: 45, y: 98 },
  { n: 9, x: 45, y: 64 },
  { n: 10, x: 68, y: 46 },
  { n: 11, x: 100, y: 58 },
  { n: 12, x: 100, y: 98 },
];

const PLANET_SLOTS = [
  { dx: -10, dy: 0 },
  { dx: 10, dy: 0 },
  { dx: 0, dy: 9 },
  { dx: -10, dy: 18 },
  { dx: 10, dy: 18 },
];

export interface DivisionalChartData {
  division: number;
  chartName: string;
  ascendantSign: string;
  houses: Array<{ house: number; sign: string }>;
  planets: Array<{
    planet: string;
    sign: string;
    signIndex: number;
    house: number;
    degree: number;
    isRetrograde: boolean;
  }>;
}

interface DivisionalChartViewerProps {
  charts: DivisionalChartData[];
  onClose?: () => void;
}

export function DivisionalChartViewer({ charts, onClose }: DivisionalChartViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const currentChart = charts[currentIndex];
  const chartInfo = DIVISIONAL_CHARTS.find((c) => c.num === currentChart?.division);

  const signOfHouse = useMemo(() => {
    if (!currentChart) return new Map();
    const m = new Map<number, string>();
    for (const h of currentChart.houses) m.set(h.house, h.sign);
    return m;
  }, [currentChart]);

  const planetsByHouse = useMemo(() => {
    if (!currentChart) return new Map();
    const m = new Map<number, typeof currentChart.planets>();
    for (const p of currentChart.planets) {
      const list = m.get(p.house) ?? [];
      list.push(p);
      m.set(p.house, list);
    }
    return m;
  }, [currentChart]);

  const goToPrev = () => setCurrentIndex((i) => (i - 1 + charts.length) % charts.length);
  const goToNext = () => setCurrentIndex((i) => (i + 1) % charts.length);

  if (!currentChart || !chartInfo) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`relative mx-auto ${expanded ? "max-w-md" : "max-w-xs"}`}
    >
      <div className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-b from-surface-sunken/95 to-surface/95 backdrop-blur-xl shadow-2xl shadow-violet-900/20">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-amber-500/[0.03] pointer-events-none" />
        
        {/* Navigation */}
        <div className="absolute top-3 left-3 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={goToPrev}
            className="p-1.5 rounded-full bg-surface/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous chart"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="p-1.5 rounded-full bg-surface/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next chart"
          >
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-full bg-surface/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <Maximize2 size={12} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface/80 border border-border/50 text-muted-foreground hover:text-rose-400 transition-colors"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="relative z-[1] p-4 pb-3">
          {/* Header */}
          <motion.div
            key={currentChart.division}
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center mb-3"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-violet-500/10 to-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-black tracking-widest text-amber-400/90">
                D{currentChart.division} — {chartInfo.name}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1 font-medium">{chartInfo.signification}</p>
          </motion.div>

          {/* Chart indicator */}
          <div className="flex justify-center gap-1 mb-2">
            {charts.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? "bg-amber-400 w-4" : "bg-muted-foreground/30"
                }`}
                aria-label={`Go to chart ${idx + 1}`}
              />
            ))}
          </div>

          {/* SVG Diamond Chart */}
          <motion.svg
            key={`svg-${currentChart.division}`}
            viewBox="0 0 200 160"
            className="w-full h-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <defs>
              <linearGradient id={`div-gold-${currentChart.division}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(212,175,55,0.85)" />
                <stop offset="50%" stopColor="rgba(212,175,55,0.45)" />
                <stop offset="100%" stopColor="rgba(212,175,55,0.75)" />
              </linearGradient>
              <linearGradient id={`div-lagna-${currentChart.division}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.12)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0.03)" />
              </linearGradient>
              <filter id={`div-glow-${currentChart.division}`}>
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Diamond frame */}
            <motion.polygon
              points={`${TOP.x},${TOP.y} ${RIGHT.x},${RIGHT.y} ${BOTTOM.x},${BOTTOM.y} ${LEFT.x},${LEFT.y}`}
              fill="none"
              stroke={`url(#div-gold-${currentChart.division})`}
              strokeWidth="1.5"
              filter={`url(#div-glow-${currentChart.division})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.35, ease: "easeOut" }}
            />

            {/* Axes */}
            <motion.line
              x1={TOP.x} y1={TOP.y} x2={BOTTOM.x} y2={BOTTOM.y}
              stroke={`url(#div-gold-${currentChart.division})`} strokeWidth="0.8" opacity="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            />
            <motion.line
              x1={LEFT.x} y1={LEFT.y} x2={RIGHT.x} y2={RIGHT.y}
              stroke={`url(#div-gold-${currentChart.division})`} strokeWidth="0.8" opacity="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            />

            {/* Inner diagonals */}
            {([
              [TOP, MID.BR], [TOP, MID.BL],
              [RIGHT, MID.TL], [RIGHT, MID.BL],
              [BOTTOM, MID.TL], [BOTTOM, MID.TR],
              [LEFT, MID.TR], [LEFT, MID.BR],
            ] as const).map(([a, b], i) => (
              <motion.line
                key={`d${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={`url(#div-gold-${currentChart.division})`} strokeWidth="0.5" opacity="0.25"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.8 + i * 0.04 }}
              />
            ))}

            {/* H1 Lagna highlight */}
            <motion.polygon
              points={`${TOP.x},${TOP.y} ${MID.TR.x},${MID.TR.y} ${MID.TL.x},${MID.TL.y}`}
              fill={`url(#div-lagna-${currentChart.division})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            />

            {/* House labels */}
            {HOUSE_CENTROIDS.map(({ n, x, y }) => {
              const sign = signOfHouse.get(n) ?? "";
              const sIdx = ZODIAC_SIGNS.findIndex(
                (s) => sign.toLowerCase().startsWith(s.toLowerCase()),
              );
              const color = sIdx >= 0 ? SIGN_COLORS[ZODIAC_SIGNS[sIdx] ?? ""] : undefined;

              return (
                <motion.g
                  key={n}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.05 + n * 0.04, type: "spring", stiffness: 300 }}
                >
                  <text
                    x={x} y={y - 5}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="rgba(148,163,184,0.45)"
                    fontSize="4.5" fontWeight="700"
                  >
                    {n}
                  </text>
                  {sIdx >= 0 && (
                    <text
                      x={x} y={y + 3}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={color ?? "rgba(212,175,55,0.7)"}
                      fontSize={expanded ? "6" : "5.5"}
                      fontWeight="800"
                    >
                      {ZODIAC_SIGNS[sIdx]}
                    </text>
                  )}
                  {n === 1 && (
                    <text
                      x={x} y={y + 11}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="rgba(139,92,246,0.7)"
                      fontSize="3.5" fontWeight="800" letterSpacing="0.4"
                    >
                      LAGNA
                    </text>
                  )}
                </motion.g>
              );
            })}

            {/* Planets */}
            {currentChart.planets.map((planet, idx) => {
              const house = planetsByHouse.get(planet.house) ?? [];
              const pIdx = house.findIndex((p: typeof planet) => p.planet === planet.planet);
              const slot = PLANET_SLOTS[pIdx] ?? PLANET_SLOTS[0]!;
              const centroid = HOUSE_CENTROIDS.find((h) => h.n === planet.house);
              if (!centroid) return null;
              const px = centroid.x + slot.dx;
              const py = centroid.y + slot.dy + (expanded ? 4 : 2);

              return (
                <motion.g
                  key={planet.planet}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 1.4 + idx * 0.07,
                    type: "spring",
                    stiffness: 260,
                  }}
                >
                  <text
                    x={px} y={py}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="rgba(255,255,255,0.88)"
                    fontSize={expanded ? "5" : "4.5"}
                    fontWeight="700"
                  >
                    {PLANET_ABBR[planet.planet] ?? planet.planet.slice(0, 2)}
                  </text>
                  {planet.isRetrograde && (
                    <circle
                     x={px + (expanded ? 7 : 6)} cy={py - 2}
                     x1={px + (expanded ? 7 : 6)} y1={py - 2}
                      x2={px + (expanded ? 7 : 6)} y2={py - 2}
                      r="1.8"
                      fill="none"
                      stroke="rgba(239,68,68,0.6)"
                      strokeWidth="0.5"
                    />
                  )}
                </motion.g>
              );
            })}
          </motion.svg>

          {/* Chart info */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.9 }}
            className="mt-3 text-center"
          >
            <p className="text-[9px] text-muted-foreground/70 font-medium">
              D{currentChart.division} • {chartInfo.name} • {chartInfo.signification}
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
