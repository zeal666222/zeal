"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { fetchAIJson } from "@/lib/ai/json-fetch";
import { seeded } from "@/lib/rand";
import { BrandSpinner } from "@zeal/ui";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Hash, Loader2, Sparkles, Star, Calculator, RefreshCw,
  TrendingUp, Users,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Phase = "intro" | "input" | "computing" | "reading";

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

/* ─── Pure computation (kept from original) ────────────────────────────────── */

function computeNumerology(name: string, dob: string) {
  const lifePath = dob
    .split("-")
    .join("")
    .split("")
    .reduce((a, c) => a + parseInt(c, 10), 0);
  const reduce = (n: number): number =>
    n > 9 && n !== 11 && n !== 22 && n !== 33
      ? reduce(n.toString().split("").reduce((a, c) => a + parseInt(c, 10), 0))
      : n;
  const lifePathNum = reduce(lifePath);
  const nameNum = reduce(
    name
      .toUpperCase()
      .split("")
      .filter((c) => /[A-Z]/.test(c))
      .reduce((a, c) => a + ((c.charCodeAt(0) - 65) % 9) + 1, 0),
  );
  return { lifePath: lifePathNum, nameNumber: nameNum };
}

/* ─── Number meanings (kept from original) ─────────────────────────────────── */

const NUMBER_MEANINGS: Record<
  number,
  { title: string; trait: string; color: string; icon: string }
> = {
  1: { title: "The Leader", trait: "Independent, ambitious, pioneering", color: "from-red-500 to-orange-500", icon: "👑" },
  2: { title: "The Diplomat", trait: "Cooperative, sensitive, balanced", color: "from-blue-400 to-cyan-500", icon: "🤝" },
  3: { title: "The Creative", trait: "Expressive, artistic, optimistic", color: "from-yellow-400 to-amber-500", icon: "🎨" },
  4: { title: "The Builder", trait: "Practical, disciplined, loyal", color: "from-green-500 to-emerald-600", icon: "🏗️" },
  5: { title: "The Adventurer", trait: "Freedom-loving, versatile, dynamic", color: "from-purple-500 to-violet-600", icon: "🌍" },
  6: { title: "The Nurturer", trait: "Responsible, loving, protective", color: "from-pink-500 to-rose-500", icon: "💝" },
  7: { title: "The Seeker", trait: "Analytical, introspective, wise", color: "from-indigo-500 to-blue-600", icon: "🔮" },
  8: { title: "The Powerhouse", trait: "Ambitious, authoritative, successful", color: "from-amber-600 to-yellow-700", icon: "💎" },
  9: { title: "The Humanitarian", trait: "Compassionate, generous, idealistic", color: "from-teal-500 to-cyan-600", icon: "🌟" },
  11: { title: "Master Intuitive", trait: "Spiritually aware, inspiring", color: "from-violet-500 to-purple-600", icon: "✨" },
  22: { title: "Master Builder", trait: "Visionary, practical mastery", color: "from-emerald-500 to-green-700", icon: "🏛️" },
  33: { title: "Master Teacher", trait: "Selfless service, spiritual guidance", color: "from-rose-500 to-pink-600", icon: "🕊️" },
};

/* ─── Computing phase labels ───────────────────────────────────────────────── */

const COMPUTING_LABELS = [
  "Analysing the numbers of your birth date…",
  "Calculating your life path frequency…",
  "Counting the number of your name…",
  "Preparing your Karmic profile…",
];

/* ─── Main Page Component ──────────────────────────────────────────────────── */

export default function NumerologyPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(false);
  const computingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (computingTimerRef.current) clearTimeout(computingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "reading") {
      setLoadingConsultants(true);
      fetch("/api/explore/consultants?category=NUMEROLOGY&online=true&limit=4")
        .then((r) => (r.ok ? r.json() : { consultants: [] }))
        .then((data) => {
          const items = (data.consultants ?? data.items ?? (Array.isArray(data) ? data : [])) as AvailableConsultant[];
          setConsultants(items);
        })
        .catch(() => {})
        .finally(() => setLoadingConsultants(false));
    }
  }, [phase]);

  const nums = useMemo(() => {
    if (!fullName || !dob) return null;
    return computeNumerology(fullName, dob);
  }, [fullName, dob]);

  const lifePathInfo = nums ? NUMBER_MEANINGS[nums.lifePath] ?? null : null;
  const nameNumInfo = nums ? NUMBER_MEANINGS[nums.nameNumber] ?? null : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!fullName || !dob) return;
      if (submittingRef.current) return;
      submittingRef.current = true;
      setError(null);
      setPhase("computing");

      // Let the computing animation play for ~5 seconds, then fetch
      computingTimerRef.current = setTimeout(async () => {
        try {
          const { res, data } = await fetchAIJson<{ analysis?: string; error?: string }>(
            "/api/ai?task=numerology",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fullName, dob }),
            },
          );
          if (!res.ok) {
            throw new Error(data?.error || `HTTP ${res.status}`);
          }
          setAnalysis(data?.analysis ?? "Calculation complete. Your reading is ready.");
          setPhase("reading");
        } catch {
          setError("Your numerology reading couldn't load right now — please check your connection and try again.");
          setPhase("input");
        } finally {
          submittingRef.current = false;
        }
      }, 5000);
    },
    [fullName, dob],
  );

  const handleReset = useCallback(() => {
    if (computingTimerRef.current) clearTimeout(computingTimerRef.current);
    setPhase("intro");
    setFullName("");
    setDob("");
    setAnalysis("");
    setError(null);
    setConsultants([]);
    submittingRef.current = false;
  }, []);

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-amber-500/[0.06] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-cyan-500/[0.05] blur-[140px] rounded-full pointer-events-none" />
        <FloatingNumberParticles />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Hash size={12} /> Karmic Frequency Analysis
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
              Destiny Numerology
            </h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
              Calculate your life path number and karmic frequency cycles — completely free.
            </p>
            {phase !== "intro" && phase !== "computing" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                type="button"
                onClick={handleReset}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="mt-4 px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Start Over
              </motion.button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Phase Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <IntroPhase key="intro" onBegin={() => setPhase("input")} />
          )}
          {phase === "input" && (
            <InputPhase
              key="input"
              fullName={fullName}
              setFullName={setFullName}
              dob={dob}
              setDob={setDob}
              nums={nums}
              lifePathInfo={lifePathInfo}
              nameNumInfo={nameNumInfo}
              error={error}
              onSubmit={handleSubmit}
            />
          )}
          {phase === "computing" && (
            <ComputingPhase
              key="computing"
              fullName={fullName}
              dob={dob}
              nums={nums}
            />
          )}
          {phase === "reading" && nums && lifePathInfo && (
            <ReadingPhase
              key="reading"
              fullName={fullName}
              nums={nums}
              lifePathInfo={lifePathInfo}
              nameNumInfo={nameNumInfo}
              analysis={analysis}
              error={error}
              consultants={consultants}
              loadingConsultants={loadingConsultants}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>

        {/* Free badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-10"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> Completely Free · No sign-up required
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Floating Number Particles ────────────────────────────────────────────── */

function FloatingNumberParticles() {
  // Seeded so SSR and hydration agree — Math.random() here causes a mismatch.
  const rand = seeded(20261022);
  const digits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        digit: String(i % 10),
        x: rand() * 100,
        y: rand() * 100,
        size: 12 + rand() * 18,
        duration: 8 + rand() * 6,
        delay: rand() * 4,
        repeatDelay: rand() * 2,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {digits.map((d, i) => (
        <motion.span
          key={i}
          className="absolute font-black text-amber-400/[0.08] select-none"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            fontSize: d.size,
          }}
          animate={{
            y: [0, -30, 10, -20, 0],
            x: [0, 10, -10, 5, 0],
            opacity: [0, 0.12, 0.06, 0.1, 0],
          }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            repeatDelay: d.repeatDelay,
            ease: "easeInOut",
          }}
        >
          {d.digit}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── Morph Blobs ──────────────────────────────────────────────────────────── */

function MorphBlobs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/[0.04] blur-[100px] rounded-full"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.3, 0.9, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-cyan-500/[0.04] blur-[100px] rounded-full"
        animate={{
          x: [0, -30, 20, 0],
          y: [0, 20, -30, 0],
          scale: [1, 0.9, 1.2, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
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
      className="flex flex-col items-center gap-8 py-12 relative"
    >
      <MorphBlobs />

      {/* Number reduction visualization */}
      <div className="relative w-48 h-32">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/10 flex items-center justify-center"
            initial={{ x: (i - 2) * 50 - 20, y: 0, opacity: 0 }}
            animate={{
              x: [
                (i - 2) * 50 - 20,
                (i - 2) * 30,
                0,
                -20,
                (i - 2) * 50 - 20,
              ],
              y: [0, -10, 0, 10, 0],
              opacity: [0.6, 0.8, 1, 0.8, 0.6],
              scale: [1, 0.9, 0.7, 0.9, 1],
            }}
            transition={{
              duration: 5,
              delay: i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <span className="text-lg font-black text-amber-400/60">
              {i + 1}
            </span>
          </motion.div>
        ))}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-cyan-500/30 border border-amber-500/20 flex items-center justify-center"
          animate={{
            scale: [1, 1.15, 1],
            boxShadow: [
              "0 0 0px rgba(245,158,11,0)",
              "0 0 30px rgba(245,158,11,0.3)",
              "0 0 0px rgba(245,158,11,0)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-cyan-400 bg-clip-text text-transparent">
            ?
          </span>
        </motion.div>
      </div>

      <div className="text-center space-y-3 max-w-md relative z-10">
        <h2 className="text-2xl font-bold text-foreground">
          Discover the Mystery of Your Numbers
        </h2>
        <p className="text-muted-foreground text-sm">
          A karmic frequency is hidden in your birth date and your name.
          Discover your life path number, destiny number and personalized numerology profile.
        </p>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBegin}
        className="relative z-10 px-8 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-amber-500/30 transition-all inline-flex items-center gap-3"
      >
        <Calculator size={22} /> Calculate Your Numbers
      </motion.button>

      <div className="grid grid-cols-3 gap-4 max-w-sm text-center relative z-10">
        {[
          { icon: <Hash size={16} />, label: "Life Path" },
          { icon: <TrendingUp size={16} />, label: "Destiny" },
          { icon: <Sparkles size={16} />, label: "Completely Free" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1.5">
            <span className="text-amber-400/60">{item.icon}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Input ───────────────────────────────────────────────────────── */

function InputPhase({
  fullName,
  setFullName,
  dob,
  setDob,
  nums,
  lifePathInfo,
  nameNumInfo,
  error,
  onSubmit,
}: {
  fullName: string;
  setFullName: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  nums: { lifePath: number; nameNumber: number } | null;
  lifePathInfo: { title: string; trait: string; color: string; icon: string } | null;
  nameNumInfo: { title: string; trait: string; color: string; icon: string } | null;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
    >
      <form
        onSubmit={onSubmit}
        className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 space-y-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.03] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/[0.03] blur-3xl rounded-full pointer-events-none" />

        <div className="relative space-y-6">
          <div>
            <label htmlFor="num-full-name" className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
              Full Name
            </label>
            <input
              id="num-full-name"
              type="text"
              required
              value={fullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFullName(e.target.value)
              }
              placeholder="Enter your full birth name"
              className="w-full px-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl outline-none text-foreground focus:border-amber-500/50 transition-colors text-sm"
            />
          </div>
          <div>
            <label htmlFor="num-dob" className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
              Date of Birth
            </label>
            <input
              id="num-dob"
              type="date"
              required
              value={dob}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDob(e.target.value)
              }
              className="w-full px-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl outline-none text-foreground focus:border-amber-500/50 transition-colors text-sm"
            />
          </div>

          {/* Live preview of numbers with spring animation */}
          <AnimatePresence>
            {nums && lifePathInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                className="grid grid-cols-2 gap-3"
              >
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    delay: 0.05,
                  }}
                  className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Life Path
                  </p>
                  <motion.p
                    key={nums.lifePath}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="text-2xl font-black text-amber-400 mt-1"
                  >
                    {nums.lifePath}
                  </motion.p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lifePathInfo.icon} {lifePathInfo.title}
                  </p>
                </motion.div>
                {nameNumInfo && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 20,
                      delay: 0.1,
                    }}
                    className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/10"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Destiny
                    </p>
                    <motion.p
                      key={nums.nameNumber}
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 15,
                      }}
                      className="text-2xl font-black text-cyan-400 mt-1"
                    >
                      {nums.nameNumber}
                    </motion.p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {nameNumInfo.icon} {nameNumInfo.title}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={!fullName || !dob}
            whileHover={{ scale: fullName && dob ? 1.01 : 1 }}
            whileTap={{ scale: fullName && dob ? 0.98 : 1 }}
            className="relative w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold hover:shadow-2xl hover:shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"
              animate={{ left: ["−100%", "200%"] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 1,
              }}
            />
            <span className="relative flex items-center gap-2">
              <Sparkles size={18} /> View My Profile
            </span>
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

/* ─── Phase 3: Computing ───────────────────────────────────────────────────── */

function ComputingPhase({
  fullName,
  dob,
  nums,
}: {
  fullName: string;
  dob: string;
  nums: { lifePath: number; nameNumber: number } | null;
}) {
  const [labelIndex, setLabelIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLabelIndex((prev) =>
        prev < COMPUTING_LABELS.length - 1 ? prev + 1 : prev,
      );
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const birthDigits = dob.split("-").join("").split("").map(Number);
  const nameLetters = fullName
    .toUpperCase()
    .split("")
    .filter((c) => /[A-Z]/.test(c));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-8 py-12 relative"
    >
      {/* Golden particle field background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 24 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-400/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -40, 20, -10, 0],
              opacity: [0, 0.6, 0.3, 0.5, 0],
              scale: [0.5, 1, 0.8, 1.2, 0.5],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              delay: Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Birth date digit reduction visualization */}
      <div className="relative w-full max-w-md">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 text-center mb-4">
          Birth Date Number Analysis
        </p>
        <div className="relative h-24 flex items-center justify-center">
          {/* Source digits flying inward */}
          {birthDigits.map((digit, i) => (
            <motion.div
              key={`bd-${i}`}
              className="absolute w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"
              initial={{
                x: (i - birthDigits.length / 2) * 44,
                y: -30,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                x: [
                  (i - birthDigits.length / 2) * 44,
                  (i - birthDigits.length / 2) * 20,
                  0,
                  0,
                  (i - birthDigits.length / 2) * 44,
                ],
                y: [-30, -10, 0, 0, -30],
                opacity: [0, 0.8, 1, 0.8, 0],
                scale: [0.5, 0.8, 1, 0.6, 0.5],
              }}
              transition={{
                duration: 4,
                delay: i * 0.15,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-sm font-black text-amber-400">
                {digit}
              </span>
            </motion.div>
          ))}

          {/* Intermediate sum */}
          <motion.div
            className="absolute"
            animate={{
              opacity: [0, 0, 1, 1, 0],
              scale: [0.5, 0.5, 1, 0.8, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <span className="text-2xl font-black text-amber-400/60">
              {birthDigits.reduce((a, c) => a + c, 0)}
            </span>
          </motion.div>

          {/* Final result */}
          {nums && (
            <motion.div
              className="absolute"
              animate={{
                opacity: [0, 0, 0, 1, 1, 0],
                scale: [0.3, 0.3, 0.3, 1.3, 1, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-3xl font-black bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
                {nums.lifePath}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Name number visualization */}
      <div className="relative w-full max-w-md">
        <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 text-center mb-4">
          Counting the Number in Your Name
        </p>
        <div className="relative h-20 flex items-center justify-center gap-1 flex-wrap px-4">
          {nameLetters.slice(0, 12).map((letter, i) => (
            <motion.div
              key={`nl-${i}`}
              className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center"
              initial={{ opacity: 0, y: 20, scale: 0 }}
              animate={{
                opacity: [0, 1, 1, 0.5, 0],
                y: [20, 0, 0, -10, 20],
                scale: [0, 1, 1, 0.7, 0],
              }}
              transition={{
                duration: 4,
                delay: i * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-xs font-bold text-cyan-400">
                {letter}
              </span>
            </motion.div>
          ))}
          {nums && (
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              animate={{
                opacity: [0, 0, 0, 1, 0],
                scale: [0.5, 0.5, 0.5, 1.2, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                {nums.nameNumber}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Cycling phase label */}
      <div className="flex flex-col items-center gap-3 relative z-10">
        <AnimatePresence mode="wait">
          <motion.p
            key={labelIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-foreground"
          >
            {COMPUTING_LABELS[labelIndex]}
          </motion.p>
        </AnimatePresence>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-5 h-5 text-amber-400" />
        </motion.div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {COMPUTING_LABELS.map((_, i) => (
          <motion.div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i <= labelIndex
                ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                : "bg-surface-raised border border-border/60"
            }`}
            animate={i === labelIndex ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 0.4 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Number Burst Particles ───────────────────────────────────────────────── */

function NumberBurst({ color, active }: { color: string; active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        angle: (i / 20) * Math.PI * 2,
        distance: 50 + Math.random() * 40,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 0.2,
      })),
    [],
  );

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${color}`}
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/* ─── Phase 4: Reading ─────────────────────────────────────────────────────── */

function ReadingPhase({
  fullName,
  nums,
  lifePathInfo,
  nameNumInfo,
  analysis,
  error,
  consultants,
  loadingConsultants,
  onReset,
}: {
  fullName: string;
  nums: { lifePath: number; nameNumber: number };
  lifePathInfo: { title: string; trait: string; color: string; icon: string };
  nameNumInfo: { title: string; trait: string; color: string; icon: string } | null;
  analysis: string;
  error: string | null;
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
  onReset: () => void;
}) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showConsultants, setShowConsultants] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowAnalysis(true), 800);
    const t2 = setTimeout(() => setShowConsultants(true), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      className="space-y-6"
    >
      {/* Number cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Life Path Card */}
        <motion.div
          initial={{ opacity: 0, x: -30, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{
            delay: 0.1,
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6"
        >
          <div
            className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${lifePathInfo.color} opacity-[0.08] blur-2xl rounded-full pointer-events-none`}
          />
          <NumberBurst color="bg-amber-400" active={true} />
          <div className="relative text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Life Path Number
            </p>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                }}
                className={`text-6xl font-black mt-2 bg-gradient-to-r ${lifePathInfo.color} bg-clip-text text-transparent`}
              >
                {nums.lifePath}
              </motion.p>
            </motion.div>
            <p className="text-lg font-bold text-foreground mt-2">
              {lifePathInfo.icon} {lifePathInfo.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lifePathInfo.trait}
            </p>
          </div>
        </motion.div>

        {/* Destiny Card */}
        {nameNumInfo && (
          <motion.div
            initial={{ opacity: 0, x: 30, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
            className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6"
          >
            <div
              className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${nameNumInfo.color} opacity-[0.08] blur-2xl rounded-full pointer-events-none`}
            />
            <NumberBurst color="bg-cyan-400" active={true} />
            <div className="relative text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Destiny Number
              </p>
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              >
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.3,
                    type: "spring",
                    stiffness: 200,
                  }}
                  className={`text-6xl font-black mt-2 bg-gradient-to-r ${nameNumInfo.color} bg-clip-text text-transparent`}
                >
                  {nums.nameNumber}
                </motion.p>
              </motion.div>
              <p className="text-lg font-bold text-foreground mt-2">
                {nameNumInfo.icon} {nameNumInfo.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {nameNumInfo.trait}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Analysis */}
      <AnimatePresence>
        {showAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.04] blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl font-bold flex items-center gap-2 text-foreground mb-4"
              >
                <Sparkles className="text-amber-400" />{" "}
                {fullName}'s Numerology Profile
              </motion.h2>

              {error ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
                  {error}
                </div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-muted-foreground leading-relaxed whitespace-pre-line text-[15px]"
                >
                  {analysis}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Sparkles size={9} className="text-amber-400" /> AI
                    interpretation
                  </span>
                  <span>·</span>
                  <span>24h cached</span>
                </div>
                <button
                  type="button"
                  onClick={onReset}
                  className="px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> New Calculation
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Consultant CTA Section */}
      <AnimatePresence>
        {showConsultants && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1,
              type: "spring",
              stiffness: 180,
              damping: 22,
            }}
            className="space-y-4"
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-cyan-500/10 border border-amber-500/20 p-6 sm:p-8">
              <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-amber-400" /> Explore Your Numbers
                  in Greater Depth
                </h3>
                <p className="text-sm text-muted-foreground mt-1 mb-5">
                  Get personalized guidance from certified numerology experts.
                </p>

                {loadingConsultants ? (
                  <div className="flex items-center justify-center py-6">
                    <BrandSpinner size={20} className="text-amber-400" />
                  </div>
                ) : consultants.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {consultants.map((c, i) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        whileHover={{ y: -2, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                          delay: i * 0.1,
                          type: "spring",
                          stiffness: 200,
                          damping: 20,
                        }}
                      >
                        <Link
                          href={`/consultant/${c.id}`}
                          className="block p-3 rounded-2xl bg-surface/80 border border-border/60 hover:border-amber-500/30 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="relative shrink-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-cyan-500/20 flex items-center justify-center text-xs font-bold text-amber-400 overflow-hidden">
                                {c.avatar ? (
                                  <img
                                    src={c.avatar}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  c.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              {c.isOnline && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {c.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {c.specialties?.[0] ?? c.category}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <Star
                                size={8}
                                className="fill-amber-400 text-amber-400"
                              />{" "}
                              {c.rating.toFixed(1)}
                            </span>
                            {c.perMinuteRate && (
                              <span className="text-muted-foreground">
                                ₹{c.perMinuteRate}/min
                              </span>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No numerology experts online right now
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-border/30 text-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-[10px] font-medium">
                    <Star size={9} /> This calculation is completely free · No sign-up required
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
