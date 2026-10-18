"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { fetchAIJson } from "@/lib/ai/json-fetch";
import { BrandSpinner } from "@zeal/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Loader2, RotateCcw, Sparkles, Star, Eye, Moon, Sun,
  ChevronRight, Zap, Heart, Target, Shuffle, ArrowRight, MessageCircle,
  Users, Clock, CheckCircle2, Wand2, Flame, Droplets, Wind, Mountain,
} from "lucide-react";
import {
  FULL_DECK, MAJOR_ARCANA, SPREADS, ELEMENT_COLORS, SUIT_GRADIENTS, MAJOR_GRADIENT, MAJOR_ARCANA_IMAGES,
  shuffleDeck, buildTarotReading,
  type TarotCard, type DrawnCard, type SpreadName, type TarotElement, type TarotReading,
} from "@/lib/tarot/deck";
import { ReadingMarkdown } from "@/components/astrology/ReadingMarkdown";

type Phase = "intro" | "spread-select" | "question" | "shuffling" | "picking" | "revealing" | "reading";

interface CardDetail {
  position: string;
  cardName: string;
  orientation: string;
  coreMeaning: string;
  symbolism: string;
  elementalInfluence: string;
  practicalGuidance: string;
}

interface ParsedReading {
  cardDetails: CardDetail[];
  synthesis: string;
  actionStep: string;
  overallEnergy: string;
}

interface AvailableConsultant {
  id: string;
  name: string;
  avatar: string | null;
  category: string;
  perMinuteRate: number | null;
  rating: number;
  isOnline: boolean;
  specialties: string[];
}

const SPREAD_ICONS: Record<SpreadName, typeof Layers> = {
  single: Sparkles,
  three: Layers,
  love: Heart,
  celtic: Target,
};

const SPREAD_DESCRIPTIONS: Record<SpreadName, string> = {
  single: "One card. One truth. Perfect for everyday guidance.",
  three: "Past, Present, Future — the classic timeline reading.",
  love: "5 cards to understand the depth of love and relationships.",
  celtic: "A focused 5-card Celtic Cross for deeper insight.",
};

const ELEMENT_ICONS: Record<TarotElement, typeof Flame> = {
  fire: Flame,
  water: Droplets,
  air: Wind,
  earth: Mountain,
};

function parseReading(raw: string): ParsedReading | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as ParsedReading;
    if (!parsed.cardDetails || !parsed.synthesis) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function TarotPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [selectedSpread, setSelectedSpread] = useState<SpreadName>("three");
  const [question, setQuestion] = useState("");
  const [shuffledDeck, setShuffledDeck] = useState<TarotCard[]>([]);
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());
  const [parsedReading, setParsedReading] = useState<ParsedReading | null>(null);
  const [loadingReading, setLoadingReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(false);
  const pickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pickTimeoutRef.current) clearTimeout(pickTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "reading" || phase === "revealing") {
      setLoadingConsultants(true);
      fetch("/api/explore/consultants?category=TAROT&online=true&limit=6")
        .then((r) => r.ok ? r.json() : { consultants: [] })
        .then((d) => {
          const items = (d.consultants ?? d.items ?? []) as Record<string, unknown>[];
          setConsultants(
            items.map((c) => ({
              id: String(c.id ?? ""),
              name: String(c.name ?? "Consultant"),
              avatar: (c.avatar as string | null) ?? null,
              category: String(c.category ?? "TAROT"),
              perMinuteRate: typeof c.perMinuteRate === "number" ? c.perMinuteRate : null,
              rating: typeof c.rating === "number" ? c.rating : 4.5,
              isOnline: Boolean(c.isOnline ?? c.is_online),
              specialties: Array.isArray(c.specialties) ? (c.specialties as string[]).slice(0, 3) : [],
            })),
          );
        })
        .catch(() => {})
        .finally(() => setLoadingConsultants(false));
    }
  }, [phase]);

  const handleSpreadSelect = useCallback((name: SpreadName) => {
    setSelectedSpread(name);
    setPhase("question");
  }, []);

  const handleBeginShuffle = useCallback(() => {
    setPhase("shuffling");
    setShuffledDeck(shuffleDeck(FULL_DECK));
    setPickedIndices([]);
    setDrawnCards([]);
    setFlippedSet(new Set());
    setParsedReading(null);
    setError(null);

    setTimeout(() => setPhase("picking"), 1800);
  }, []);

  const handlePickCard = useCallback(
    (deckIndex: number) => {
      if (pickedIndices.includes(deckIndex)) return;
      const spread = SPREADS[selectedSpread];
      const newPicked = [...pickedIndices, deckIndex];
      setPickedIndices(newPicked);

      if (newPicked.length >= spread.count) {
        const positions = spread.positions;
        const drawn: DrawnCard[] = newPicked.map((idx, i) => ({
          card: shuffledDeck[idx]!,
          isReversed: Math.random() < 0.3,
          position: positions[i] ?? `Position ${i + 1}`,
        }));
        setDrawnCards(drawn);
        setTimeout(() => setPhase("revealing"), 600);
      }
    },
    [pickedIndices, selectedSpread, shuffledDeck],
  );

  useEffect(() => {
    if (phase !== "revealing") return;
    let cancelled = false;

    const revealSequential = async () => {
      for (let i = 0; i < drawnCards.length; i++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 800));
        setFlippedSet((prev) => new Set(prev).add(i));
      }
      if (!cancelled) {
        await new Promise((r) => setTimeout(r, 600));
        setPhase("reading");
      }
    };

    void revealSequential();
    return () => { cancelled = true; };
  }, [phase, drawnCards.length]);

  useEffect(() => {
    if (phase !== "reading" || drawnCards.length === 0) return;
    let cancelled = false;
    setLoadingReading(true);

    const cardPayload = drawnCards.map((d) => ({
      name: d.card.name,
      reversed: d.isReversed,
      position: d.position,
    }));

    fetchAIJson<{ reading?: string; error?: string }>(
      "/api/ai/tarot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: cardPayload, question: question || undefined }),
      },
    )
      .then(({ res, data }) => {
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setParsedReading(parseReading(data?.reading ?? ""));
      })
      .catch(() => {
        if (!cancelled) setError("The AI deep-dive couldn't load right now — the traditional pre-coded reading below is still complete.");
      })
      .finally(() => {
        if (!cancelled) setLoadingReading(false);
      });

    return () => { cancelled = true; };
  }, [phase, drawnCards, question, retryKey]);

  const handleReset = () => {
    setPhase("intro");
    setDrawnCards([]);
    setPickedIndices([]);
    setFlippedSet(new Set());
    setParsedReading(null);
    setQuestion("");
    setError(null);
  };

  const handleRetryReading = () => {
    if (loadingReading) return;
    setError(null);
    setRetryKey((k) => k + 1);
  };

  const spread = SPREADS[selectedSpread];

  // Deterministic, pre-coded 78-deck reading — renders instantly and always,
  // independent of AI availability. The AI deep-dive overlays it when it lands.
  const localReading = useMemo(
    () => (drawnCards.length > 0 ? buildTarotReading(drawnCards) : null),
    [drawnCards],
  );

  return (
    <div className="min-h-screen-app pb-16">
      <HeroHeader phase={phase} onReset={handleReset} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
        <AnimatePresence mode="wait">
          {phase === "intro" && <IntroPhase key="intro" onBegin={() => setPhase("spread-select")} />}
          {phase === "spread-select" && (
            <SpreadSelectPhase
              key="spread"
              selected={selectedSpread}
              onSelect={handleSpreadSelect}
              onBack={() => setPhase("intro")}
            />
          )}
          {phase === "question" && (
            <QuestionPhase
              key="question"
              question={question}
              setQuestion={setQuestion}
              spreadName={selectedSpread}
              onBegin={handleBeginShuffle}
              onBack={() => setPhase("spread-select")}
            />
          )}
          {phase === "shuffling" && <ShufflePhase key="shuffle" deckSize={FULL_DECK.length} />}
          {phase === "picking" && (
            <PickingPhase
              key="picking"
              deck={shuffledDeck}
              pickedIndices={pickedIndices}
              totalNeeded={spread.count}
              onPick={handlePickCard}
            />
          )}
          {phase === "revealing" && (
            <RevealPhase key="reveal" drawnCards={drawnCards} flippedSet={flippedSet} />
          )}
          {phase === "reading" && (
            <ReadingPhase
              key="reading"
              drawnCards={drawnCards}
              parsedReading={parsedReading}
              fallback={localReading}
              loading={loadingReading}
              error={error}
              question={question}
              consultants={consultants}
              loadingConsultants={loadingConsultants}
              onReset={handleReset}
              onRetry={handleRetryReading}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Major Arcana Gallery — all 22 cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-black text-foreground">The Major Arcana</h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">22 cards · The Fool's Journey from innocence to enlightenment</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
          {MAJOR_ARCANA.map((card) => {
            const imagePath = MAJOR_ARCANA_IMAGES[card.id];
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: card.number * 0.05 }}
                whileHover={{ y: -8, scale: 1.03 }}
                className="group relative"
              >
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-border/40 bg-surface shadow-lg group-hover:shadow-2xl group-hover:shadow-purple-500/20 transition-all">
                  {imagePath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imagePath}
                      alt={card.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${MAJOR_GRADIENT} flex items-center justify-center`}>
                      <span className="text-5xl">{card.symbol}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-xs font-bold text-center">{card.name}</p>
                    <p className="text-white/70 text-[9px] text-center mt-0.5">{card.keywords.slice(0, 2).join(" · ")}</p>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{card.name}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─── Particle Burst on Card Flip ──────────────────────────────────────────── */

function ParticleBurst({ element, active }: { element: TarotElement; active: boolean }) {
  const colors: Record<TarotElement, string> = {
    fire: "bg-orange-400",
    water: "bg-blue-400",
    air: "bg-yellow-400",
    earth: "bg-emerald-400",
  };
  const particles = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    angle: (i / 16) * Math.PI * 2,
    distance: 40 + Math.random() * 30,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.15,
  })), []);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${colors[element]}`}
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/* ─── Golden Aura on Reveal ────────────────────────────────────────────────── */

function GoldenAura({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.div
      className="absolute -inset-2 rounded-3xl pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.8, 0] }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{
        boxShadow: "0 0 40px 8px rgba(234,179,8,0.4), 0 0 80px 16px rgba(139,92,246,0.2)",
      }}
    />
  );
}

/* ─── Shimmer Overlay ──────────────────────────────────────────────────────── */

function ShimmerOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"
        animate={{ left: "200%" }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

/* ─── Hero Header ──────────────────────────────────────────────────────────── */

function HeroHeader({ phase, onReset }: { phase: Phase; onReset: () => void }) {
  return (
    <div className="relative overflow-hidden border-b border-border/40">
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-indigo-500/[0.06] blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-purple-500/[0.05] blur-[140px] rounded-full pointer-events-none" />
      <FloatingParticles />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <Layers size={12} /> Arcane Divination
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
            Mystic Tarot
          </h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            78-card deck · Interactive reading · AI interpretation — all completely free
          </p>
          {phase !== "intro" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              type="button"
              onClick={onReset}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-4 px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Start Over
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Floating particles background ────────────────────────────────────────── */

// Deterministic per-index pseudo-random: SSR and client must produce the same
// initial style or React 19 hydration mismatches (Math.random() at render = error).
function stableRand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function FloatingParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-indigo-400/30"
          initial={{
            x: stableRand(i, 1) * 100 + "%",
            y: stableRand(i, 2) * 100 + "%",
            opacity: 0,
          }}
          animate={{
            y: [null, -20, 20, -10, 0],
            opacity: [0, 0.6, 0.3, 0.5, 0],
          }}
          transition={{
            duration: 6 + stableRand(i, 3) * 4,
            delay: stableRand(i, 4) * 3,
            repeat: Infinity,
            repeatDelay: stableRand(i, 5) * 2,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Phase 1: Intro ───────────────────────────────────────────────────────── */

function IntroPhase({ onBegin }: { onBegin: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="flex flex-col items-center gap-8 py-12"
    >
      <div className="relative w-40 h-56">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              rotate: [0, -3, 3, 0],
              y: [0, -6, 0],
            }}
            transition={{
              duration: 4,
              delay: i * 0.4,
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-700 shadow-2xl shadow-purple-500/30 flex items-center justify-center border border-white/10"
            style={{
              transform: `rotate(${(i - 1) * 10}deg) translateY(${(i - 1) * -8}px)`,
            }}
          >
            <span className="text-5xl opacity-80">🔮</span>
          </motion.div>
        ))}
      </div>

      <div className="text-center space-y-3 max-w-md">
        <h2 className="text-2xl font-bold text-foreground">Begin Your Reading</h2>
        <p className="text-muted-foreground text-sm">
          Choose a spread, settle into your intention, and pick your cards from the deck.
          The 78-card Rider-Waite deck is waiting for you.
        </p>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBegin}
        className="px-8 py-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/30 transition-all inline-flex items-center gap-3"
      >
        <Sparkles size={22} /> Begin Reading
      </motion.button>

      <div className="grid grid-cols-3 gap-4 max-w-sm text-center">
        {[
          { icon: "🃏", label: "78 Cards" },
          { icon: "🔄", label: "Reversed" },
          { icon: "✨", label: "Completely Free" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Spread Selection ────────────────────────────────────────────── */

function SpreadSelectPhase({
  selected,
  onSelect,
  onBack,
}: {
  selected: SpreadName;
  onSelect: (s: SpreadName) => void;
  onBack: () => void;
}) {
  const entries = Object.entries(SPREADS) as [SpreadName, (typeof SPREADS)[SpreadName]][];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="space-y-6 py-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Spread</h2>
        <p className="text-sm text-muted-foreground mt-1">Every spread opens a new dimension of insight</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {entries.map(([key, sp], idx) => {
          const Icon = SPREAD_ICONS[key];
          const isSelected = selected === key;
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, type: "spring", stiffness: 200, damping: 20 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onSelect(key)}
              className={`relative rounded-2xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                  : "border-border/60 bg-surface/80 backdrop-blur-xl hover:border-indigo-500/30"
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="spread-indicator"
                  className="absolute top-3 right-3"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <CheckCircle2 size={16} className="text-indigo-400" />
                </motion.div>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-indigo-500/20" : "bg-surface-raised"
                }`}>
                  <Icon size={18} className={isSelected ? "text-indigo-400" : "text-muted-foreground"} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{sp.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{sp.count} {sp.count === 1 ? "card" : "cards"}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{SPREAD_DESCRIPTIONS[key]}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex justify-center gap-3">
        <button type="button" onClick={onBack} className="px-5 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground">
          Go Back
        </button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(selected)}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/20 transition-shadow"
        >
          Continue <ChevronRight size={14} />
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Phase 3: Question Input ──────────────────────────────────────────────── */

function QuestionPhase({
  question,
  setQuestion,
  spreadName,
  onBegin,
  onBack,
}: {
  question: string;
  setQuestion: (q: string) => void;
  spreadName: SpreadName;
  onBegin: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="flex flex-col items-center gap-6 py-8 max-w-xl mx-auto"
    >
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        <Moon size={28} className="text-indigo-400" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Focus on Your Intention</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {spreadName === "single"
            ? "What kind of guidance are you seeking today?"
            : spreadName === "love"
            ? "What question is on your heart?"
            : "What do the cards want to reveal for you?"}
        </p>
      </div>

      <div className="w-full">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Center your attention on your question… (optional)"
          aria-label="Write your question (optional)"
          rows={3}
          className="w-full rounded-2xl bg-surface/80 backdrop-blur-xl border border-border/60 p-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 resize-none transition-all"
        />
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          You can pick cards even without a question — the cards will speak to your energy
        </p>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="px-5 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground">
          Go Back
        </button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBegin}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/20 transition-shadow"
        >
          <Shuffle size={14} /> Shuffle &amp; Choose
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Phase 4: Shuffle Animation ───────────────────────────────────────────── */

function ShufflePhase({ deckSize }: { deckSize: number }) {
  const cards = Array.from({ length: Math.min(deckSize, 20) }, (_, i) => i);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-8 py-16"
    >
      <div className="relative w-64 h-40">
        {cards.map((i) => (
          <motion.div
            key={i}
            className="absolute w-14 h-20 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-700 border border-white/10 shadow-lg"
            initial={{
              x: 0,
              y: 0,
              rotate: 0,
              zIndex: 0,
            }}
            animate={{
              x: [
                0,
                (Math.random() - 0.5) * 180,
                (Math.random() - 0.5) * 120,
                (i - cards.length / 2) * 8,
              ],
              y: [
                0,
                (Math.random() - 0.5) * 60,
                (Math.random() - 0.5) * 40,
                0,
              ],
              rotate: [
                0,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 20,
                (i - cards.length / 2) * 2,
              ],
              zIndex: [0, Math.floor(Math.random() * 10), Math.floor(Math.random() * 10), i],
            }}
            transition={{
              duration: 1.8,
              delay: i * 0.02,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex flex-col items-center gap-2"
      >
        <Sparkles size={20} className="text-indigo-400 animate-spin" style={{ animationDuration: "3s" }} />
        <p className="text-sm font-medium text-foreground">Shuffling the cards…</p>
        <p className="text-xs text-muted-foreground">78 cards · Random · Arranged alongside your energy</p>
      </motion.div>
    </motion.div>
  );
}

/* ─── Phase 5: Card Picking ────────────────────────────────────────────────── */

function PickingPhase({
  deck,
  pickedIndices,
  totalNeeded,
  onPick,
}: {
  deck: TarotCard[];
  pickedIndices: number[];
  totalNeeded: number;
  onPick: (index: number) => void;
}) {
  const displayCards = deck.slice(0, Math.min(deck.length, 15));
  const remaining = totalNeeded - pickedIndices.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="flex flex-col items-center gap-6 py-6"
    >
      <div className="text-center">
        <motion.h2
          key={remaining}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="text-xl font-bold text-foreground"
        >
          {remaining > 0
            ? `Choose ${remaining} more cards`
            : "All cards have been chosen!"}
        </motion.h2>
        <p className="text-sm text-muted-foreground mt-1">
          Trust your intuition — pick the cards that feel like they're calling to you
        </p>
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalNeeded }, (_, i) => (
          <motion.div
            key={i}
            animate={i < pickedIndices.length ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className={`w-3 h-3 rounded-full transition-all ${
              i < pickedIndices.length
                ? "bg-indigo-500 shadow-md shadow-indigo-500/50"
                : "bg-surface-raised border border-border/60"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
        {displayCards.map((_, i) => {
          const isPicked = pickedIndices.includes(i);
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 20, rotateY: 180 }}
              animate={{
                opacity: isPicked ? 0.3 : 1,
                y: 0,
                rotateY: 0,
                scale: isPicked ? 0.9 : 1,
              }}
              transition={{
                delay: i * 0.04,
                type: "spring",
                stiffness: 200,
                damping: 18,
              }}
              whileHover={!isPicked ? { y: -8, scale: 1.05 } : {}}
              whileTap={!isPicked ? { scale: 0.95 } : {}}
              type="button"
              aria-label={isPicked ? `Card ${i + 1} chosen` : `Choose card ${i + 1}`}
              onClick={() => !isPicked && onPick(i)}
              disabled={isPicked || remaining <= 0}
              className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isPicked
                  ? "bg-indigo-500/20 border-indigo-500/30"
                  : remaining <= 0
                  ? "bg-surface-raised/50 border-border/30 cursor-not-allowed"
                  : "bg-gradient-to-br from-indigo-600 via-purple-700 to-violet-800 border-white/10 cursor-pointer hover:shadow-xl hover:shadow-purple-500/20"
              }`}
            >
              {!isPicked && remaining > 0 && (
                <>
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                    className="absolute inset-0 rounded-xl bg-indigo-400/10"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl opacity-60">✦</span>
                  </div>
                </>
              )}
              {isPicked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 size={18} className="text-indigo-400" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {deck.length} cards in the spread · Tap to choose
      </p>
    </motion.div>
  );
}

/* ─── Phase 6: Card Reveal ─────────────────────────────────────────────────── */

function RevealPhase({
  drawnCards,
  flippedSet,
}: {
  drawnCards: DrawnCard[];
  flippedSet: Set<number>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="py-6"
    >
      <div className="text-center mb-8">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold text-foreground"
        >
          Revealing your cards…
        </motion.h2>
      </div>

      <div className={`grid gap-6 max-w-4xl mx-auto ${
        drawnCards.length === 1
          ? "grid-cols-1 max-w-xs"
          : drawnCards.length <= 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      }`}>
        {drawnCards.map((drawn, idx) => (
          <CardReveal
            key={`${drawn.card.id}-${idx}`}
            drawn={drawn}
            index={idx}
            isFlipped={flippedSet.has(idx)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function CardReveal({
  drawn,
  index,
  isFlipped,
}: {
  drawn: DrawnCard;
  index: number;
  isFlipped: boolean;
}) {
  const { card, isReversed, position } = drawn;
  const element = card.element ?? "air";
  const elColors = ELEMENT_COLORS[element];
  const gradient = card.arcana === "major" ? MAJOR_GRADIENT : card.suit ? SUIT_GRADIENTS[card.suit] : MAJOR_GRADIENT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 180, damping: 18 }}
      className="flex flex-col items-center gap-3"
    >
      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
        {position}
      </span>

      <div className="relative" style={{ perspective: "800px" }}>
        <GoldenAura active={isFlipped} />

        <motion.div
          animate={{ rotateY: isFlipped ? 0 : 180 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-32 h-44 sm:w-36 sm:h-48"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Back face */}
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-700 to-violet-800 border border-white/10 shadow-xl flex items-center justify-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-3xl opacity-60">✦</span>
          </div>

          {/* Front face */}
          <div
            className="absolute inset-0 rounded-2xl bg-surface/90 backdrop-blur-xl border border-border/60 shadow-xl flex flex-col items-center justify-center p-3 overflow-hidden"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
            <ShimmerOverlay active={isFlipped} />
            <div className="relative flex flex-col items-center gap-1 w-full h-full">
              {card.arcana === "major" && MAJOR_ARCANA_IMAGES[card.id] ? (
                <div className="flex-1 w-full relative overflow-hidden rounded-xl mb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={MAJOR_ARCANA_IMAGES[card.id]}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    style={{ transform: isReversed ? "rotate(180deg)" : "none" }}
                  />
                </div>
              ) : (
                <motion.span
                  animate={isFlipped ? { scale: [0.8, 1.15, 1] } : {}}
                  transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                  className="text-4xl"
                  style={{ transform: isReversed ? "rotate(180deg)" : "none" }}
                >
                  {card.symbol}
                </motion.span>
              )}
              <span className="text-[11px] font-bold text-foreground text-center leading-tight mt-auto">
                {card.name}
              </span>
              {isReversed && (
                <span className="text-[8px] font-black uppercase tracking-wider text-rose-400">
                  Reversed
                </span>
              )}
              <div className={`mt-0.5 px-2 py-0.5 rounded-full ${elColors.bg} ${elColors.border} border`}>
                <span className={`text-[8px] font-bold uppercase ${elColors.text}`}>
                  {element}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <ParticleBurst element={element} active={isFlipped} />
      </div>

      {isFlipped && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center max-w-[140px]"
        >
          <div className="flex flex-wrap justify-center gap-1">
            {card.keywords.slice(0, 2).map((kw) => (
              <span key={kw} className="text-[8px] px-1.5 py-0.5 rounded-full bg-surface-raised text-muted-foreground border border-border/40">
                {kw}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Phase 7: Reading + Consultant CTA ────────────────────────────────────── */

function ReadingPhase({
  drawnCards,
  parsedReading,
  fallback,
  loading,
  error,
  question,
  consultants,
  loadingConsultants,
  onReset,
  onRetry,
}: {
  drawnCards: DrawnCard[];
  parsedReading: ParsedReading | null;
  fallback: TarotReading | null;
  loading: boolean;
  error: string | null;
  question: string;
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
  onReset: () => void;
  onRetry: () => void;
}) {
  const overallEnergy = parsedReading?.overallEnergy || fallback?.overallEnergy;
  const synthesis = parsedReading?.synthesis || fallback?.synthesis || "";
  const actionStep = parsedReading?.actionStep || fallback?.actionStep;
  const hasReading = drawnCards.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      className="space-y-8 py-4"
    >
      {/* Card summary strip */}
      <div className="flex flex-wrap justify-center gap-3">
        {drawnCards.map((d, i) => {
          const element = d.card.element ?? "air";
          const elColors = ELEMENT_COLORS[element];
          return (
            <motion.div
              key={`${d.card.id}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${elColors.bg} ${elColors.border}`}
            >
              {d.card.arcana === "major" && MAJOR_ARCANA_IMAGES[d.card.id] ? (
                <div className="w-8 h-11 rounded overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={MAJOR_ARCANA_IMAGES[d.card.id]}
                    alt={d.card.name}
                    className="w-full h-full object-cover"
                    style={{ transform: d.isReversed ? "rotate(180deg)" : "none" }}
                  />
                </div>
              ) : (
                <span className="text-lg" style={{ transform: d.isReversed ? "rotate(180deg)" : "none", display: "inline-block" }}>
                  {d.card.symbol}
                </span>
              )}
              <div>
                <p className="text-[10px] font-bold text-foreground">{d.card.name}</p>
                <p className={`text-[8px] font-black uppercase ${elColors.text}`}>
                  {d.position} {d.isReversed ? "· Rx" : ""}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {question && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Your question:</p>
          <p className="text-sm text-foreground italic">&ldquo;{question}&rdquo;</p>
        </div>
      )}

      {/* Overall Energy Badge */}
      {overallEnergy && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="flex justify-center"
        >
          <div className="px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-violet-500/15 border border-indigo-500/25">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Energy</span>
            <span className="text-sm font-bold text-foreground">{overallEnergy}</span>
          </div>
        </motion.div>
      )}

      {/* Soft AI-unavailable notice (reading below stays complete) */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-sm max-w-3xl mx-auto text-center"
        >
          <p className="mb-3">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            aria-busy={loading}
            className="px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={12} /> Retry AI Deep-Dive
          </button>
        </motion.div>
      )}

      {/* Reading — deterministic pre-coded always renders; AI overlays it */}
      {hasReading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 max-w-3xl mx-auto"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/[0.04] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="text-indigo-400" /> Your Reading
              </h2>
              {loading && !parsedReading && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider text-indigo-300" role="status">
                  <BrandSpinner size={10} /> AI deep-dive
                </span>
              )}
            </div>

            {/* Card-by-card breakdown */}
            <div className="space-y-5 mb-6">
              {drawnCards.map((d, i) => {
                const element = d.card.element ?? "air";
                const elColors = ELEMENT_COLORS[element];
                const ElementIcon = ELEMENT_ICONS[element];
                const detail = parsedReading?.cardDetails?.[i] ?? fallback?.cardDetails?.[i] ?? null;
                const meaning = d.isReversed ? d.card.reversed : d.card.upright;

                return (
                  <motion.div
                    key={`meaning-${d.card.id}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                    className={`rounded-2xl border ${elColors.border} ${elColors.bg} p-5`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {d.card.arcana === "major" && MAJOR_ARCANA_IMAGES[d.card.id] ? (
                        <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 border border-border/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={MAJOR_ARCANA_IMAGES[d.card.id]}
                            alt={d.card.name}
                            className="w-full h-full object-cover"
                            style={{ transform: d.isReversed ? "rotate(180deg)" : "none" }}
                          />
                        </div>
                      ) : (
                        <span className="text-xl" style={{ transform: d.isReversed ? "rotate(180deg)" : "none", display: "inline-block" }}>
                          {d.card.symbol}
                        </span>
                      )}
                      <span className="text-sm font-bold text-foreground">{d.card.name}</span>
                      {d.isReversed && (
                        <span className="text-[8px] font-black uppercase text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Reversed</span>
                      )}
                      <span className="text-[9px] font-bold text-muted-foreground ml-auto">{d.position}</span>
                    </div>

                    {detail ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">Core Meaning</p>
                          <p className="text-sm text-foreground leading-relaxed">{detail.coreMeaning}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-1">Symbolism</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{detail.symbolism}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <ElementIcon size={14} className={`${elColors.text} mt-0.5 shrink-0`} />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">Elemental Influence</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{detail.elementalInfluence}</p>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1">Guidance</p>
                          <p className="text-sm text-foreground leading-relaxed">{detail.practicalGuidance}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">{meaning}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Synthesis — AI narrative when available, pre-coded otherwise */}
            {synthesis && (
              <div className="border-t border-border/40 pt-6">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Eye size={14} className="text-indigo-400" /> The Full Picture
                </h3>
                <ReadingMarkdown source={synthesis} />
              </div>
            )}

            {/* Action Step */}
            {actionStep && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1.5 flex items-center gap-1.5">
                  <Zap size={10} /> Your Next Step
                </p>
                <p className="text-sm text-foreground leading-relaxed">{actionStep}</p>
              </motion.div>
            )}

            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles size={9} className="text-indigo-400" />
                  {parsedReading ? "AI interpretation" : "Traditional 78-deck meanings"}
                </span>
                <span>·</span>
                <span>78-card deck</span>
                <span>·</span>
                <span>Free</span>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> New Reading
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Go Deeper CTA */}
      {hasReading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 180, damping: 22 }}
          className="space-y-6 max-w-3xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-violet-500/10 border border-indigo-500/20 p-6 sm:p-8">
            <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="relative">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Zap size={18} className="text-indigo-400" /> Want to Go Deeper?
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Your reading is only the beginning. Keep exploring with AI, or connect with a live tarot expert.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/services/tarot-consultation"
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-surface/80 border border-border/60 hover:border-indigo-500/30 hover:-translate-y-0.5 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                    <MessageCircle size={20} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">AI Tarot Consultant</p>
                    <p className="text-xs text-muted-foreground">Free · An instant deep-dive into your cards</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-indigo-400 transition-colors shrink-0" />
                </a>

                <a
                  href="/explore?category=TAROT"
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-surface/80 border border-border/60 hover:border-purple-500/30 hover:-translate-y-0.5 transition-all hover:shadow-lg hover:shadow-purple-500/5"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                    <Users size={20} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Live Tarot Expert</p>
                    <p className="text-xs text-muted-foreground">Connect with a verified tarot reader</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-purple-400 transition-colors shrink-0" />
                </a>
              </div>
            </div>
          </div>

          {/* Available consultants */}
          <div className="rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users size={14} className="text-purple-400" /> Online Tarot Experts
              </h3>
              {loadingConsultants && <BrandSpinner size={12} className="text-muted-foreground" aria-hidden />}
            </div>

            {consultants.length === 0 && !loadingConsultants ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No tarot experts online right now</p>
                <a
                  href="/explore?category=TAROT"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  View all tarot consultants <ChevronRight size={10} />
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {consultants.map((c, i) => (
                  <motion.a
                    key={c.id}
                    href={`/consultant/${c.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-purple-500/30 bg-surface-raised/30 hover:bg-surface-raised/60 transition-all group"
                  >
                    <div className="relative shrink-0">
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                        {c.avatar ? (
                          <Image src={c.avatar} alt="" fill sizes="48px" className="object-cover" />
                        ) : (
                          c.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {c.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <Star size={8} className="text-amber-400 fill-amber-400" />
                          <span className="text-[9px] font-bold text-foreground">{c.rating.toFixed(1)}</span>
                        </div>
                        {c.perMinuteRate !== null && (
                          <span className="text-[9px] text-muted-foreground">₹{c.perMinuteRate}/min</span>
                        )}
                        {c.isOnline && (
                          <span className="text-[8px] font-bold text-emerald-400 flex items-center gap-0.5">
                            <Clock size={7} /> Online
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-muted-foreground group-hover:text-purple-400 transition-colors shrink-0" />
                  </motion.a>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border/30 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-[10px] font-medium">
                <Star size={9} /> Reading Completely Free · No sign-up required
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
