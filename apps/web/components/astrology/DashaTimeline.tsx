// ============================================================================
// Dasha Timeline Component — Vimshottari Dasha Visualization
// ============================================================================
// Renders the complete dasha timeline with mahadasha, antardasha, and pratyantardasha.
// Industry-grade with animated timeline, color-coded periods, and precise dates.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, TrendingUp } from "lucide-react";

const DASHA_COLORS: Record<string, string> = {
  Sun: "#ef4444",
  Moon: "#3b82f6",
  Mars: "#dc2626",
  Mercury: "#22c55e",
  Jupiter: "#eab308",
  Venus: "#ec4899",
  Saturn: "#6b7280",
  Rahu: "#8b5cf6",
  Ketu: "#f97316",
};

const DASHA_YEARS: Record<string, number> = {
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Mercury: 17,
  Jupiter: 16,
  Venus: 20,
  Saturn: 19,
  Rahu: 18,
  Ketu: 7,
};

export interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  years: number;
  antardashas?: Array<{
    planet: string;
    startDate: string;
    endDate: string;
    years: number;
  }>;
}

export interface DashaTimelineData {
  mahadashas: DashaPeriod[];
  currentMahadasha: string;
  currentAntardasha: string;
  yearsRemaining: number;
}

interface DashaTimelineProps {
  data: DashaTimelineData;
  compact?: boolean;
}

export function DashaTimeline({ data, compact = false }: DashaTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMahadasha, setSelectedMahadasha] = useState<string | null>(null);

  const totalYears = useMemo(() => {
    return data.mahadashas.reduce((sum, md) => sum + md.years, 0);
  }, [data.mahadashas]);

  const currentMahadashaData = useMemo(() => {
    return data.mahadashas.find((md) => md.planet === data.currentMahadasha);
  }, [data.mahadashas, data.currentMahadasha]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };

  if (compact && !expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.08] via-surface/95 to-violet-500/[0.05] backdrop-blur-xl p-3 cursor-pointer hover:border-amber-400/30 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
              Current Dasha
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground font-semibold">
            {data.yearsRemaining.toFixed(1)} yrs left
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: DASHA_COLORS[data.currentMahadasha] }}
          />
          <span className="text-xs font-bold text-foreground">
            {data.currentMahadasha}
          </span>
          <span className="text-[10px] text-muted-foreground">→</span>
          <span className="text-xs font-semibold text-foreground/80">
            {data.currentAntardasha}
          </span>
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-surface/60 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1, delay: 0.3 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${DASHA_COLORS[data.currentMahadasha]}80, ${DASHA_COLORS[data.currentAntardasha]}80)`,
            }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.08] via-surface/95 to-violet-500/[0.05] backdrop-blur-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
            Vimshottari Dasha
          </span>
        </div>
        {!compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors font-semibold"
          >
            Collapse
          </button>
        )}
      </div>

      {/* Current Dasha Highlight */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-surface/60 border border-amber-400/20 p-3 mb-4"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
            Running Period
          </span>
          <span className="text-[10px] font-bold text-amber-400">
            {data.yearsRemaining.toFixed(1)} years remaining
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: DASHA_COLORS[data.currentMahadasha] }}
          />
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-foreground">
                {data.currentMahadasha}
              </span>
              <span className="text-[10px] text-muted-foreground">Mahadasha</span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xs font-semibold text-foreground/80">
                {data.currentAntardasha}
              </span>
              <span className="text-[9px] text-muted-foreground">Antardasha</span>
            </div>
          </div>
        </div>

        {currentMahadashaData && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{formatDate(currentMahadashaData.startDate)}</span>
              <span className="font-semibold text-amber-400/80">
                {currentMahadashaData.years} years
              </span>
              <span>{formatDate(currentMahadashaData.endDate)}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Timeline */}
      <div className="space-y-2">
        {data.mahadashas.map((md, idx) => {
          const isCurrent = md.planet === data.currentMahadasha;
          const isSelected = selectedMahadasha === md.planet;
          const percentage = (md.years / totalYears) * 100;

          return (
            <motion.div
              key={md.planet}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + idx * 0.05 }}
            >
              <button
                onClick={() => setSelectedMahadasha(isSelected ? null : md.planet)}
                className={`w-full text-left rounded-xl border transition-all ${
                  isCurrent
                    ? "border-amber-400/40 bg-amber-500/[0.08]"
                    : isSelected
                    ? "border-violet-400/30 bg-violet-500/[0.06]"
                    : "border-border/30 bg-surface/40 hover:border-border/50"
                } p-2.5`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: DASHA_COLORS[md.planet] }}
                  />
                  <span className="text-[11px] font-bold text-foreground flex-1">
                    {md.planet}
                  </span>
                  {isCurrent && (
                    <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">
                      Current
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    {md.years} yrs
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full bg-surface/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, delay: 0.5 + idx * 0.05 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: DASHA_COLORS[md.planet] }}
                  />
                </div>

                <div className="flex items-center justify-between mt-1.5 text-[8px] text-muted-foreground">
                  <span>{formatDate(md.startDate)}</span>
                  <span>{formatDate(md.endDate)}</span>
                </div>
              </button>

              {/* Antardashas */}
              <AnimatePresence>
                {isSelected && md.antardashas && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 mt-2 space-y-1">
                      {md.antardashas.map((ad) => {
                        const isCurrentAD =
                          isCurrent && ad.planet === data.currentAntardasha;
                        return (
                          <div
                            key={ad.planet}
                            className={`rounded-lg border px-2 py-1.5 ${
                              isCurrentAD
                                ? "border-amber-400/30 bg-amber-500/[0.06]"
                                : "border-border/20 bg-surface/30"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: DASHA_COLORS[ad.planet] }}
                              />
                              <span className="text-[9px] font-semibold text-foreground flex-1">
                                {ad.planet}
                              </span>
                              {isCurrentAD && (
                                <TrendingUp size={8} className="text-amber-400" />
                              )}
                              <span className="text-[8px] text-muted-foreground">
                                {ad.years.toFixed(1)} yrs
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5 text-[7px] text-muted-foreground">
                              <span>{formatDate(ad.startDate)}</span>
                              <span>{formatDate(ad.endDate)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border/30">
        <div className="flex flex-wrap gap-2">
          {Object.entries(DASHA_COLORS).map(([planet, color]) => (
            <div key={planet} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[7px] text-muted-foreground font-semibold">{planet}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
