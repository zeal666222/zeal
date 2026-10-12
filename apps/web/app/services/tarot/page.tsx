"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Loader2, RotateCcw, Sparkles, Star, Eye, Moon, Sun,
  ChevronRight, Zap, Heart, Target, Shuffle, ArrowRight, MessageCircle,
  Users, Clock, CheckCircle2,
} from "lucide-react";
import {
  FULL_DECK, SPREADS, ELEMENT_COLORS, SUIT_GRADIENTS, MAJOR_GRADIENT,
  shuffleDeck,
  type TarotCard, type DrawnCard, type SpreadName, type TarotElement,
} from "@/lib/tarot/deck";

type Phase = "intro" | "spread-select" | "question" | "shuffling" | "picking" | "revealing" | "reading";

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
  single: "One card. One truth. Perfect for daily guidance.",
  three: "Past, Present, Future — the classic timeline reading.",
  love: "Five cards exploring the dynamics of love.",
  celtic: "A focused 5-card Celtic Cross for deep insight.",
};

export default function TarotPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [selectedSpread, setSelectedSpread] = useState<SpreadName>("three");
  const [question, setQuestion] = useState("");
  const [shuffledDeck, setShuffledDeck] = useState<TarotCard[]>([]);
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());
  const [reading, setReading] = useState("");
  const [loadingReading, setLoadingReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setReading("");
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
        await new Promise((r) => setTimeout(r, 700));
        setFlippedSet((prev) => new Set(prev).add(i));
      }
      if (!cancelled) {
        await new Promise((r) => setTimeout(r, 500));
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

    fetch("/api/ai/tarot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards: cardPayload, question: question || undefined }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ reading?: string }>;
      })
      .then((data) => {
        if (!cancelled) setReading(data.reading ?? "Your cards have been drawn.");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to interpret");
      })
      .finally(() => {
        if (!cancelled) setLoadingReading(false);
      });

    return () => { cancelled = true; };
  }, [phase, drawnCards, question]);

  const handleReset = () => {
    setPhase("intro");
    setDrawnCards([]);
    setPickedIndices([]);
    setFlippedSet(new Set());
    setReading("");
    setQuestion("");
    setError(null);
  };

  const spread = SPREADS[selectedSpread];

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
              reading={reading}
              loading={loadingReading}
              error={error}
              question={question}
              consultants={consultants}
              loadingConsultants={loadingConsultants}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
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
            78-card deck · Gamified readings · AI-synthesized interpretations
          </p>
          {phase !== "intro" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={onReset}
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

function FloatingParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-indigo-400/30"
          initial={{
            x: Math.random() * 100 + "%",
            y: Math.random() * 100 + "%",
            opacity: 0,
          }}
          animate={{
            y: [null, -20, 20, -10, 0],
            opacity: [0, 0.6, 0.3, 0.5, 0],
          }}
          transition={{
            duration: 6 + Math.random() * 4,
            delay: Math.random() * 3,
            repeat: Infinity,
            repeatDelay: Math.random() * 2,
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
          Choose a spread, focus your intention, and select your cards from the deck.
          The 78-card Rider-Waite deck awaits.
        </p>
      </div>

      <motion.button
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
          { icon: "✨", label: "Free" },
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
        <p className="text-sm text-muted-foreground mt-1">Each spread reveals a different dimension of insight</p>
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
        <button onClick={onBack} className="px-5 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground">
          Back
        </button>
        <motion.button
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
        <h2 className="text-xl font-bold text-foreground">Focus Your Intention</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {spreadName === "single"
            ? "What guidance do you seek today?"
            : spreadName === "love"
            ? "What question weighs on your heart?"
            : "What would you like the cards to reveal?"}
        </p>
      </div>

      <div className="w-full">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Focus on your question... (optional)"
          rows={3}
          className="w-full rounded-2xl bg-surface/80 backdrop-blur-xl border border-border/60 p-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 resize-none transition-all"
        />
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          You can also draw cards without a question — the cards will speak to your energy
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-5 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground">
          Back
        </button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBegin}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/20 transition-shadow"
        >
          <Shuffle size={14} /> Shuffle & Draw
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
        <p className="text-sm font-medium text-foreground">Shuffling the deck...</p>
        <p className="text-xs text-muted-foreground">78 cards · Randomized · Energized</p>
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
        <h2 className="text-xl font-bold text-foreground">
          {remaining > 0
            ? `Pick ${remaining} more card${remaining > 1 ? "s" : ""}`
            : "All cards selected!"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Trust your intuition — click the cards that call to you
        </p>
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalNeeded }, (_, i) => (
          <div
            key={i}
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
              onClick={() => !isPicked && onPick(i)}
              disabled={isPicked || remaining <= 0}
              className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl border transition-all ${
                isPicked
                  ? "bg-indigo-500/20 border-indigo-500/30"
                  : remaining <= 0
                  ? "bg-surface-raised/50 border-border/30 cursor-not-allowed"
                  : "bg-gradient-to-br from-indigo-600 via-purple-700 to-violet-800 border-white/10 cursor-pointer hover:shadow-xl hover:shadow-purple-500/20"
              }`}
            >
              {!isPicked && remaining > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl opacity-60">✦</span>
                </div>
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
        {deck.length} cards in the spread · Tap to select
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
          Revealing your cards...
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

      <div className="relative" style={{ perspective: "600px" }}>
        <motion.div
          animate={{ rotateY: isFlipped ? 0 : 180 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="relative w-28 h-40 sm:w-32 sm:h-44"
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
            <div className="relative flex flex-col items-center gap-1">
              <motion.span
                animate={isFlipped ? { scale: [0.8, 1.1, 1] } : {}}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-3xl"
                style={{ transform: isReversed ? "rotate(180deg)" : "none" }}
              >
                {card.symbol}
              </motion.span>
              <span className="text-[10px] font-bold text-foreground text-center leading-tight mt-1">
                {card.name}
              </span>
              {isReversed && (
                <span className="text-[8px] font-black uppercase tracking-wider text-rose-400 mt-0.5">
                  Reversed
                </span>
              )}
              <div className={`mt-1 px-2 py-0.5 rounded-full ${elColors.bg} ${elColors.border} border`}>
                <span className={`text-[8px] font-bold uppercase ${elColors.text}`}>
                  {element}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {isFlipped && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
  reading,
  loading,
  error,
  question,
  consultants,
  loadingConsultants,
  onReset,
}: {
  drawnCards: DrawnCard[];
  reading: string;
  loading: boolean;
  error: string | null;
  question: string;
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
  onReset: () => void;
}) {
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
              <span className="text-lg" style={{ transform: d.isReversed ? "rotate(180deg)" : "none", display: "inline-block" }}>
                {d.card.symbol}
              </span>
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

      {/* Error */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm max-w-3xl mx-auto">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !reading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Interpreting the cards...</p>
        </div>
      )}

      {/* Reading */}
      {reading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 max-w-3xl mx-auto"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/[0.04] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
              <Sparkles className="text-indigo-400" /> Your Reading
            </h2>

            {/* Card-by-card breakdown */}
            <div className="space-y-4 mb-6">
              {drawnCards.map((d, i) => {
                const meaning = d.isReversed ? d.card.reversed : d.card.upright;
                const element = d.card.element ?? "air";
                const elColors = ELEMENT_COLORS[element];
                return (
                  <motion.div
                    key={`meaning-${d.card.id}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                    className={`rounded-xl border ${elColors.border} ${elColors.bg} p-4`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base" style={{ transform: d.isReversed ? "rotate(180deg)" : "none", display: "inline-block" }}>
                        {d.card.symbol}
                      </span>
                      <span className="text-xs font-bold text-foreground">{d.card.name}</span>
                      {d.isReversed && (
                        <span className="text-[8px] font-black uppercase text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Reversed</span>
                      )}
                      <span className="text-[8px] font-bold text-muted-foreground ml-auto">{d.position}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{meaning}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* AI synthesis */}
            <div className="border-t border-border/40 pt-6">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Eye size={14} className="text-indigo-400" /> Synthesis
              </h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-[15px]">
                {reading}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Sparkles size={9} className="text-indigo-400" /> AI interpretation</span>
                <span>·</span>
                <span>78-card deck</span>
                <span>·</span>
                <span>Free</span>
              </div>
              <button
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
      {reading && (
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
                <Zap size={18} className="text-indigo-400" /> Go Deeper
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Your reading is just the beginning. Explore further with AI or connect with a live tarot expert.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/services/tarot-consultation"
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-surface/80 border border-border/60 hover:border-indigo-500/30 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                    <MessageCircle size={20} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">AI Tarot Consultant</p>
                    <p className="text-xs text-muted-foreground">Free · Instant deep-dive into your cards</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-indigo-400 transition-colors shrink-0" />
                </a>

                <a
                  href="/explore?category=TAROT"
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-surface/80 border border-border/60 hover:border-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-500/5"
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
                <Users size={14} className="text-purple-400" /> Available Tarot Experts
              </h3>
              {loadingConsultants && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
            </div>

            {consultants.length === 0 && !loadingConsultants ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No tarot experts online right now</p>
                <a
                  href="/explore?category=TAROT"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                >
                  Browse all tarot consultants <ChevronRight size={10} />
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
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-purple-500/30 bg-surface-raised/30 hover:bg-surface-raised/60 transition-all group"
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                        {c.avatar ? (
                          <img src={c.avatar} alt="" className="w-full h-full object-cover" />
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
                <Star size={9} /> 100% Free Reading · No sign-up required
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
