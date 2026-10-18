"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Palmistry Service — Industry-grade digital palm reading
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandSpinner } from "@zeal/ui";
import {
  Upload, Loader2, RotateCcw, Sparkles, Camera, Hand, Eye,
  ChevronRight, ArrowRight, MessageCircle, Users, Clock,
  CheckCircle2, Scan, Zap, Heart, Brain, Compass, Star,
  Image as ImageIcon, X,
} from "lucide-react";
import { analyzePalmImage, getEdgeOverlay } from "@/lib/palmistry/analyzer";
import { consumeOpenAIStream } from "@/lib/ai/sse";
import { interpretAnalysis } from "@/lib/palmistry/interpreter";
import { LINE_DISPLAY, ELEMENT_TRAITS } from "@/lib/palmistry/knowledge";
import type {
  PalmAnalysisResult, PalmReading, HandSide, ReadingSection,
} from "@/lib/palmistry/types";
import { PRIMARY_FOCUS_OPTIONS } from "@/lib/palmistry/types";
import ParticleBurst from "@/components/ui/ParticleBurst";
import GlowAura from "@/components/ui/GlowAura";
import ShimmerOverlay from "@/components/ui/ShimmerOverlay";

type Phase = "intro" | "upload" | "analyzing" | "visualizing" | "reading";

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

export default function PalmistryPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [image, setImage] = useState<string | null>(null);
  const [edgeOverlay, setEdgeOverlay] = useState<string | null>(null);
  const [handSide, setHandSide] = useState<HandSide>("right");
  const [primaryFocus, setPrimaryFocus] = useState("general");
  const [analysis, setAnalysis] = useState<PalmAnalysisResult | null>(null);
  const [reading, setReading] = useState<PalmReading | null>(null);
  const [aiSynthesis, setAiSynthesis] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const aiStartRef = useRef(false);

  // Auto-reset burst so it can re-trigger on next phase transition
  useEffect(() => {
    if (!showBurst) return;
    const t = setTimeout(() => setShowBurst(false), 1200);
    return () => clearTimeout(t);
  }, [showBurst]);

  const reset = () => {
    setPhase("intro");
    setImage(null);
    setEdgeOverlay(null);
    setAnalysis(null);
    setReading(null);
    setAiSynthesis("");
    setError(null);
    setScanProgress(0);
    setActiveLineIdx(0);
    processingRef.current = false;
    aiStartRef.current = false;
  };

  const handleFile = useCallback(async (file: File) => {
    if (processingRef.current) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG or WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The image needs to be under 10 MB.");
      return;
    }
    setError(null);
    processingRef.current = true;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target?.result as string;
      setImage(src);
      setPhase("analyzing");
    };
    reader.onerror = () => {
      processingRef.current = false;
      setError("We couldn't read that image. Please try again or pick another image.");
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (phase !== "analyzing" || !image) return;
    setScanProgress(0);
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 8, 90));
    }, 200);

    (async () => {
      try {
        const result = await analyzePalmImage(image, handSide);
        setAnalysis(result);
        const overlay = await getEdgeOverlay(image, 600, 800);
        setEdgeOverlay(overlay);
        const palmReading = interpretAnalysis(result);
        setReading(palmReading);
        clearInterval(progressInterval);
        setScanProgress(100);
        processingRef.current = false;
        setTimeout(() => { setPhase("visualizing"); setShowBurst(true); }, 600);
      } catch {
        clearInterval(progressInterval);
        processingRef.current = false;
        setError("We couldn't analyse the palm. Please try again with a clearer image.");
        setPhase("upload");
      }
    })();

    return () => clearInterval(progressInterval);
  }, [phase, image, handSide]);

  useEffect(() => {
    if (phase !== "visualizing") return;
    const interval = setInterval(() => {
      setActiveLineIdx((i) => (i + 1) % 6);
    }, 1800);
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
      const res = await fetch("/api/ai/palmistry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handSide, primaryFocus, analysis }),
      });
      if (res.status === 401) {
        setAiSynthesis("Please sign in to unlock your full AI reading — the detailed palm analysis below is already ready for you.");
        return;
      }
      if (!res.ok || !res.body) throw new Error("AI reading unavailable");
      const full = await consumeOpenAIStream(res, { onDelta: (acc) => setAiSynthesis(acc) });
      if (!full.trim()) throw new Error("Empty AI reading");
    } catch {
      setAiSynthesis("Our AI palmist is temporarily unavailable. No worries — your detailed analysis below is fully ready, based on the computer vision scan.");
    } finally {
      setLoadingAI(false);
      aiStartRef.current = false;
    }
  }, [analysis, handSide, primaryFocus]);

  useEffect(() => {
    if (phase !== "reading") return;
    setLoadingConsultants(true);
    fetch("/api/explore/consultants?category=PALMIST&online=true&limit=4")
      .then((r) => r.json())
      .then((data) => setConsultants(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingConsultants(false));
  }, [phase]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <ParticleBurst active={showBurst} color="#a855f7" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-purple-600/8 blur-[200px] rounded-full" />
        <div className="absolute bottom-20 right-1/4 w-[500px] h-[500px] bg-amber-500/6 blur-[180px] rounded-full" />
        <FloatingParticles />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-12">
        <HeroHeader phase={phase} onReset={reset} />

        <AnimatePresence mode="wait">
          {phase === "intro" && <IntroPhase key="intro" onStart={() => setPhase("upload")} />}
          {phase === "upload" && (
            <UploadPhase
              key="upload"
              handSide={handSide}
              setHandSide={setHandSide}
              primaryFocus={primaryFocus}
              setPrimaryFocus={setPrimaryFocus}
              fileRef={fileRef}
              onFile={handleFile}
              error={error}
            />
          )}
          {phase === "analyzing" && <AnalyzingPhase key="analyzing" image={image} progress={scanProgress} />}
          {phase === "visualizing" && (
            <VisualizingPhase
              key="visualizing"
              image={image}
              edgeOverlay={edgeOverlay}
              analysis={analysis}
              activeLineIdx={activeLineIdx}
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

// ─── HERO HEADER ────────────────────────────────────────────────────────────────

function HeroHeader({ phase, onReset }: { phase: Phase; onReset: () => void }) {
  return (
    <div className="text-center mb-10">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
        <Hand size={12} /> Completely Free AI Palmistry
      </motion.div>
      <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent mb-3">
        Digital Palm Reading
      </h1>
      <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
        Where advanced computer vision meets the ancient art of palmistry — upload your palm and get a detailed analysis instantly
      </p>
      {phase !== "intro" && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={onReset}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-muted-foreground text-xs font-bold hover:text-foreground transition-colors">
          <RotateCcw size={12} /> Start Over
        </motion.button>
      )}
    </div>
  );
}

// ─── INTRO PHASE ────────────────────────────────────────────────────────────────

function IntroPhase({ onStart }: { onStart: () => void }) {
  const features = [
    { icon: Scan, title: "Edge Detection Analysis", desc: "Sobel edge detection maps every line, break and branch on your palm" },
    { icon: Brain, title: "AI Master Palmist", desc: "The wisdom of 30+ years of palmistry, delivered by our expert AI consultant" },
    { icon: Eye, title: "6 Line + 8 Mount Reading", desc: "Heart, Head, Life, Fate, Sun, Marriage lines — every major mount analysed" },
    { icon: Zap, title: "Instant Results", desc: "A complete analysis in seconds — no appointment, no waiting" },
  ];

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-8">
      <div className="relative mx-auto w-48 h-48">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500/30" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4 rounded-full border border-amber-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}
            className="text-7xl">🖐️</motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -4 }} transition={{ delay: i * 0.1 + 0.3, ...spring }}
            className="p-4 rounded-2xl bg-surface/80 backdrop-blur border border-border/60 hover:border-purple-500/30 transition-colors">
            <f.icon size={20} className="text-purple-400 mb-2" />
            <h3 className="font-bold text-sm text-foreground">{f.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7, ...spring }}
        type="button"
        onClick={onStart}
        whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-base shadow-xl shadow-purple-600/25 hover:shadow-purple-600/40 transition-shadow active:scale-[0.98] flex items-center justify-center gap-2">
        <Camera size={18} /> Upload Your Palm <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );
}

// ─── UPLOAD PHASE ───────────────────────────────────────────────────────────────

function UploadPhase({
  handSide, setHandSide, primaryFocus, setPrimaryFocus, fileRef, onFile, error,
}: {
  handSide: HandSide; setHandSide: (s: HandSide) => void;
  primaryFocus: string; setPrimaryFocus: (s: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void; error: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      {/* Hand side selector */}
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Which hand?</label>
        <div className="grid grid-cols-2 gap-3">
          {(["left", "right"] as const).map((side) => (
            <motion.button key={side} type="button" onClick={() => setHandSide(side)}
              layout
              aria-pressed={handSide === side}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className={`p-4 rounded-2xl border-2 transition-all text-center ${
                handSide === side
                  ? "border-purple-500 bg-purple-500/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-purple-500/30"
              }`}>
              <span className="text-2xl block mb-1">{side === "right" ? "🤚" : "✋"}</span>
              <span className="text-sm font-bold">{side === "right" ? "Right Hand" : "Left Hand"}</span>
              <span className="text-[10px] block mt-0.5 opacity-60">
                {side === "right" ? "Potential in the present and future" : "Inborn potential and natural talent"}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Focus selector */}
      <div>
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Choose your focus</label>
        <div className="grid grid-cols-3 gap-2">
          {PRIMARY_FOCUS_OPTIONS.map((opt) => (
            <motion.button key={opt.value} type="button" onClick={() => setPrimaryFocus(opt.value)}
              aria-pressed={primaryFocus === opt.value}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                primaryFocus === opt.value
                  ? "border-purple-500 bg-purple-500/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-purple-500/30"
              }`}>
              <span className="block text-base mb-0.5">{opt.icon}</span>
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Click or press Enter to choose a palm image"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={`relative cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
          dragOver
            ? "border-purple-500 bg-purple-500/10 scale-[1.02]"
            : "border-border bg-surface/50 hover:border-purple-500/40"
        }`}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <Upload size={40} className="mx-auto text-purple-400 mb-3" />
        </motion.div>
        <p className="font-bold text-foreground text-sm">Drop an image of your palm here</p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse — JPG, PNG, WebP, up to 10 MB</p>
        <div className="mt-4 p-3 rounded-xl bg-background/60 text-[10px] text-muted-foreground text-left space-y-1">
          <p className="font-bold text-foreground text-xs">For the best results:</p>
          <p>• Keep your palm open and flat, fingers slightly relaxed</p>
          <p>• Use good, even lighting (avoid shadows)</p>
          <p>• Frame the whole palm including the wrist</p>
          <p>• Use your dominant hand for present/future readings</p>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
          <X size={14} /> {error}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── ANALYZING PHASE ────────────────────────────────────────────────────────────

function AnalyzingPhase({ image, progress }: { image: string | null; progress: number }) {
  const steps = [
    { label: "Preparing the image", threshold: 15 },
    { label: "Detecting the hand structure", threshold: 30 },
    { label: "Running edge detection (Sobel)", threshold: 50 },
    { label: "Mapping the palm lines", threshold: 65 },
    { label: "Analysing the mount regions", threshold: 80 },
    { label: "Classifying the hand element", threshold: 95 },
  ];

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      <div className="perspective-800">
      <motion.div whileHover={{ rotateY: 5, rotateX: -5 }} className="relative mx-auto w-56 h-72 rounded-3xl overflow-hidden border-2 border-purple-500/30">
        {image && <img src={image} alt="Palm" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-600/20 to-transparent"
          style={{ backgroundPosition: `0 ${progress}%`, backgroundSize: `100% 30%`, backgroundRepeat: "no-repeat" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Scan size={48} className="text-purple-400" />
          </motion.div>
        </div>
      </motion.div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-muted-foreground">Analysing your palm…</span>
          <span className="text-purple-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface overflow-hidden relative">
          <motion.div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full"
            animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          <ShimmerOverlay active={progress > 90} />
        </div>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const active = progress >= step.threshold;
          const current = progress >= step.threshold && (i === steps.length - 1 || progress < (steps[i + 1]?.threshold ?? 100));
          return (
            <motion.div key={step.label} initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.3 }}
              className={`flex items-center gap-2 text-xs ${active ? "text-foreground" : "text-muted-foreground/40"}`}>
              {active ? (
                <CheckCircle2 size={14} className={current ? "text-purple-400 animate-pulse" : "text-emerald-400"} />
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
  image, edgeOverlay, analysis, activeLineIdx, onContinue,
}: {
  image: string | null; edgeOverlay: string | null;
  analysis: PalmAnalysisResult | null; activeLineIdx: number;
  onContinue: () => void;
}) {
  if (!analysis) return null;
  const lineNames = ["heart", "head", "life", "fate", "sun", "marriage"] as const;
  const currentLine = lineNames[activeLineIdx] ?? "heart";
  const lineInfo = LINE_DISPLAY[currentLine]!;
  const lineData = analysis.lines[currentLine]!;
  const elementInfo = ELEMENT_TRAITS[analysis.handShape.element];

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      {/* Image with overlay */}
      <div className="perspective-800">
      <motion.div whileHover={{ rotateY: 5, rotateX: -5 }} className="relative mx-auto w-56 h-72 rounded-3xl overflow-hidden border-2 border-purple-500/30 shadow-2xl shadow-purple-600/20">
        {image && <img src={image} alt="Palm" className="w-full h-full object-cover" />}
        {edgeOverlay && (
          <motion.img src={edgeOverlay} alt="Edge detection"
            initial={{ opacity: 0 }} animate={{ opacity: 0.7 }}
            className="absolute inset-0 w-full h-full object-cover mix-blend-screen" />
        )}
        {/* Scanning line animation */}
        <motion.div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
      </motion.div>
      </div>

      {/* Hand element badge */}
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={spring}
        className={`mx-auto w-fit px-5 py-3 rounded-2xl bg-gradient-to-r ${elementInfo.gradient} text-white text-center shadow-xl relative overflow-hidden`}>
        <GlowAura active={true} color="rgba(168,85,247,0.3)" />
        <span className="text-2xl block">{elementInfo.icon}</span>
        <span className="font-black text-sm">{elementInfo.name}</span>
        <span className="text-[10px] block opacity-80">Confidence: {Math.round(analysis.handShape.confidence * 100)}%</span>
      </motion.div>

      {/* Line analysis cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Line Analysis</h3>
        <AnimatePresence mode="wait">
          <motion.div key={currentLine} {...fadeSlide} transition={spring}
            className="p-4 rounded-2xl bg-surface/80 backdrop-blur border border-border/60">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">{lineInfo.icon}</span>
              <div>
                <h4 className="font-black text-sm" style={{ color: lineInfo.color }}>{lineInfo.name}</h4>
                <p className="text-[10px] text-muted-foreground">{lineInfo.governs}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-lg font-black" style={{ color: lineInfo.color }}>{lineData.score}</div>
                <div className="text-[10px] text-muted-foreground">/ 100</div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden mb-3">
              <motion.div initial={{ width: 0 }} animate={{ width: `${lineData.score}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full" style={{ background: lineInfo.color }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip label={`Quality: ${lineData.quality}`} />
              <Chip label={`Extent: ${lineData.length}`} />
              <Chip label={lineData.curvature.replace("_", " ")} />
              {lineData.breaks > 0 && <Chip label={`${lineData.breaks} transitions`} accent />}
              {lineData.branches > 0 && <Chip label={`${lineData.branches} branches`} />}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Mini line indicators */}
        <div className="flex gap-2 justify-center">
          {lineNames.map((name, i) => {
            const info = LINE_DISPLAY[name]!;
            const lineScore = analysis.lines[name]?.score ?? 0;
            return (
              <div key={name} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${i === activeLineIdx ? "bg-surface-raised scale-110" : "opacity-50"}`}>
                <span className="text-sm">{info.icon}</span>
                <div className="w-6 h-1 rounded-full" style={{ background: lineScore > 50 ? info.color : "#555" }} />
                <span className="text-[8px] font-bold">{lineScore}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dominant traits */}
      <div className="flex flex-wrap gap-2 justify-center">
        {analysis.dominantTraits.map((t) => (
          <span key={t} className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold">
            {t}
          </span>
        ))}
      </div>

      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        type="button"
        onClick={onContinue}
        whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-base shadow-xl shadow-purple-600/25 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <Sparkles size={18} /> Get Your Reading from AI <ArrowRight size={16} />
      </motion.button>
    </motion.div>
  );
}

function Chip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
      accent ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-surface-raised text-muted-foreground border border-border/40"
    }`}>{label}</span>
  );
}

// ─── READING PHASE ──────────────────────────────────────────────────────────────

function ReadingPhase({
  reading, aiSynthesis, loadingAI, consultants, loadingConsultants,
}: {
  reading: PalmReading | null;
  aiSynthesis: string;
  loadingAI: boolean;
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
}) {
  if (!reading) return null;

  return (
    <motion.div {...fadeSlide} transition={spring} className="space-y-6">
      {/* Summary */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-purple-400" />
          <h3 className="font-black text-sm text-foreground">Reading Summary</h3>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{reading.summary}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-surface-sunken overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${reading.analysis.overallScore}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
          </div>
          <span className="text-xs font-black text-purple-400">{reading.analysis.overallScore}/100</span>
        </div>
      </div>

      {/* AI Synthesis */}
      <div className="p-5 rounded-2xl bg-surface/80 backdrop-blur border border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Hand size={16} className="text-amber-400" />
          <h3 className="font-black text-sm text-foreground">AI Master Palmist</h3>
          {loadingAI && <BrandSpinner size={12} className="text-purple-400 ml-auto" />}
        </div>
        {aiSynthesis ? (
          <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
            {aiSynthesis}
            {loadingAI && <span className="inline-block w-1 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />}
          </div>
        ) : loadingAI ? (
          <div className="flex items-center gap-3 text-muted-foreground text-sm" role="status">
            <BrandSpinner size={16} aria-hidden />
            Crafting your reading from the ancient wisdom of palmistry…
          </div>
        ) : null}
      </div>

      {/* Detailed sections */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Detailed Analysis</h3>
        {reading.sections.map((section, i) => (
          <SectionCard key={section.title} section={section} index={i} />
        ))}
      </div>

      {/* Consultant CTA */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-amber-400" />
          <h3 className="font-black text-sm text-foreground">Want to Go Deeper?</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Connect with an expert palmist — a personalized, interactive session that goes beyond AI.
        </p>

        {loadingConsultants ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <BrandSpinner size={12} aria-hidden /> Looking for available palmists…
          </div>
        ) : consultants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {consultants.map((c) => (
              <motion.a key={c.id} href={`/consultant/${c.id}`}
                whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface/80 border border-border/60 hover:border-amber-500/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-sm">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-foreground truncate">{c.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Star size={8} className="text-amber-400" fill="currentColor" /> {c.rating.toFixed(1)}
                    </span>
                    {c.perMinuteRate != null && <span>₹{c.perMinuteRate}/min</span>}
                    {c.isOnline && <span className="text-emerald-400 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live</span>}
                  </div>
                </div>
                <MessageCircle size={14} className="text-amber-400" />
              </motion.a>
            ))}
          </div>
        ) : (
          <a href="/explore?category=PALMIST"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors">
            <Compass size={14} /> View Palmistry Experts <ArrowRight size={12} />
          </a>
        )}
      </div>
    </motion.div>
  );
}

function SectionCard({ section, index }: { section: ReadingSection; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ scale: 1.01 }} layout
      className="rounded-2xl bg-surface/60 backdrop-blur border border-border/40 overflow-hidden">
      <button type="button" onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-raised/50 transition-colors">
        <span className="text-xl">{section.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-foreground">{section.title}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-16 h-1 rounded-full bg-surface-sunken overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ width: `${section.score}%` }} />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">{section.score}/100</span>
          </div>
        </div>
        <ChevronRight size={14} className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{section.content}</p>
              {section.highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {section.highlights.map((h) => (
                    <span key={h} className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/15 text-purple-400 text-[10px] font-bold">
                      {h}
                    </span>
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

// ─── FLOATING PARTICLES ─────────────────────────────────────────────────────────

function FloatingParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 3,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 10,
  }));

  const palmSymbols = ["✋", "🖐️", "🤚"];
  const symbolParticles = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    symbol: palmSymbols[i % palmSymbols.length],
    duration: 20 + Math.random() * 25,
    delay: Math.random() * 15,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div key={p.id}
          className="absolute rounded-full bg-purple-400/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [-20, 20, -20], x: [-10, 10, -10], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {symbolParticles.map((p) => (
        <motion.div key={`sym-${p.id}`}
          className="absolute text-lg opacity-20 select-none"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{ y: [-30, 30, -30], x: [-15, 15, -15], opacity: [0.1, 0.25, 0.1], rotate: [-10, 10, -10] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {p.symbol}
        </motion.div>
      ))}
    </div>
  );
}
