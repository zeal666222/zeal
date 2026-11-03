// ============================================================================
// Chat Kundali Chart — Premium North Indian (Diamond) Birth Chart
// ============================================================================
// Renders a deterministic, animated kundali chart as the first message in chat.
// All planetary positions come from the @zeal/astrology engine (VSOP87 + ELP2000,
// Lahiri ayanamsa, whole-sign bhavas) — never fabricated.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Sparkles } from "lucide-react";

const ZODIAC_SIGNS = [
  "Ar", "Ta", "Ge", "Cn", "Le", "Vi",
  "Li", "Sc", "Sg", "Cp", "Aq", "Pi",
];

const SIGN_FULL_NAMES: Record<string, string> = {
  Ar: "Aries", Ta: "Taurus", Ge: "Gemini", Cn: "Cancer",
  Le: "Leo", Vi: "Virgo", Li: "Libra", Sc: "Scorpio",
  Sg: "Sagittarius", Cp: "Capricorn", Aq: "Aquarius", Pi: "Pisces",
};

const PLANET_ABBR: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

const SIGN_COLORS: Record<string, string> = {
  Ar: "#ef4444", Ta: "#22c55e", Ge: "#eab308", Cn: "#94a3b8",
  Le: "#f97316", Vi: "#84cc16", Li: "#ec4899", Sc: "#dc2626",
  Sg: "#8b5cf6", Cp: "#6b7280", Aq: "#3b82f6", Pi: "#06b6d4",
};

// North Indian diamond geometry (viewBox 200×160)
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

// House label positions — centroid of each region
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

// Planet slot offsets within a house region
const PLANET_SLOTS = [
  { dx: -10, dy: 0 },
  { dx: 10, dy: 0 },
  { dx: 0, dy: 9 },
  { dx: -10, dy: 18 },
  { dx: 10, dy: 18 },
];

function fmtDeg(d: number): string {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}\u00B0${min.toString().padStart(2, "0")}\u2032`;
}

export interface ChatKundaliData {
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
  nakshatra: string;
  dasha: {
    mahadasha: string;
    antardasha: string;
    remaining: number;
  };
}

interface ChatKundaliChartProps {
  data: ChatKundaliData;
  seekerName?: string;
  onClose?: () => void;
}

export function ChatKundaliChart({ data, seekerName, onClose }: ChatKundaliChartProps) {
  const [expanded, setExpanded] = useState(false);

  const signOfHouse = useMemo(() => {
    const m = new Map<number, string>();
    for (const h of data.houses) m.set(h.house, h.sign);
    return m;
  }, [data.houses]);

  const planetsByHouse = useMemo(() => {
    const m = new Map<number, typeof data.planets>();
    for (const p of data.planets) {
      const list = m.get(p.house) ?? [];
      list.push(p);
      m.set(p.house, list);
    }
    return m;
  }, [data.planets]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className={`relative mx-auto ${expanded ? "max-w-md" : "max-w-xs"}`}
      >
        {/* Glass card */}
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-b from-surface-sunken/95 to-surface/95 backdrop-blur-xl shadow-2xl shadow-violet-900/20">
          {/* Ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-amber-500/[0.03] pointer-events-none" />
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -right-20 w-40 h-40 bg-amber-400/[0.06] rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-16 -left-16 w-32 h-32 bg-violet-400/[0.06] rounded-full blur-3xl pointer-events-none"
          />

          {/* Close + expand buttons */}
          <div className="absolute top-3 right-3 z-10 flex gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-full bg-surface/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={expanded ? "Collapse chart" : "Expand chart"}
            >
              <Maximize2 size={12} />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-surface/80 border border-border/50 text-muted-foreground hover:text-rose-400 transition-colors"
                aria-label="Close chart"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="relative z-[1] p-4 pb-3">
            {/* Header */}
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-center mb-3"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-violet-500/10 to-amber-500/10 border border-amber-500/20">
                <Sparkles size={10} className="text-amber-400" />
                <span className="text-[10px] font-black tracking-widest text-amber-400/90">JANAM KUNDALI</span>
              </div>
              {seekerName && (
                <p className="text-xs text-muted-foreground mt-1.5 font-medium">{seekerName}</p>
              )}
            </motion.div>

            {/* SVG Diamond Chart */}
            <motion.svg
              viewBox="0 0 200 160"
              className="w-full h-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <defs>
                <linearGradient id="ck-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(212,175,55,0.85)" />
                  <stop offset="50%" stopColor="rgba(212,175,55,0.45)" />
                  <stop offset="100%" stopColor="rgba(212,175,55,0.75)" />
                </linearGradient>
                <linearGradient id="ck-lagna" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.12)" />
                  <stop offset="100%" stopColor="rgba(139,92,246,0.03)" />
                </linearGradient>
                <filter id="ck-glow">
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
                stroke="url(#ck-gold)"
                strokeWidth="1.5"
                filter="url(#ck-glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.35, ease: "easeOut" }}
              />

              {/* Vertical axis */}
              <motion.line
                x1={TOP.x} y1={TOP.y} x2={BOTTOM.x} y2={BOTTOM.y}
                stroke="url(#ck-gold)" strokeWidth="0.8" opacity="0.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              />

              {/* Horizontal axis */}
              <motion.line
                x1={LEFT.x} y1={LEFT.y} x2={RIGHT.x} y2={RIGHT.y}
                stroke="url(#ck-gold)" strokeWidth="0.8" opacity="0.5"
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
                  stroke="url(#ck-gold)" strokeWidth="0.5" opacity="0.25"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 + i * 0.04 }}
                />
              ))}

              {/* H1 Lagna highlight */}
              <motion.polygon
                points={`${TOP.x},${TOP.y} ${MID.TR.x},${MID.TR.y} ${MID.TL.x},${MID.TL.y}`}
                fill="url(#ck-lagna)"
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
              {data.planets.map((planet: ChatKundaliData["planets"][number], idx: number) => {
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
                        cx={px + (expanded ? 7 : 6)} cy={py - 2}
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

            {/* Quick info cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.9 }}
              className="grid grid-cols-2 gap-2 mt-3"
            >
              <div className="rounded-xl bg-violet-500/[0.06] border border-violet-400/10 px-2.5 py-2">
                <p className="text-[9px] text-muted-foreground/70 font-semibold uppercase tracking-wider">Nakshatra</p>
                <p className="text-[11px] font-bold text-foreground mt-0.5 truncate">{data.nakshatra}</p>
              </div>
              <div className="rounded-xl bg-amber-500/[0.06] border border-amber-400/10 px-2.5 py-2">
                <p className="text-[9px] text-muted-foreground/70 font-semibold uppercase tracking-wider">Current Dasha</p>
                <p className="text-[11px] font-bold text-foreground mt-0.5 truncate">
                  {data.dasha.mahadasha} / {data.dasha.antardasha}
                </p>
              </div>
            </motion.div>

            {/* Expanded details */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  {/* Dasha detail */}
                  <div className="mt-3 rounded-xl bg-surface/60 border border-border/50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-semibold">Running Period</span>
                      <span className="text-[10px] font-bold text-amber-400/80">
                        {data.dasha.remaining.toFixed(1)} yrs left
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-bold text-violet-400">{data.dasha.mahadasha}</span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-xs font-bold text-amber-400/80">{data.dasha.antardasha}</span>
                    </div>
                  </div>

                  {/* Planetary positions table */}
                  <div className="mt-3 rounded-xl bg-surface/60 border border-border/50 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/30">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Graha Sthiti
                      </span>
                    </div>
                    <div className="divide-y divide-border/20">
                      {data.planets.map((p: ChatKundaliData["planets"][number], i: number) => {
                        const signAbbr = ZODIAC_SIGNS[p.signIndex] ?? "";
                        const sColor = SIGN_COLORS[signAbbr] ?? "#94a3b8";
                        return (
                          <div key={p.planet} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="text-[11px] font-bold text-foreground w-14 truncate">
                              {p.planet}
                              {p.isRetrograde && (
                                <span className="text-red-400 ml-0.5 text-[8px] font-black">R</span>
                              )}
                            </span>
                            <span
                              className="text-[10px] font-semibold w-12"
                              style={{ color: sColor }}
                            >
                              {SIGN_FULL_NAMES[signAbbr] ?? p.sign}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex-1 text-right">
                              {fmtDeg(p.degree)} · H{p.house}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2 }}
              className="text-center text-[8px] text-muted-foreground/50 mt-2.5 font-medium"
            >
              Computed from your birth details · VSOP87 + Lahiri ayanamsa
            </motion.p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
