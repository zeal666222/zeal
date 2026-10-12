"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon, Star, Sparkles, Loader2, RotateCcw, ArrowRight,
  ChevronRight, MessageCircle, Users, Clock, CheckCircle2,
  Zap, Heart, Brain, Compass, Eye, Cloud, Feather, X,
} from "lucide-react";
import { analyzeDream } from "@/lib/dream/analyzer";
import { interpretDream } from "@/lib/dream/interpreter";
import { THEME_INTERPRETATIONS, ARCHETYPE_PROFILES, EMOTION_PROFILES } from "@/lib/dream/knowledge";
import type { DreamAnalysisResult, DreamReading, DreamFocus, DreamReadingSection } from "@/lib/dream/types";
import { DREAM_FOCUS_OPTIONS } from "@/lib/dream/types";

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
  const textRef = useRef<HTMLTextAreaElement>(null);

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
  };

  const handleSubmit = useCallback(() => {
    if (dreamText.trim().length < 20) {
      setError("Please describe your dream in more detail — at least a few sentences.");
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
        setTimeout(() => setPhase("visualizing"), 600);
      } catch (err) {
        clearInterval(progressInterval);
        setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
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
    if (!analysis) return;
    setPhase("reading");
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
      if (!res.ok || !res.body) throw new Error("AI reading unavailable");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          full += data;
          setAiSynthesis(full);
        }
      }
    } catch {
      setAiSynthesis("The AI dream interpreter is momentarily unavailable. Your detailed analysis below is still complete and accurate based on the computational dream analysis.");
    } finally {
      setLoadingAI(false);
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
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-indigo-600/8 blur-[200px] rounded-full" />
        <div className="absolute bottom-20 right-1/4 w-[500px] h-[500px] bg-purple-500/6 blur-[180px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 blur-[150px] rounded-full" />
        <StarField />
        <FloatingOrbs />
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
        <Moon size={12} /> Free AI Dream Interpretation
      </motion.div>
      <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
        Dream Interpreter
      </h1>
      <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
        Jungian depth psychology meets AI — decode the symbolic language of your unconscious mind
      </p>
      {phase !== "intro" && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onReset}
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
    { icon: Brain, title: "Jungian Analysis", desc: "Archetype detection, shadow work, and individuation mapping from 30+ years of depth psychology" },
    { icon: Eye, title: "Symbol Dictionary", desc: "200+ dream symbols interpreted through multiple psychological lenses — Jungian, Gestalt, cognitive" },
    { icon: Sparkles, title: "AI Master Interpreter", desc: "Our AI combines computational analysis with the warmth of an experienced dream therapist" },
    { icon: Feather, title: "Emotional Mapping", desc: "Track the emotional landscape of your dreams — joy, fear, awe, sadness — and what they reveal" },
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
        transition={{ delay: 0.8, ...spring }}
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
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Describe your dream</label>
        <div className="relative">
          <textarea
            ref={textRef}
            value={dreamText}
            onChange={(e) => setDreamText(e.target.value)}
            placeholder="I was walking through a vast forest when I noticed the trees were made of crystal. A golden light was pulsing from the ground, and I could hear music coming from somewhere above. I started to float..."
            className="w-full h-48 p-4 rounded-2xl bg-surface/80 backdrop-blur border-2 border-border focus:border-indigo-500/50 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none transition-colors"
          />
          <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/50">
            {dreamText.length} characters
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Write as much detail as you can remember — scenes, emotions, colors, people, actions. The more detail, the deeper the interpretation.
        </p>
      </div>

      {/* Focus selector */}
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Interpretation focus</label>
        <div className="grid grid-cols-3 gap-2">
          {DREAM_FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDreamFocus(opt.value as DreamFocus)}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                dreamFocus === opt.value
                  ? "border-indigo-500 bg-indigo-500/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-indigo-500/30"
              }`}
            >
              <span className="block text-base mb-0.5">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight size={14} className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
        Additional context (optional)
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
              <label className="text-xs font-bold text-muted-foreground mb-2 block">How did this dream make you feel?</label>
              <input
                type="text"
                value={emotions}
                onChange={(e) => setEmotions(e.target.value)}
                placeholder="e.g., anxious, peaceful, confused, amazed..."
                className="w-full p-3 rounded-xl bg-surface/80 backdrop-blur border border-border focus:border-indigo-500/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Recurring dream */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRecurringDream(!recurringDream)}
                className={`w-10 h-6 rounded-full transition-colors relative ${
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
              <label className="text-xs font-bold text-muted-foreground mb-2 block">Were you aware you were dreaming?</label>
              <input
                type="text"
                value={lucidElements}
                onChange={(e) => setLucidElements(e.target.value)}
                placeholder="e.g., I knew I was dreaming and tried to fly..."
                className="w-full p-3 rounded-xl bg-surface/80 backdrop-blur border border-border focus:border-indigo-500/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button
        onClick={onSubmit}
        disabled={dreamText.trim().length < 20}
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
        <p className="text-xs font-bold text-indigo-400 mb-2">For deeper interpretation:</p>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>• Include specific symbols — objects, animals, people, locations</p>
          <p>• Describe the emotional tone — were you scared, peaceful, confused?</p>
          <p>• Note colors, numbers, and any unusual details</p>
          <p>• Mention if you've had similar dreams before</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── ANALYZING PHASE ────────────────────────────────────────────────────────────

function AnalyzingPhase({ progress }: { progress: number }) {
  const steps = [
    { label: "Parsing dream narrative", threshold: 10 },
    { label: "Extracting symbols", threshold: 25 },
    { label: "Identifying themes", threshold: 40 },
    { label: "Classifying archetypes", threshold: 55 },
    { label: "Mapping emotional landscape", threshold: 70 },
    { label: "Generating interpretation", threshold: 85 },
  ];

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
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
          <span className="text-muted-foreground">Analyzing your dream...</span>
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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 backdrop-blur"
      >
        <div className="flex items-center gap-2 mb-3">
          <Moon size={16} className="text-indigo-400" />
          <h3 className="font-bold text-sm text-foreground">Dream Summary</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{reading.summary}</p>
      </motion.div>

      {/* Section carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground">Interpretation Sections</h3>
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
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-surface/60 border border-border/40 text-center">
          <p className="text-lg font-black text-indigo-400">{reading.analysis.symbols.length}</p>
          <p className="text-[10px] text-muted-foreground font-bold">Symbols</p>
        </div>
        <div className="p-3 rounded-xl bg-surface/60 border border-border/40 text-center">
          <p className="text-lg font-black text-purple-400">{reading.analysis.themes.length}</p>
          <p className="text-[10px] text-muted-foreground font-bold">Themes</p>
        </div>
        <div className="p-3 rounded-xl bg-surface/60 border border-border/40 text-center">
          <p className="text-lg font-black text-pink-400">{reading.analysis.archetypes.length}</p>
          <p className="text-[10px] text-muted-foreground font-bold">Archetypes</p>
        </div>
      </div>

      <motion.button
        onClick={onContinue}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-base shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-shadow active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Sparkles size={18} /> Get AI Master Interpretation <ArrowRight size={16} />
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
          {loadingAI && <Loader2 size={14} className="text-indigo-400 animate-spin ml-auto" />}
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
        <h3 className="text-xs font-bold text-muted-foreground">Complete Analysis</h3>
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
            <Loader2 size={20} className="text-indigo-400 animate-spin" />
          </div>
        ) : consultants.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {consultants.map((c) => (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.02 }}
                className="p-3 rounded-xl bg-surface/80 border border-border/60 cursor-pointer"
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
              </motion.div>
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
      transition={{ delay: index * 0.1 }}
      className="p-4 rounded-2xl bg-surface/60 border border-border/40"
    >
      <button
        onClick={() => setExpanded(!expanded)}
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
