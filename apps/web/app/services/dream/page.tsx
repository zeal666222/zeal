"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandSpinner } from "@zeal/ui";
import {
  Moon, Star, Sparkles, Loader2, RotateCcw, ArrowRight,
  ChevronRight, MessageCircle, Users, Clock, CheckCircle2,
  Zap, Heart, Brain, Compass, Eye, Cloud, Feather, X,
} from "lucide-react";
import { analyzeDream } from "@/lib/dream/analyzer";
import { consumeOpenAIStream } from "@/lib/ai/sse";
import { interpretDream } from "@/lib/dream/interpreter";
import { THEME_INTERPRETATIONS, ARCHETYPE_PROFILES, EMOTION_PROFILES } from "@/lib/dream/knowledge";
import type { DreamAnalysisResult, DreamReading, DreamFocus, DreamReadingSection } from "@/lib/dream/types";
import { DREAM_FOCUS_OPTIONS } from "@/lib/dream/types";
import ParticleBurst from "@/components/ui/ParticleBurst";
import GlowAura from "@/components/ui/GlowAura";
import ShimmerOverlay from "@/components/ui/ShimmerOverlay";

type Phase = "intro" | "input" | "analyzing" | "visualizing" | "reading";

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

const spring = { type: "spring" as const, stiffness: 400, damping: 38 };
const fadeSlide = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };

export default function DreamPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [dreamText, setDreamText] = useState("");
  const [dreamFocus, setDreamFocus] = useState<DreamFocus>("general");
  const [emotions, setEmotions] = useState("");
  const [recurringDream, setRecurringDream] = useState(false);
  const [lucidElements, setLucidElements] = useState("");
  const [analysis, setAnalysis] = useState<DreamAnalysisResult | null>(null);
  const [reading, setReading] = useState<DreamReading | null>(null);
  const [aiSynthesis, setAiSynthesis] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const aiStartRef = useRef(false);

  const reset = () => {
    setPhase("intro");
    setDreamText("");
    setAnalysis(null);
    setReading(null);
    setAiSynthesis("");
    setError(null);
    setScanProgress(0);
    setActiveSectionIdx(0);
    setEmotions("");
    setRecurringDream(false);
    setLucidElements("");
    aiStartRef.current = false;
  };

  const handleSubmit = useCallback(() => {
    if (dreamText.trim().length < 20) {
      setError("Please describe your dream in a bit more detail — at least a few lines.");
      return;
    }
    setError(null);
    setPhase("analyzing");
  }, [dreamText]);

  useEffect(() => {
    if (phase !== "analyzing") return;
    setScanProgress(0);
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 6, 90));
    }, 250);

    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const result = analyzeDream(dreamText);
        setAnalysis(result);
        const dreamReading = interpretDream(result);
        setReading(dreamReading);
        clearInterval(progressInterval);
        setScanProgress(100);
        setTimeout(() => { setPhase("visualizing"); setShowBurst(true); }, 600);
      } catch {
        clearInterval(progressInterval);
        setError("We couldn't interpret the dream. Please tweak the description and try again.");
        setPhase("input");
      }
    })();

    return () => clearInterval(progressInterval);
  }, [phase, dreamText]);

  useEffect(() => {
    if (phase !== "visualizing") return;
    const interval = setInterval(() => {
      setActiveSectionIdx((i) => ((i ?? 0) + 1) % 6);
    }, 2200);
    return () => clearInterval(interval);
  }, [phase]);

  const startAIReading = useCallback(async () => {
    if (!analysis || aiStartRef.current) return;
    aiStartRef.current = true;
    setPhase("reading");
    setShowBurst(true);
    setLoadingAI(true);
    setAiSynthesis("");
    try {
      const res = await fetch("/api/ai/dream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dreamText,
          dreamFocus,
          emotions,
          recurringDream,
          lucidElements,
          analysis,
        }),
      });
      if (res.status === 401) {
        setAiSynthesis("Please sign in to unlock your full AI interpretation — the detailed analysis below is already ready for you.");
        return;
      }
      if (!res.ok || !res.body) throw new Error("AI reading unavailable");
      const full = await consumeOpenAIStream(res, { onDelta: (acc) => setAiSynthesis(acc) });
      if (!full.trim()) throw new Error("Empty AI reading");
    } catch {
      setAiSynthesis("Our AI dream interpreter is briefly unavailable right now. No worries — your detailed analysis is fully ready below, based on computational dream analysis.");
    } finally {
      setLoadingAI(false);
      aiStartRef.current = false;
    }
  }, [analysis, dreamText, dreamFocus, emotions, recurringDream, lucidElements]);

  useEffect(() => {
    if (phase !== "reading") return;
    setLoadingConsultants(true);
    fetch("/api/explore/consultants?category=DREAMS&online=true&limit=4")
      .then((r) => r.json())
      .then((data) => setConsultants(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingConsultants(false));
  }, [phase]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <ParticleBurst active={showBurst} color="#a855f7" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-indigo-600/8 blur-[200px] rounded-full" />
        <div className="absolute bottom-20 right-1/4 w-[500px] h-[500px] bg-purple-500/6 blur-[180px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 blur-[150px] rounded-full" />
        <StarField />
        <FloatingOrbs />
        <DreamSymbolParticles />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-12">
        <HeroHeader phase={phase} onReset={reset} />

        <AnimatePresence mode="wait">
          {phase === "intro" && <IntroPhase key="intro" onStart={() => setPhase("input")} />}
          {phase === "input" && (
            <InputPhase
              key="input"
              dreamText={dreamText}
              setDreamText={setDreamText}
              dreamFocus={dreamFocus}
              setDreamFocus={setDreamFocus}
              emotions={emotions}
              setEmotions={setEmotions}
              recurringDream={recurringDream}
              setRecurringDream={setRecurringDream}
              lucidElements={lucidElements}
              setLucidElements={setLucidElements}
              textRef={textRef}
              onSubmit={handleSubmit}
              error={error}
            />
          )}
          {phase === "analyzing" && <AnalyzingPhase key="analyzing" progress={scanProgress} />}
          {phase === "visualizing" && (
            <VisualizingPhase
              key="visualizing"
              reading={reading}
              activeSectionIdx={activeSectionIdx}
              onContinue={startAIReading}
            />
          )}
          {phase === "reading" && (
            <ReadingPhase
              key="reading"
              reading={reading}
              aiSynthesis={aiSynthesis}
              loadingAI={loadingAI}
              consultants={consultants}
              loadingConsultants={loadingConsultants}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── AMBIENT EFFECTS ────────────────────────────────────────────────────────────

function StarField() {
  const stars = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 5,
    duration: Math.random() * 3 + 2,
  }));

  const shootingStars = [
    { id: 0, delay: 0, duration: 1.2 },
    { id: 1, delay: 8, duration: 1.0 },
    { id: 2, delay: 16, duration: 1.4 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.3, 1] }}
          transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
        />
      ))}
      {shootingStars.map((ss) => (
        <motion.div
          key={`shoot-${ss.id}`}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: "-5%", top: "-5%" }}
          animate={{
            x: ["0vw", "120vw"],
            y: ["0vh", "120vh"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: ss.duration,
            repeat: Infinity,
            delay: ss.delay,
            repeatDelay: 24,
            ease: "easeIn",
          }}
        >
          <div className="absolute w-16 h-px bg-gradient-to-r from-white to-transparent -rotate-45 origin-left" />
        </motion.div>
      ))}
    </div>
  );
}

function FloatingOrbs() {
  const orbs = [
    { x: "10%", y: "20%", size: 80, color: "bg-purple-400/10", duration: 20 },
    { x: "80%", y: "30%", size: 60, color: "bg-blue-400/10", duration: 25 },
    { x: "60%", y: "70%", size: 100, color: "bg-indigo-400/8", duration: 30 },
    { x: "30%", y: "80%", size: 70, color: "bg-pink-400/8", duration: 22 },
  ];

  return (
    <>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${orb.color} blur-xl`}
          style={{ left: orb.x, top: orb.y, width: orb.size, height: orb.size }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -25, 15, 0],
          }}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

function DreamSymbolParticles() {
  const symbols = ["🌙", "✨", "💫", "🌟", "⭐", "🪐", "🌙", "✨", "💫", "🌟"];
  const particles = symbols.map((emoji, i) => ({
    emoji,
    x: 5 + (i * 9.5),
    y: 10 + ((i * 17) % 80),
    duration: 18 + (i % 3) * 6,
    delay: i * 1.8,
  }));

  return (
    <>
      {particles.map((p, i) => (
        <motion.div
          key={`dream-sym-${i}`}
          className="absolute text-sm opacity-20 select-none"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: [0, -30, 10, 0],
            x: [0, 15, -10, 0],
            opacity: [0.1, 0.25, 0.15, 0.1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </>
  );
}

// ─── HERO HEADER ────────────────────────────────────────────────────────────────

function HeroHeader({ phase, onReset }: { phase: Phase; onReset: () => void }) {
  return (
    <div className="text-center mb-10">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4"
      >
        <Moon size={12} /> Completely Free AI Dream Interpretation
      </motion.div>
      <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
        Dream Interpreter
      </h1>
      <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
        Where Jungian depth psychology meets AI — understand the symbolic language of your subconscious
      </p>
      {phase !== "intro" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          type="button"
          onClick={onReset}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-muted-foreground text-xs font-bold hover:text-foreground transition-colors"
        >
          <RotateCcw size={12} /> New Dream
        </motion.button>
      )}
    </div>
  );
}

// ─── INTRO PHASE ────────────────────────────────────────────────────────────────

function IntroPhase({ onStart }: { onStart: () => void }) {
  const features = [
    { icon: Brain, title: "Jungian Analysis", desc: "Archetype detection, shadow work and individuation mapping — drawn from 30+ years of depth psychology" },
    { icon: Eye, title: "Symbol Dictionary", desc: "200+ dream symbols, read through several psychological lenses — Jungian, Gestalt, cognitive" },
    { icon: Sparkles, title: "AI Master Interpreter", desc: "Our AI blends computational analysis with the warmth of an experienced dream therapist" },
    { icon: Feather, title: "Emotional Mapping", desc: "Explore the emotional journey of your dreams — joy, fear, expansion, sadness — and their meaning" },
  ];

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-8">
      <div className="relative mx-auto w-48 h-48">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/30"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4 rounded-full border border-purple-500/20"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute inset-8 rounded-full border border-dotted border-pink-500/15"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-7xl"
          >
            🌙
          </motion.div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-lg"
            style={{
              left: `${50 + 42 * Math.cos((i * Math.PI * 2) / 6)}%`,
              top: `${50 + 42 * Math.sin((i * Math.PI * 2) / 6)}%`,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
          >
            ✨
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ delay: i * 0.12 + 0.3 }}
            className="p-4 rounded-2xl bg-surface/80 backdrop-blur border border-border/60 hover:border-indigo-500/30 transition-colors"
          >
            <f.icon size={20} className="text-indigo-400 mb-2" />
            <h3 className="font-bold text-sm text-foreground">{f.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ delay: 0.8, ...spring }}
        type="button"
        onClick={onStart}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-base shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-shadow active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Moon size={18} /> Share Your Dream <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );
}

// ─── INPUT PHASE ────────────────────────────────────────────────────────────────

function InputPhase({
  dreamText, setDreamText, dreamFocus, setDreamFocus,
  emotions, setEmotions, recurringDream, setRecurringDream,
  lucidElements, setLucidElements, textRef, onSubmit, error,
}: {
  dreamText: string; setDreamText: (s: string) => void;
  dreamFocus: DreamFocus; setDreamFocus: (s: DreamFocus) => void;
  emotions: string; setEmotions: (s: string) => void;
  recurringDream: boolean; setRecurringDream: (b: boolean) => void;
  lucidElements: string; setLucidElements: (s: string) => void;
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: () => void; error: string | null;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      {/* Dream text input */}
      <div>
        <label htmlFor="dream-text" className="text-xs font-bold text-muted-foreground mb-2 block">Describe your dream</label>
        <div className="relative">
          <textarea
            id="dream-text"
            ref={textRef}
            value={dreamText}
            onChange={(e) => setDreamText(e.target.value)}
            placeholder="I was walking through a vast forest when suddenly I saw the trees were made of crystal. Golden light was flowing from the ground, and music drifted from somewhere far above. I began to float in the air..."
            className="w-full h-48 p-4 rounded-2xl bg-surface/80 backdrop-blur border-2 border-border focus:border-indigo-500/50 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none transition-colors"
          />
          <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/50">
            {dreamText.length} characters
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Write down everything you remember — scenes, emotions, colours, people, movements. The more detail, the deeper the interpretation.
        </p>
      </div>

      {/* Focus selector */}
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Analysis focus</label>
        <div className="grid grid-cols-3 gap-2">
          {DREAM_FOCUS_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setDreamFocus(opt.value as DreamFocus)}
              layout
              aria-pressed={dreamFocus === opt.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                dreamFocus === opt.value
                  ? "border-indigo-500 bg-indigo-500/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-indigo-500/30"
              }`}
            >
              <span className="block text-base mb-0.5">{opt.icon}</span>
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-expanded={showAdvanced}
        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight size={14} className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
        More details (optional)
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Emotions */}
            <div>
              <label htmlFor="dream-emotions" className="text-xs font-bold text-muted-foreground mb-2 block">How did this dream make you feel?</label>
              <input
                id="dream-emotions"
                type="text"
                value={emotions}
                onChange={(e) => setEmotions(e.target.value)}
                placeholder="e.g. anxiety, calm, confusion, wonder..."
                className="w-full p-3 rounded-xl bg-surface/80 backdrop-blur border border-border focus:border-indigo-500/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Recurring dream */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={recurringDream}
                aria-label="This is a recurring dream"
                onClick={() => setRecurringDream(!recurringDream)}
                className={`w-10 h-6 rounded-full transition-colors relative focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                  recurringDream ? "bg-indigo-500" : "bg-border"
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white"
                  animate={{ left: recurringDream ? 22 : 4 }}
                  transition={spring}
                />
              </button>
              <span className="text-xs font-bold text-muted-foreground">This is a recurring dream</span>
            </div>

            {/* Lucid elements */}
            <div>
              <label htmlFor="dream-lucid" className="text-xs font-bold text-muted-foreground mb-2 block">Were you aware you were dreaming?</label>
              <input
                id="dream-lucid"
                type="text"
                value={lucidElements}
                onChange={(e) => setLucidElements(e.target.value)}
                placeholder="e.g. I knew I was dreaming and tried to fly..."
                className="w-full p-3 rounded-xl bg-surface/80 backdrop-blur border border-border focus:border-indigo-500/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={dreamText.trim().length < 20}
        whileHover={{ scale: dreamText.trim().length >= 20 ? 1.02 : 1, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-base shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles size={18} /> Interpret My Dream <ArrowRight size={16} />
      </motion.button>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2"
        >
          <X size={14} /> {error}
        </motion.div>
      )}

      {/* Tips */}
      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
        <p className="text-xs font-bold text-indigo-400 mb-2">For a deeper interpretation:</p>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>• Note the key symbols — objects, animals, people, places</p>
          <p>• Describe the emotional tone — fear, calm, or confusion?</p>
          <p>• Record colours, numbers and unusual details</p>
          <p>• Mention it if you have had dreams like this before</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── ANALYZING PHASE ────────────────────────────────────────────────────────────

function AnalyzingPhase({ progress }: { progress: number }) {
  const steps = [
    { label: "Reading your dream story…", threshold: 10 },
    { label: "Extracting symbols…", threshold: 25 },
    { label: "Recognizing themes…", threshold: 40 },
    { label: "Classifying archetypes…", threshold: 55 },
    { label: "Mapping the emotional journey…", threshold: 70 },
    { label: "Preparing the interpretation…", threshold: 85 },
  ];

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6 relative">
      <ShimmerOverlay active={progress > 85} color="rgba(168, 85, 247, 0.12)" />
      <div className="relative mx-auto w-48 h-48">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/30"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4 rounded-full border border-purple-500/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <GlowAura active color="rgba(99, 102, 241, 0.4)" size={120} />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Moon size={48} className="text-indigo-400" />
          </motion.div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-sm"
            style={{
              left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 8)}%`,
              top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 8)}%`,
            }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
          >
            ✨
          </motion.div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-muted-foreground">Analyzing your dream…</span>
          <span className="text-indigo-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const active = progress >= step.threshold;
          const current = progress >= step.threshold && (i === steps.length - 1 || progress < steps[i + 1]!.threshold);
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.3 }}
              className={`flex items-center gap-2 text-xs ${active ? "text-foreground" : "text-muted-foreground/40"}`}
            >
              {active ? (
                <CheckCircle2 size={14} className={current ? "text-indigo-400 animate-pulse" : "text-emerald-400"} />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-current" />
              )}
              {step.label}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── VISUALIZING PHASE ──────────────────────────────────────────────────────────

function VisualizingPhase({
  reading, activeSectionIdx, onContinue,
}: {
  reading: DreamReading | null;
  activeSectionIdx: number;
  onContinue: () => void;
}) {
  if (!reading) return null;
  const sections = reading.sections;
  const currentSection = sections[activeSectionIdx] ?? sections[0]!;

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      {/* Summary card */}
      <div className="relative">
        <GlowAura active color="rgba(99, 102, 241, 0.25)" size={300} className="absolute inset-0" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 backdrop-blur"
        >
          <div className="flex items-center gap-2 mb-3">
            <Moon size={16} className="text-indigo-400" />
            <h3 className="font-bold text-sm text-foreground">Dream Summary</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{reading.summary}</p>
        </motion.div>
      </div>

      {/* Section carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground">Analysis Highlights</h3>
          <span className="text-[10px] text-muted-foreground/60">
            {(activeSectionIdx ?? 0) + 1} / {sections.length}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSectionIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={spring}
            className="p-5 rounded-2xl bg-surface/80 backdrop-blur border border-border/60"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{currentSection.icon}</span>
              <h4 className="font-bold text-sm text-foreground">{currentSection.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3 whitespace-pre-line">
              {currentSection.content.length > 300 ? currentSection.content.slice(0, 300) + "..." : currentSection.content}
            </p>
            {currentSection.insights.length > 0 && (
              <div className="space-y-1">
                {currentSection.insights.slice(0, 3).map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-indigo-400">
                    <Star size={8} className="mt-0.5 shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Section dots */}
        <div className="flex justify-center gap-1.5">
          {sections.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === activeSectionIdx ? "bg-indigo-400 w-6" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="perspective-800">
        <div className="grid grid-cols-3 gap-3">
          <motion.div whileHover={{ rotateY: 5, rotateX: -5, scale: 1.05 }} className="p-3 rounded-xl bg-surface/60 border border-border/40 text-center">
            <p className="text-lg font-black text-indigo-400">{reading.analysis.symbols.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">Symbols</p>
          </motion.div>
          <motion.div whileHover={{ rotateY: 5, rotateX: -5, scale: 1.05 }} className="p-3 rounded-xl bg-surface/60 border border-border/40 text-center">
            <p className="text-lg font-black text-purple-400">{reading.analysis.themes.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">Themes</p>
          </motion.div>
          <motion.div whileHover={{ rotateY: 5, rotateX: -5, scale: 1.05 }} className="p-3 rounded-xl bg-surface/60 border border-border/40 text-center">
            <p className="text-lg font-black text-pink-400">{reading.analysis.archetypes.length}</p>
            <p className="text-[10px] text-muted-foreground font-bold">Archetypes</p>
          </motion.div>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onContinue}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-base shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-shadow active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles size={18} /> Get Your AI Reading <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );
}

// ─── READING PHASE ──────────────────────────────────────────────────────────────

function ReadingPhase({
  reading, aiSynthesis, loadingAI, consultants, loadingConsultants,
}: {
  reading: DreamReading | null;
  aiSynthesis: string;
  loadingAI: boolean;
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
}) {
  if (!reading) return null;

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      {/* AI Synthesis */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 backdrop-blur">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-indigo-400" />
          <h3 className="font-bold text-sm text-foreground">AI Master Interpretation</h3>
          {loadingAI && <BrandSpinner size={14} className="text-indigo-400 ml-auto" />}
        </div>
        {aiSynthesis ? (
          <div className="prose prose-sm prose-invert max-w-none">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiSynthesis}</p>
          </div>
        ) : loadingAI ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-3 rounded-full bg-indigo-500/10"
                animate={{ width: ["60%", "80%", "70%"] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Full sections */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground">Full Interpretation</h3>
        {reading.sections.map((section, i) => (
          <SectionCard key={i} section={section} index={i} />
        ))}
      </div>

      {/* Consultants */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-indigo-400" />
          <h3 className="text-xs font-bold text-foreground">Dream Interpretation Experts</h3>
        </div>
        {loadingConsultants ? (
          <div className="flex items-center justify-center py-6">
            <BrandSpinner size={20} className="text-indigo-400" aria-hidden />
          </div>
        ) : consultants.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {consultants.map((c) => (
              <motion.a
                key={c.id}
                href={`/consultant/${c.id}`}
                aria-label={`View ${c.name}'s profile`}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="block p-3 rounded-xl bg-surface/80 border border-border/60 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.category}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-amber-400">★ {c.rating.toFixed(1)}</span>
                  {c.perMinuteRate && <span className="text-muted-foreground">₹{c.perMinuteRate}/min</span>}
                </div>
              </motion.a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No dream experts online right now</p>
        )}
      </div>
    </motion.div>
  );
}

function SectionCard({ section, index }: { section: DreamReadingSection; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      layout
      transition={{ delay: index * 0.1 }}
      className="p-4 rounded-2xl bg-surface/60 border border-border/40"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{section.icon}</span>
          <h4 className="font-bold text-sm text-foreground">{section.title}</h4>
        </div>
        <ChevronRight
          size={14}
          className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
              {section.insights.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/30">
                  <p className="text-[10px] font-bold text-indigo-400">Key Insights</p>
                  {section.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                      <Star size={8} className="mt-0.5 shrink-0 text-indigo-400" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
