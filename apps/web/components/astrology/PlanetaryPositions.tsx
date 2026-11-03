// ============================================================================
// Planetary Positions Component — Detailed Graha Sthiti
// ============================================================================
// Industry-grade rendering of all planetary positions with signs, houses,
// nakshatras, degrees, retrograde status, and dignities.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const SIGN_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];

const SIGN_COLORS: Record<string, string> = {
  Ar: "#ef4444", Ta: "#22c55e", Ge: "#eab308", Cn: "#94a3b8",
  Le: "#f97316", Vi: "#84cc16", Li: "#ec4899", Sc: "#dc2626",
  Sg: "#8b5cf6", Cp: "#6b7280", Aq: "#3b82f6", Pi: "#06b6d4",
};

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿",
  Jupiter: "♃", Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};

const PLANET_COLORS: Record<string, string> = {
  Sun: "#fbbf24", Moon: "#e5e7eb", Mars: "#ef4444", Mercury: "#22c55e",
  Jupiter: "#eab308", Venus: "#ec4899", Saturn: "#6b7280", Rahu: "#8b5cf6", Ketu: "#f97316",
};

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

export interface DetailedPlanetPosition {
  planet: string;
  sign: string;
  signIndex: number;
  house: number;
  degree: number;
  minute: number;
  second: number;
  absoluteDegree: number;
  nakshatra: string;
  nakshatraPada: number;
  nakshatraLord: string;
  isRetrograde: boolean;
  isCombust?: boolean;
  isExalted?: boolean;
  isDebilitated?: boolean;
  isOwnSign?: boolean;
}

export interface PlanetaryPositionsData {
  planets: DetailedPlanetPosition[];
  ascendant: {
    sign: string;
    signIndex: number;
    degree: number;
    nakshatra: string;
    nakshatraPada: number;
  };
  ayanamsa: number;
}

interface PlanetaryPositionsProps {
  data: PlanetaryPositionsData;
  compact?: boolean;
}

function fmtDeg(deg: number, min: number, sec: number): string {
  return `${deg}°${min.toString().padStart(2, "0")}'${sec.toString().padStart(2, "0")}"`;
}

function getDignity(planet: DetailedPlanetPosition): string[] {
  const dignities: string[] = [];
  if (planet.isRetrograde) dignities.push("R");
  if (planet.isExalted) dignities.push("Ex");
  if (planet.isDebilitated) dignities.push("Deb");
  if (planet.isOwnSign) dignities.push("Own");
  if (planet.isCombust) dignities.push("C");
  return dignities;
}

export function PlanetaryPositions({ data, compact = false }: PlanetaryPositionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  const toggleDetails = (planet: string) => {
    setShowDetails((prev) => ({ ...prev, [planet]: !prev[planet] }));
  };

  const ascSign = SIGN_ABBR[data.ascendant.signIndex] ?? "";
  const ascColor = SIGN_COLORS[ascSign] ?? "#94a3b8";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] via-surface/95 to-amber-500/[0.05] backdrop-blur-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-violet-400/90">
            Graha Sthiti
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors font-semibold"
        >
          {expanded ? "Collapse" : "Expand"}
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* Ascendant */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-surface/60 border border-violet-400/20 p-3 mb-3"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
            Lagna (Ascendant)
          </span>
          <span className="text-[8px] text-violet-400/70 font-semibold">
            Ayanamsa: {data.ayanamsa.toFixed(2)}°
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold"
            style={{ color: ascColor }}
          >
            {ZODIAC_SIGNS[data.ascendant.signIndex]}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {fmtDeg(
              Math.floor(data.ascendant.degree),
              Math.floor((data.ascendant.degree % 1) * 60),
              Math.floor(((data.ascendant.degree % 1) * 60 % 1) * 60)
            )}
          </span>
          <span className="text-[9px] text-violet-400/80 font-semibold ml-auto">
            {data.ascendant.nakshatra} • Pada {data.ascendant.nakshatraPada}
          </span>
        </div>
      </motion.div>

      {/* Planets */}
      <div className="space-y-1.5">
        {data.planets.map((planet, idx) => {
          const signAbbr = SIGN_ABBR[planet.signIndex] ?? "";
          const signColor = SIGN_COLORS[signAbbr] ?? "#94a3b8";
          const planetColor = PLANET_COLORS[planet.planet] ?? "#94a3b8";
          const symbol = PLANET_SYMBOLS[planet.planet] ?? "•";
          const dignities = getDignity(planet);
          const isExpanded = showDetails[planet.planet];

          return (
            <motion.div
              key={planet.planet}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.05 }}
            >
              <button
                onClick={() => !compact && toggleDetails(planet.planet)}
                className={`w-full text-left rounded-xl border transition-all ${
                  isExpanded
                    ? "border-violet-400/30 bg-violet-500/[0.06]"
                    : "border-border/30 bg-surface/40 hover:border-border/50"
                } p-2.5`}
              >
                <div className="flex items-center gap-2">
                  {/* Planet symbol */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: `${planetColor}20`,
                      color: planetColor,
                    }}
                  >
                    {symbol}
                  </div>

                  {/* Planet name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-foreground truncate">
                        {planet.planet}
                      </span>
                      {dignities.map((d) => (
                        <span
                          key={d}
                          className={`text-[7px] font-black px-1 py-0.5 rounded ${
                            d === "R"
                              ? "bg-red-500/20 text-red-400"
                              : d === "Ex"
                              ? "bg-green-500/20 text-green-400"
                              : d === "Deb"
                              ? "bg-orange-500/20 text-orange-400"
                              : d === "Own"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Sign and house */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[9px] font-semibold"
                        style={{ color: signColor }}
                      >
                        {ZODIAC_SIGNS[planet.signIndex]}
                      </span>
                      <span className="text-[8px] text-muted-foreground">
                        H{planet.house}
                      </span>
                      {!compact && (
                        <span className="text-[8px] text-muted-foreground">
                          {fmtDeg(planet.degree, planet.minute, planet.second)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nakshatra */}
                  <div className="text-right">
                    <span className="text-[9px] font-semibold text-violet-400/80">
                      {planet.nakshatra}
                    </span>
                    <div className="text-[7px] text-muted-foreground">
                      Pada {planet.nakshatraPada}
                    </div>
                  </div>

                  {/* Expand icon */}
                  {!compact && (
                    <div className="text-muted-foreground">
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  )}
                </div>
              </button>

              {/* Detailed view */}
              <AnimatePresence>
                {isExpanded && !compact && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-8 mt-1.5 mb-2 rounded-lg bg-surface/30 border border-border/20 p-2.5">
                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div>
                          <span className="text-muted-foreground font-semibold">Absolute Longitude</span>
                          <div className="text-foreground font-bold mt-0.5">
                            {planet.absoluteDegree.toFixed(4)}°
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Nakshatra Lord</span>
                          <div className="text-foreground font-bold mt-0.5">
                            {planet.nakshatraLord}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Sign Lord</span>
                          <div className="text-foreground font-bold mt-0.5">
                            {ZODIAC_SIGNS[planet.signIndex]}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold">House</span>
                          <div className="text-foreground font-bold mt-0.5">
                            {planet.house}
                          </div>
                        </div>
                      </div>

                      {/* Dignities explanation */}
                      {dignities.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/20">
                          <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                            <Info size={8} />
                            <span className="font-semibold">Dignities:</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {planet.isRetrograde && (
                              <span className="text-[7px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">
                                Retrograde (Vakri)
                              </span>
                            )}
                            {planet.isExalted && (
                              <span className="text-[7px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-semibold">
                                Exalted (Ucha)
                              </span>
                            )}
                            {planet.isDebilitated && (
                              <span className="text-[7px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-semibold">
                                Debilitated (Neecha)
                              </span>
                            )}
                            {planet.isOwnSign && (
                              <span className="text-[7px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold">
                                Own Sign (Swa Rashi)
                              </span>
                            )}
                            {planet.isCombust && (
                              <span className="text-[7px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 font-semibold">
                                Combust (Ast)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border/30">
        <div className="flex items-center justify-between text-[8px] text-muted-foreground">
          <span className="font-semibold">System: Vedic (Sidereal)</span>
          <span className="font-semibold">House: Whole Sign</span>
          <span className="font-semibold">Ayanamsa: Lahiri</span>
        </div>
      </div>
    </motion.div>
  );
}
