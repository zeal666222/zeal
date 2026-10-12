"use client";

// ============================================================================
// AstrologyReading — Glassmorphism interpretation display with chart viz
// ============================================================================

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Briefcase,
  Heart,
  Activity,
  Moon,
  Clock,
  Gem,
  BarChart3,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
  Star,
  Sunrise,
  Flame,
  Leaf,
  Share2,
  Download,
  Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AstrologyInterpretation {
  overview: string;
  career: string;
  relationships: string;
  health: string;
  spiritual: string;
  dasha: string;
  remedies: string;
  chartSummary: string;
}

export interface PlanetPosition {
  planet: string;
  sign: string;
  signIndex: number;
  house: number;
  degree: number;
  isRetrograde: boolean;
  nakshatra?: string;
}

export interface AstrologyReadingProps {
  interpretation: AstrologyInterpretation;
  chart: Record<string, unknown>;
  ruleBasedInterpretations: string[];
  birthData?: {
    date: string;
    time: string;
    place: string;
  };
  onFollowUp?: (question: string) => void;
  loading?: boolean;
}

// ─── Section config ───────────────────────────────────────────────────────────

interface SectionConfig {
  key: keyof AstrologyInterpretation;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  description: string;
}

const SECTIONS: SectionConfig[] = [
  {
    key: "overview",
    label: "Overview",
    icon: <Sparkles size={18} />,
    gradient: "from-violet-500/20 to-purple-500/20",
    description: "Personality, life path & key themes",
  },
  {
    key: "career",
    label: "Career & Finance",
    icon: <Briefcase size={18} />,
    gradient: "from-amber-500/20 to-orange-500/20",
    description: "Profession, wealth & success timing",
  },
  {
    key: "relationships",
    label: "Relationships",
    icon: <Heart size={18} />,
    gradient: "from-rose-500/20 to-pink-500/20",
    description: "Marriage, partnerships & love",
  },
  {
    key: "health",
    label: "Health",
    icon: <Activity size={18} />,
    gradient: "from-emerald-500/20 to-green-500/20",
    description: "Vitality, vulnerabilities & wellness",
  },
  {
    key: "spiritual",
    label: "Spiritual Path",
    icon: <Moon size={18} />,
    gradient: "from-indigo-500/20 to-blue-500/20",
    description: "Dharma, inner growth & moksha",
  },
  {
    key: "dasha",
    label: "Dasha Period",
    icon: <Clock size={18} />,
    gradient: "from-cyan-500/20 to-teal-500/20",
    description: "Current planetary period & timing",
  },
  {
    key: "remedies",
    label: "Remedies",
    icon: <Gem size={18} />,
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    description: "Mantras, gemstones & rituals",
  },
  {
    key: "chartSummary",
    label: "Chart Summary",
    icon: <BarChart3 size={18} />,
    gradient: "from-slate-500/20 to-gray-500/20",
    description: "Technical chart overview",
  },
];

// ─── South Indian Chart SVG ───────────────────────────────────────────────────

const SIGN_ABBREVIATIONS: Record<string, string> = {
  Aries: "Ari", Taurus: "Tau", Gemini: "Gem", Cancer: "Cnc",
  Leo: "Leo", Virgo: "Vir", Libra: "Lib", Scorpio: "Sco",
  Sagittarius: "Sag", Capricorn: "Cap", Aquarius: "Aq", Pisces: "Pis",
};

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

// South Indian chart is a fixed 4x4 grid with the center 2x2 empty.
// Signs are in fixed positions (Pisces always at top-center).
// Sign indices: 0=Aries, 1=Taurus, ..., 11=Pisces
// Layout:
//   Row 0: [Aquarius(10)] [Pisces(11)] [Aries(0)] [Taurus(1)]
//   Row 1: [Capricorn(9)] [   empty   ] [  empty  ] [Gemini(2)]
//   Row 2: [Sagittarius(8)] [  empty  ] [  empty  ] [Cancer(3)]
//   Row 3: [Scorpio(7)] [Libra(6)] [Virgo(5)] [Leo(4)]
const SOUTH_INDIAN_ORDER = [
  10, 11, 0, 1,
  9, -1, -1, 2,
  8, -1, -1, 3,
  7, 6, 5, 4,
];

function SouthIndianChart({ planets, ascendantSign }: {
  planets: PlanetPosition[];
  ascendantSign: string;
}) {
  const cellSize = 70;
  const gap = 2;
  const totalSize = cellSize * 4 + gap * 5;

  // Group planets by sign
  const planetsBySign = useMemo(() => {
    const map: Record<number, PlanetPosition[]> = {};
    for (let i = 0; i < 12; i++) map[i] = [];
    for (const p of planets) {
      const idx = p.signIndex;
      if (idx !== undefined && map[idx]) {
        map[idx].push(p);
      }
    }
    return map;
  }, [planets]);

  const ascIndex = planets.find((p) => p.planet === "Ascendant")?.signIndex
    ?? Object.keys(SIGN_ABBREVIATIONS).findIndex((s) => s === ascendantSign);

  const renderCell = (signIndex: number, row: number, col: number) => {
    if (signIndex === -1) return null; // Center empty cells

    const x = col * (cellSize + gap) + gap;
    const y = row * (cellSize + gap) + gap;
    const isAscendant = signIndex === ascIndex;
    const signPlanets = planetsBySign[signIndex] ?? [];
    const signName = Object.keys(SIGN_ABBREVIATIONS)[signIndex] ?? "";
    const abbr = SIGN_ABBREVIATIONS[signName] ?? "";

    return (
      <g key={`cell-${row}-${col}`}>
        <rect
          x={x} y={y}
          width={cellSize} height={cellSize}
          rx={6}
          fill={isAscendant ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)"}
          stroke={isAscendant ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.1)"}
          strokeWidth={isAscendant ? 1.5 : 0.5}
        />
        {/* Sign label */}
        <text
          x={x + 4} y={y + 12}
          fill={isAscendant ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.35)"}
          fontSize={9}
          fontFamily="monospace"
        >
          {abbr}
        </text>
        {isAscendant && (
          <text
            x={x + cellSize - 4} y={y + 12}
            fill="rgba(139,92,246,0.7)"
            fontSize={7}
            textAnchor="end"
            fontFamily="monospace"
          >
            Asc
          </text>
        )}
        {/* Planets in this sign */}
        {signPlanets.map((p, i) => (
          <text
            key={p.planet}
            x={x + 6 + (i % 3) * 22}
            y={y + 28 + Math.floor(i / 3) * 14}
            fill={getPlanetColor(p.planet)}
            fontSize={10}
            fontWeight={600}
            fontFamily="monospace"
          >
            {PLANET_GLYPHS[p.planet] ?? p.planet.slice(0, 2)}
            {p.isRetrograde ? "R" : ""}
          </text>
        ))}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      className="w-full max-w-[320px] mx-auto"
      style={{ filter: "drop-shadow(0 0 20px rgba(139,92,246,0.1))" }}
    >
      {/* Outer border */}
      <rect
        x={0} y={0}
        width={totalSize} height={totalSize}
        rx={12}
        fill="rgba(0,0,0,0.2)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
      {/* Render all 16 grid positions */}
      {SOUTH_INDIAN_ORDER.map((signIndex, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        return renderCell(signIndex, row, col);
      })}
    </svg>
  );
}

function getPlanetColor(planet: string): string {
  const colors: Record<string, string> = {
    Sun: "#f59e0b",
    Moon: "#e2e8f0",
    Mars: "#ef4444",
    Mercury: "#22c55e",
    Jupiter: "#eab308",
    Venus: "#ec4899",
    Saturn: "#6366f1",
    Rahu: "#8b5cf6",
    Ketu: "#a855f7",
  };
  return colors[planet] ?? "rgba(255,255,255,0.6)";
}

// ─── Dasha Timeline ───────────────────────────────────────────────────────────

function DashaTimeline({ dasha }: { dasha: Record<string, unknown> | undefined }) {
  if (!dasha) return null;

  const mahadasha = dasha.mahadasha as { planet?: string; startDate?: string; endDate?: string } | undefined;
  const antardasha = dasha.antardasha as { planet?: string; startDate?: string; endDate?: string } | undefined;
  const allMahardashas = dasha.allMahardashas as Array<{ planet: string; startDate: string; endDate: string }> | undefined;

  if (!mahadasha && !allMahardashas) return null;

  const dashaDurations: Record<string, number> = {
    Sun: 6, Moon: 10, Mars: 7, Mercury: 17, Jupiter: 16,
    Venus: 20, Saturn: 19, Rahu: 18, Ketu: 7,
  };

  return (
    <div className="space-y-3">
      {mahadasha && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Sunrise size={14} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Mahadasha</p>
            <p className="font-semibold text-foreground">{mahadasha.planet}</p>
            {mahadasha.startDate && mahadasha.endDate && (
              <p className="text-xs text-muted-foreground">
                {new Date(mahadasha.startDate).toLocaleDateString()} — {new Date(mahadasha.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {antardasha && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Flame size={14} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Antardasha</p>
            <p className="font-semibold text-foreground">{antardasha.planet}</p>
            {antardasha.startDate && antardasha.endDate && (
              <p className="text-xs text-muted-foreground">
                {new Date(antardasha.startDate).toLocaleDateString()} — {new Date(antardasha.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dasha sequence bar */}
      {allMahardashas && allMahardashas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Vimshottari Dasha Sequence</p>
          <div className="flex h-6 rounded-lg overflow-hidden border border-border/50">
            {allMahardashas.map((md, i) => {
              const duration = dashaDurations[md.planet] ?? 10;
              const totalYears = 120;
              const widthPct = (duration / totalYears) * 100;
              const isActive = mahadasha?.planet === md.planet;
              return (
                <div
                  key={`${md.planet}-${i}`}
                  className="relative group flex items-center justify-center text-[8px] font-bold text-white/80 transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: isActive ? getPlanetColor(md.planet) : `${getPlanetColor(md.planet)}44`,
                    borderRight: i < allMahardashas.length - 1 ? "1px solid rgba(0,0,0,0.2)" : "none",
                  }}
                  title={`${md.planet}: ${md.startDate} — ${md.endDate}`}
                >
                  <span className="truncate px-0.5">{PLANET_GLYPHS[md.planet] ?? md.planet.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>120-year cycle</span>
            <span>Total: {allMahardashas.reduce((sum, md) => sum + (dashaDurations[md.planet] ?? 0), 0)} years</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Interpretation Card ──────────────────────────────────────────────────────

function InterpretationCard({ section, content, index }: {
  section: SectionConfig;
  content: string;
  index: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isLong = content.length > 300;
  const showToggle = isLong;
  const displayContent = isLong && !expanded ? content.slice(0, 200) + "..." : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className={`bg-surface backdrop-blur-xl border border-border rounded-2xl overflow-hidden card-lift`}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${section.gradient} px-5 py-4 flex items-center gap-3`}>
        <div className="w-9 h-9 rounded-xl bg-black/20 backdrop-blur flex items-center justify-center text-white">
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm">{section.label}</h3>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
        <Star size={14} className="text-muted-foreground/40" />
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {displayContent}
        </p>
        {showToggle && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Follow-up Input ──────────────────────────────────────────────────────────

function FollowUpInput({ onFollowUp, loading }: {
  onFollowUp?: (question: string) => void;
  loading?: boolean;
}) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    onFollowUp?.(question.trim());
    setQuestion("");
  };

  const suggestions = [
    "When is a good time for career changes?",
    "What does my chart say about marriage timing?",
    "Which gemstone would benefit me?",
    "Explain my Moon sign in detail",
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Ask a follow-up question
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your chart..."
          className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--color-primary)] outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="px-4 py-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuestion(s);
              onFollowUp?.(s);
            }}
            className="px-3 py-1.5 text-xs bg-surface-raised border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-[var(--color-primary)]/30 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AstrologyReading({
  interpretation,
  chart,
  ruleBasedInterpretations,
  birthData,
  onFollowUp,
  loading = false,
}: AstrologyReadingProps) {
  // Extract planet positions from chart for visualization
  const planetPositions = useMemo((): PlanetPosition[] => {
    try {
      const vedic = (chart as { vedic?: { planets?: PlanetPosition[]; ascendant?: { sign: string } } })?.vedic;
      if (vedic?.planets) {
        return vedic.planets;
      }
    } catch {
      // ignore
    }
    return [];
  }, [chart]);

  const ascendantSign = useMemo(() => {
    try {
      const vedic = (chart as { vedic?: { ascendant?: { sign: string } } })?.vedic;
      return vedic?.ascendant?.sign ?? "Aries";
    } catch {
      return "Aries";
    }
  }, [chart]);

  const dasha = useMemo(() => {
    try {
      return (chart as { vedic?: { dasha?: Record<string, unknown> } })?.vedic?.dasha;
    } catch {
      return undefined;
    }
  }, [chart]);

  const [shareToast, setShareToast] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      {birthData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] font-medium text-xs uppercase tracking-widest">
            <Leaf size={12} /> Vedic Chart Reading
          </div>
          <p className="text-sm text-muted-foreground">
            {birthData.date} at {birthData.time} in {birthData.place}
          </p>
          {/* Share / Download stubs */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "My Zeal Astrology Reading", text: interpretation.overview?.slice(0, 100) ?? "" }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href).catch(() => {});
                  setShareToast(true);
                  setTimeout(() => setShareToast(false), 2500);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                         glass-luxury text-muted-foreground hover:text-foreground transition-all btn-premium"
            >
              <Share2 size={12} /> Share reading
            </button>
            <button
              type="button"
              onClick={() => {
                setShareToast(true);
                setTimeout(() => setShareToast(false), 2500);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                         glass-luxury text-muted-foreground hover:text-foreground transition-all btn-premium"
            >
              <Download size={12} /> Download PDF
            </button>
          </div>
          <AnimatePresence>
            {shareToast && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1"
              >
                <Check size={11} /> Link copied to clipboard
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Chart Visualization */}
      {planetPositions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-surface backdrop-blur-xl border border-border rounded-2xl p-6 card-lift"
        >
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4 text-center">
            Rashi Chart (South Indian Style)
          </h3>
          <SouthIndianChart planets={planetPositions} ascendantSign={ascendantSign} />

          {/* Planet legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {planetPositions.map((p) => (
              <span key={p.planet} className="text-[10px] font-mono" style={{ color: getPlanetColor(p.planet) }}>
                {PLANET_GLYPHS[p.planet] ?? p.planet}
                {" "}{p.sign}
                {p.isRetrograde && <span className="text-muted-foreground"> (R)</span>}
                {p.nakshatra && <span className="text-muted-foreground/60"> [{p.nakshatra}]</span>}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Dasha Timeline */}
      {dasha && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface backdrop-blur-xl border border-border rounded-2xl p-5 card-lift"
        >
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Vimshottari Dasha
          </h3>
          <DashaTimeline dasha={dasha} />
        </motion.div>
      )}

      {/* Rule-based interpretations */}
      {ruleBasedInterpretations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-surface backdrop-blur-xl border border-border rounded-2xl p-5"
        >
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
            Classical Rule-Based Insights
          </h3>
          <div className="space-y-2">
            {ruleBasedInterpretations.slice(0, 8).map((rule, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-[var(--color-primary)] mt-0.5 shrink-0">
                  <Star size={10} />
                </span>
                <p className="text-muted-foreground">{rule}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI Interpretation Sections */}
      <div className="grid gap-4">
        {SECTIONS.map((section, i) => {
          const content = interpretation[section.key];
          if (!content) return null;
          return (
            <InterpretationCard
              key={section.key}
              section={section}
              content={content}
              index={i}
            />
          );
        })}
      </div>

      {/* Follow-up Questions */}
      {onFollowUp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-surface backdrop-blur-xl border border-border rounded-2xl p-5"
        >
          <FollowUpInput onFollowUp={onFollowUp} loading={loading} />
        </motion.div>
      )}
    </div>
  );
}
