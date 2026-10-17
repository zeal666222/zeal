"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { fetchAIJson } from "@/lib/ai/json-fetch";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, Star, Sparkles, RotateCcw, Loader2, ChevronRight,
  Users, Clock, Zap, Heart, ArrowRight, Compass, Hash, Palette, Orbit,
} from "lucide-react";
import Link from "next/link";
import { ReadingMarkdown } from "@/components/astrology/ReadingMarkdown";

/* ─── Types & Constants ──────────────────────────────────────────────────────── */

type Phase = "intro" | "select" | "computing" | "reading" | "consult";

const SIGNS = [
  { name: "Aries", symbol: "\u2648", dates: "Mar 21 \u2013 Apr 19", element: "Fire" },
  { name: "Taurus", symbol: "\u2649", dates: "Apr 20 \u2013 May 20", element: "Earth" },
  { name: "Gemini", symbol: "\u264A", dates: "May 21 \u2013 Jun 20", element: "Air" },
  { name: "Cancer", symbol: "\u264B", dates: "Jun 21 \u2013 Jul 22", element: "Water" },
  { name: "Leo", symbol: "\u264C", dates: "Jul 23 \u2013 Aug 22", element: "Fire" },
  { name: "Virgo", symbol: "\u264D", dates: "Aug 23 \u2013 Sep 22", element: "Earth" },
  { name: "Libra", symbol: "\u264E", dates: "Sep 23 \u2013 Oct 22", element: "Air" },
  { name: "Scorpio", symbol: "\u264F", dates: "Oct 23 \u2013 Nov 21", element: "Water" },
  { name: "Sagittarius", symbol: "\u2650", dates: "Nov 22 \u2013 Dec 21", element: "Fire" },
  { name: "Capricorn", symbol: "\u2651", dates: "Dec 22 \u2013 Jan 19", element: "Earth" },
  { name: "Aquarius", symbol: "\u2652", dates: "Jan 20 \u2013 Feb 18", element: "Air" },
  { name: "Pisces", symbol: "\u2653", dates: "Feb 19 \u2013 Mar 20", element: "Water" },
];

const ELEMENT_COLORS: Record<string, {
  from: string; to: string; bg: string; text: string;
  border: string; hex: string; hexSoft: string;
}> = {
  Fire:    { from: "from-rose-500",     to: "to-orange-500",   bg: "bg-rose-500/10",     text: "text-rose-400",     border: "border-rose-500/30",     hex: "#f43f5e", hexSoft: "rgba(244,63,94,0.15)" },
  Earth:   { from: "from-emerald-500",  to: "to-green-600",    bg: "bg-emerald-500/10",  text: "text-emerald-400",  border: "border-emerald-500/30",  hex: "#10b981", hexSoft: "rgba(16,185,129,0.15)" },
  Air:     { from: "from-cyan-400",     to: "to-sky-500",      bg: "bg-cyan-500/10",     text: "text-cyan-400",     border: "border-cyan-500/30",     hex: "#22d3ee", hexSoft: "rgba(34,211,238,0.15)" },
  Water:   { from: "from-blue-500",     to: "to-indigo-600",   bg: "bg-blue-500/10",     text: "text-blue-400",     border: "border-blue-500/30",     hex: "#3b82f6", hexSoft: "rgba(59,130,246,0.15)" },
};

const ZODIAC_SYMBOLS = SIGNS.map((s) => s.symbol);

const COMPUTING_LABELS = [
  "Calculating planetary degrees…",
  "Analyzing transit aspects…",
  "Reading ephemeris data…",
  "Preparing your Bhavishyafal…",
];

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

interface LuckyInfo {
  numbers: number[];
  time: string;
  color: string;
  compatibility: string;
}

interface TransitChip {
  code: string;
  planet: string;
  sign: string;
  house: number;
  degreesInSign: number;
  retrograde: boolean;
}

interface MoonChip {
  sign: string;
  nakshatra: string;
  pada: number;
}

interface HoroscopePayload {
  reading: string;
  aiAvailable: boolean;
  date: string;
  transits: TransitChip[];
  moon: MoonChip | null;
  lucky: LuckyInfo | null;
  sources: string[];
}

/* ─── Helper Functions ───────────────────────────────────────────────────────── */

function generateLuckyInfo(signName: string, element: string): LuckyInfo {
  const seed = signName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const numberSets: Record<string, number[]> = {
    Fire:  [(seed % 9) + 1, ((seed * 3) % 9) + 1, ((seed * 7) % 9) + 1],
    Earth: [(seed % 9) + 10, ((seed * 2) % 9) + 10, ((seed * 5) % 9) + 10],
    Air:   [(seed % 7) + 1, ((seed * 4) % 9) + 1, ((seed * 6) % 9) + 1],
    Water: [(seed % 9) + 19, ((seed * 3) % 9) + 19, ((seed * 2) % 9) + 19],
  };
  const timeOptions: Record<string, string[]> = {
    Fire:  ["9:00 AM \u2013 11:00 AM", "1:00 PM \u2013 3:00 PM", "5:00 PM \u2013 7:00 PM"],
    Earth: ["7:00 AM \u2013 9:00 AM", "12:00 PM \u2013 2:00 PM", "6:00 PM \u2013 8:00 PM"],
    Air:   ["10:00 AM \u2013 12:00 PM", "2:00 PM \u2013 4:00 PM", "8:00 PM \u2013 10:00 PM"],
    Water: ["8:00 AM \u2013 10:00 AM", "11:00 AM \u2013 1:00 PM", "4:00 PM \u2013 6:00 PM"],
  };
  const colorOptions: Record<string, string[]> = {
    Fire:  ["Crimson", "Gold", "Coral"],
    Earth: ["Forest Green", "Amber", "Terracotta"],
    Air:   ["Sky Blue", "Lavender", "Silver"],
    Water: ["Deep Blue", "Teal", "Indigo"],
  };
  const compatMap: Record<string, string[]> = {
    Fire:  ["Leo", "Sagittarius", "Aries"],
    Earth: ["Taurus", "Virgo", "Capricorn"],
    Air:   ["Gemini", "Libra", "Aquarius"],
    Water: ["Cancer", "Scorpio", "Pisces"],
  };
  return {
    numbers: numberSets[element] ?? [7, 14, 21],
    time:    (timeOptions[element] ?? ["Noon"])[seed % 3] ?? "Noon",
    color:   (colorOptions[element] ?? ["Gold"])[seed % 3] ?? "Gold",
    compatibility: (compatMap[element] ?? ["Leo"])[seed % 3] ?? "Leo",
  };
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export default function HoroscopePage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [selectedSign, setSelectedSign] = useState(SIGNS[0]!);
  const [data, setData] = useState<HoroscopePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(false);
  const [computingLabel, setComputingLabel] = useState(COMPUTING_LABELS[0]!);
  const computingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (computingTimerRef.current) clearTimeout(computingTimerRef.current);
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    };
  }, []);

  // Fetch consultants when reading or consult phase is reached
  useEffect(() => {
    if (phase === "reading" || phase === "consult") {
      setLoadingConsultants(true);
      fetch("/api/explore/consultants?category=ASTROLOGY&online=true&limit=4")
        .then((r) => r.json())
        .then((data) => {
          const items = (data.consultants ?? data.items ?? (Array.isArray(data) ? data : [])) as AvailableConsultant[];
          setConsultants(items);
        })
        .catch(() => {})
        .finally(() => setLoadingConsultants(false));
    }
  }, [phase]);

  // Cycle computing labels every 1.2s
  useEffect(() => {
    if (phase !== "computing") return;
    let idx = 0;
    setComputingLabel(COMPUTING_LABELS[0]!);
    const interval = setInterval(() => {
      idx = (idx + 1) % COMPUTING_LABELS.length;
      setComputingLabel(COMPUTING_LABELS[idx]!);
    }, 1200);
    return () => clearInterval(interval);
  }, [phase]);

  const handleSelectSign = useCallback((sign: typeof SIGNS[number]) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSelectedSign(sign);
    setData(null);
    setError(null);
    setLoading(true);
    setPhase("computing");

    // Auto-advance to reading after 5s (spinner continues until data lands)
    computingTimerRef.current = setTimeout(() => {
      setPhase("reading");
    }, 5000);

    // Deterministic-first endpoint: always returns a full reading, AI overlay included
    fetchAIJson<HoroscopePayload & { error?: string }>(
      "/api/ai/horoscope",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: sign.name }),
      },
    )
      .then(({ res, data: payload }) => {
        if (!res.ok || !payload?.reading) {
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }
        setData({
          reading: payload.reading,
          aiAvailable: Boolean(payload.aiAvailable),
          date: payload.date ?? "",
          transits: Array.isArray(payload.transits) ? payload.transits : [],
          moon: payload.moon ?? null,
          lucky: payload.lucky ?? null,
          sources: Array.isArray(payload.sources) ? payload.sources : [],
        });
      })
      .catch(() => {
        setError("Your Bhavishyafal couldn't load right now — please check your internet and try again.");
      })
      .finally(() => {
        setLoading(false);
        submittingRef.current = false;
      });
  }, []);

  const handleRetry = useCallback(() => {
    if (computingTimerRef.current) clearTimeout(computingTimerRef.current);
    setPhase("select");
    setError(null);
    setLoading(false);
    submittingRef.current = false;
  }, []);

  const handleReset = useCallback(() => {
    if (computingTimerRef.current) clearTimeout(computingTimerRef.current);
    setPhase("intro");
    setData(null);
    setError(null);
    setLoading(false);
    submittingRef.current = false;
  }, []);

  const colors = ELEMENT_COLORS[selectedSign.element] ?? ELEMENT_COLORS["Fire"]!;

  return (
    <div className="min-h-screen-app pb-16">
      <HeroHeader phase={phase} onReset={handleReset} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-10">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <IntroPhase key="intro" onBegin={() => setPhase("select")} />
          )}
          {phase === "select" && (
            <SelectPhase
              key="select"
              selectedSign={selectedSign}
              onSelect={handleSelectSign}
            />
          )}
          {phase === "computing" && (
            <ComputingPhase
              key="computing"
              sign={selectedSign}
              label={computingLabel}
              error={error}
              onRetry={handleRetry}
            />
          )}
          {phase === "reading" && (
            <ReadingPhase
              key="reading"
              sign={selectedSign}
              data={data}
              loading={loading}
              error={error}
              onReset={handleReset}
              onRetry={handleRetry}
              onGoDeeper={() => setPhase("consult")}
            />
          )}
          {phase === "consult" && (
            <ConsultPhase
              key="consult"
              consultants={consultants}
              loadingConsultants={loadingConsultants}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>

        {/* Free badge - always visible */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center pt-4"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> Completely Free · No sign-up required
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Floating Zodiac Particles ──────────────────────────────────────────────── */

/** Deterministic layout: random-per-render positions desync SSR from client hydration. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function FloatingParticles({ symbols = false }: { symbols?: boolean }) {
  const items = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        startX: pseudoRandom(i + 1) * 100,
        startY: pseudoRandom(i + 13) * 100,
        dur: 8 + pseudoRandom(i + 25) * 6,
        delay: pseudoRandom(i + 37) * 4,
        pause: pseudoRandom(i + 49) * 2,
        symbol: ZODIAC_SYMBOLS[i]!,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: `${p.startX}%`, top: `${p.startY}%` }}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            y: [0, -30, 15, -20, 0],
            x: [0, 10, -8, 12, 0],
            opacity: [0, 0.5, 0.3, 0.4, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: p.pause,
          }}
        >
          {symbols ? (
            <span className="text-sm text-amber-400/20 select-none">{p.symbol}</span>
          ) : (
            <div className="w-1 h-1 rounded-full bg-amber-400/30" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Morph Blobs ────────────────────────────────────────────────────────────── */

function MorphBlobs() {
  return (
    <>
      <motion.div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-amber-500/[0.06] blur-[160px] rounded-full pointer-events-none"
        animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-purple-500/[0.05] blur-[140px] rounded-full pointer-events-none"
        animate={{ x: [0, -25, 20, 0], y: [0, 15, -10, 0], scale: [1, 0.9, 1.05, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-rose-500/[0.04] blur-[120px] rounded-full pointer-events-none"
        animate={{ scale: [1, 1.2, 0.9, 1], opacity: [0.04, 0.06, 0.03, 0.04] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

/* ─── Constellation Lines (SVG) ──────────────────────────────────────────────── */

function ConstellationLines() {
  const paths = useMemo(
    () => [
      "M 30 80 L 60 30 L 90 70 L 120 20",
      "M 180 90 L 200 40 L 230 60 L 250 25 L 270 55",
      "M 320 70 L 340 30 L 370 50 L 350 90",
      "M 80 160 L 110 130 L 140 155 L 170 120",
      "M 240 150 L 260 120 L 290 140 L 280 170 L 310 155",
    ],
    [],
  );

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke="rgba(251,191,36,0.15)"
          strokeWidth="1"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, delay: i * 0.4, ease: "easeInOut" }}
        />
      ))}
      {paths.flatMap((d, pi) =>
        d.split("L").map((_, li) => {
          if (pi === 0 && li === 0) return null;
          const coords = d.split(/[ML]\s*/).filter(Boolean);
          const point = (coords[li] ?? "0 0").trim().split(/\s+/);
          return (
            <motion.circle
              key={`dot-${pi}-${li}`}
              cx={Number(point[0]) || 0}
              cy={Number(point[1]) || 0}
              r="2"
              fill="rgba(251,191,36,0.3)"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: pi * 0.4 + li * 0.15 }}
            />
          );
        }),
      )}
    </svg>
  );
}

/* ─── Degree Counter ─────────────────────────────────────────────────────────── */

function DegreeCounter() {
  const target = useMemo(() => Math.floor(Math.random() * 300) + 30, []);
  const [deg, setDeg] = useState(0);

  useEffect(() => {
    const step = Math.max(1, Math.floor(target / 40));
    const interval = setInterval(() => {
      setDeg((prev) => {
        const next = prev + step;
        if (next >= target) {
          clearInterval(interval);
          return target;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <motion.span
      className="text-2xl sm:text-3xl font-black tabular-nums bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500"
      key={deg}
      initial={{ scale: 1.05 }}
      animate={{ scale: 1 }}
    >
      {deg}°
    </motion.span>
  );
}

/* ─── Particle Burst ─────────────────────────────────────────────────────────── */

function ParticleBurst({ hex, active }: { hex: string; active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        angle: (i / 16) * Math.PI * 2,
        distance: 40 + Math.random() * 40,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 0.15,
      })),
    [],
  );

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, backgroundColor: hex }}
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

/* ─── Hero Header (persistent, outside AnimatePresence) ──────────────────────── */

function HeroHeader({ phase, onReset }: { phase: Phase; onReset: () => void }) {
  return (
    <div className="relative overflow-hidden border-b border-border/40">
      <MorphBlobs />
      <FloatingParticles symbols />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <Sun size={12} /> Daily Transit Forecast
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
            Daily Horoscope
          </h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Guidance from real-time Graha transits, based on Vedic ephemeris calculations.
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

/* ─── Phase 1: Intro ─────────────────────────────────────────────────────────── */

function IntroPhase({ onBegin }: { onBegin: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="flex flex-col items-center gap-8 py-12"
    >
      {/* Animated sun with orbiting planets */}
      <div className="relative w-48 h-48">
        {/* Central sun */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
          animate={{ scale: [1, 1.08, 1], boxShadow: ["0 0 30px rgba(245,158,11,0.3)", "0 0 50px rgba(245,158,11,0.5)", "0 0 30px rgba(245,158,11,0.3)"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Orbiting planets */}
        {[
          { dist: 50, size: 8, dur: 4, color: "#60a5fa", startAngle: 0 },
          { dist: 70, size: 6, dur: 6, color: "#f472b6", startAngle: 120 },
          { dist: 90, size: 10, dur: 8, color: "#34d399", startAngle: 240 },
        ].map((orbit, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2"
            style={{
              width: 0,
              height: 0,
              animation: `horoscope-orbit-${i} ${orbit.dur}s linear infinite`,
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: orbit.size,
                height: orbit.size,
                backgroundColor: orbit.color,
                marginLeft: -orbit.size / 2,
                marginTop: -orbit.size / 2,
                boxShadow: `0 0 8px ${orbit.color}60`,
                transform: `translate(${orbit.dist}px, 0)`,
              }}
            />
          </div>
        ))}

        {/* Floating zodiac ring */}
        {ZODIAC_SYMBOLS.map((sym, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const radius = 88;
          return (
            <motion.span
              key={i}
              className="absolute text-sm text-amber-400/25 select-none"
              style={{
                left: `calc(50% + ${Math.cos(angle) * radius}px - 8px)`,
                top: `calc(50% + ${Math.sin(angle) * radius}px - 8px)`,
              }}
              animate={{ opacity: [0.15, 0.4, 0.15], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 3, delay: i * 0.25, repeat: Infinity, ease: "easeInOut" }}
            >
              {sym}
            </motion.span>
          );
        })}
      </div>

      <div className="text-center space-y-3 max-w-md">
        <h2 className="text-2xl font-bold text-foreground">Discover Today&apos;s Cosmic Guidance</h2>
        <p className="text-muted-foreground text-sm">
          Choose your Rashi and receive a personalized Bhavishyafal based on current planetary transits.
        </p>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBegin}
        className="px-8 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-amber-500/30 transition-all inline-flex items-center gap-3"
      >
        <Sparkles size={22} /> Choose Your Rashi
      </motion.button>

      <div className="grid grid-cols-3 gap-4 max-w-sm text-center">
        {[
          { icon: "\u2609", label: "12 Rashis" },
          { icon: "\u2728", label: "AI-Powered" },
          { icon: "\ud83d\udd13", label: "Completely Free" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </div>

      {/* CSS keyframes for orbit animations */}
      <style>{`
        @keyframes horoscope-orbit-0 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes horoscope-orbit-1 { from { transform: rotate(120deg); } to { transform: rotate(480deg); } }
        @keyframes horoscope-orbit-2 { from { transform: rotate(240deg); } to { transform: rotate(600deg); } }
      `}</style>
    </motion.div>
  );
}

/* ─── Phase 2: Sign Selection ────────────────────────────────────────────────── */

function SelectPhase({
  selectedSign,
  onSelect,
}: {
  selectedSign: typeof SIGNS[number];
  onSelect: (sign: typeof SIGNS[number]) => void;
}) {
  const [localSelected, setLocalSelected] = useState<typeof SIGNS[number] | null>(null);

  const handleSelect = useCallback(
    (sign: typeof SIGNS[number]) => {
      setLocalSelected(sign);
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (localSelected) onSelect(localSelected);
  }, [localSelected, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="space-y-6 py-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Rashi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tap your Rashi to see today&apos;s planetary Bhavishyafal
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
        {SIGNS.map((sign, idx) => {
          const elColors = ELEMENT_COLORS[sign.element] ?? ELEMENT_COLORS["Fire"]!;
          const isSelected = localSelected?.name === sign.name;

          return (
            <motion.button
              key={sign.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, type: "spring", stiffness: 200, damping: 20 }}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(sign)}
              className={`relative overflow-hidden rounded-2xl p-3 sm:p-4 text-center transition-all border ${
                isSelected
                  ? `bg-gradient-to-br ${elColors.from} ${elColors.to} text-white border-amber-400/60 shadow-lg`
                  : "bg-surface/80 backdrop-blur-xl border-border/60 text-foreground hover:border-[var(--color-primary)]/30"
              }`}
              style={
                isSelected
                  ? { boxShadow: `0 0 24px 4px ${elColors.hexSoft}` }
                  : undefined
              }
            >
              {/* Element badge */}
              <span
                className={`absolute top-1.5 right-1.5 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : `${elColors.bg} ${elColors.text}`
                }`}
              >
                {sign.element}
              </span>

              <div className={`text-2xl sm:text-3xl mb-1 ${isSelected ? "" : "transition-transform"}`}>
                {sign.symbol}
              </div>
              <p className={`text-xs sm:text-sm font-bold ${isSelected ? "text-white" : "text-foreground"}`}>
                {sign.name}
              </p>
              <p className={`text-[9px] sm:text-[10px] mt-0.5 ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                {sign.dates}
              </p>

              {/* Golden glow border on selected */}
              {isSelected && (
                <motion.div
                  layoutId="horoscope-selected-glow"
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    boxShadow: "0 0 16px 2px rgba(251,191,36,0.4), inset 0 0 16px rgba(251,191,36,0.1)",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Confirm button appears after selection */}
      <AnimatePresence>
        {localSelected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex justify-center pt-2"
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              disabled={!localSelected}
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-base hover:shadow-2xl hover:shadow-amber-500/30 transition-all inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Star size={18} /> Read Today&apos;s Bhavishyafal
              <ChevronRight size={16} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Phase 3: Computing ─────────────────────────────────────────────────────── */

function ComputingPhase({
  sign,
  label,
  error,
  onRetry,
}: {
  sign: typeof SIGNS[number];
  label: string;
  error: string | null;
  onRetry: () => void;
}) {
  const colors = ELEMENT_COLORS[sign.element] ?? ELEMENT_COLORS["Fire"]!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-6 py-12 relative"
    >
      {/* Background constellation lines */}
      <div className="absolute inset-0 opacity-40">
        <ConstellationLines />
      </div>

      {/* Background particle field */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 rounded-full bg-amber-400/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: Math.random() * 3,
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      {/* Planetary transit visualization */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64">
        {/* Orbit rings */}
        {[40, 65, 90, 110].map((r) => (
          <div
            key={r}
            className="absolute rounded-full border border-amber-500/10"
            style={{
              width: r * 2,
              height: r * 2,
              top: `calc(50% - ${r}px)`,
              left: `calc(50% - ${r}px)`,
            }}
          />
        ))}

        {/* Central sun */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/40"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Orbiting planets at different speeds */}
        {[
          { dist: 40, size: 6, dur: 3, color: "#60a5fa", startAngle: 45 },
          { dist: 65, size: 8, dur: 5, color: "#f472b6", startAngle: 180 },
          { dist: 90, size: 5, dur: 7, color: "#34d399", startAngle: 90 },
          { dist: 110, size: 7, dur: 4, color: "#a78bfa", startAngle: 270 },
        ].map((planet, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2"
            style={{
              width: 0,
              height: 0,
              animation: `horoscope-compute-orbit-${i} ${planet.dur}s linear infinite`,
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: planet.size,
                height: planet.size,
                backgroundColor: planet.color,
                marginLeft: -planet.size / 2,
                marginTop: -planet.size / 2,
                transform: `translate(${planet.dist}px, 0)`,
                boxShadow: `0 0 6px ${planet.color}80`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Degree counter */}
      <div className="flex flex-col items-center gap-1">
        <DegreeCounter />
        <span className="text-xs text-muted-foreground">
          {sign.name}&apos;s transit angle
        </span>
      </div>

      {/* Cycling label */}
      <motion.p
        key={label}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }}
        className="text-sm text-muted-foreground text-center"
      >
        {label}
      </motion.p>

      {/* Error state with retry */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm max-w-xs text-center">
            {error}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> Try Again
          </button>
        </motion.div>
      )}

      {/* CSS keyframes for computing orbits */}
      <style>{`
        @keyframes horoscope-compute-orbit-0 { from { transform: rotate(45deg); } to { transform: rotate(405deg); } }
        @keyframes horoscope-compute-orbit-1 { from { transform: rotate(180deg); } to { transform: rotate(540deg); } }
        @keyframes horoscope-compute-orbit-2 { from { transform: rotate(90deg); } to { transform: rotate(450deg); } }
        @keyframes horoscope-compute-orbit-3 { from { transform: rotate(270deg); } to { transform: rotate(630deg); } }
      `}</style>
    </motion.div>
  );
}

/* ─── Phase 4: Reading ───────────────────────────────────────────────────────── */

function ReadingPhase({
  sign,
  data,
  loading,
  error,
  onReset,
  onRetry,
  onGoDeeper,
}: {
  sign: typeof SIGNS[number];
  data: HoroscopePayload | null;
  loading: boolean;
  error: string | null;
  onReset: () => void;
  onRetry: () => void;
  onGoDeeper: () => void;
}) {
  const colors = ELEMENT_COLORS[sign.element] ?? ELEMENT_COLORS["Fire"]!;
  const fallbackLucky = useMemo(() => generateLuckyInfo(sign.name, sign.element), [sign.name, sign.element]);
  const lucky = data?.lucky ?? fallbackLucky;
  const reading = data?.reading ?? "";
  const [burstActive, setBurstActive] = useState(true);

  // Auto-dismiss particle burst after animation
  useEffect(() => {
    const t = setTimeout(() => setBurstActive(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      className="space-y-6 py-4"
    >
      {/* Element-colored particle burst on entry */}
      <div className="relative h-0 overflow-visible">
        <ParticleBurst hex={colors.hex} active={burstActive} />
      </div>

      {/* Sign header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center text-4xl shadow-xl`}
            style={{ boxShadow: `0 0 30px ${colors.hexSoft}` }}
          >
            {sign.symbol}
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">{sign.name}</h2>
          <div className="flex items-center gap-2 mt-1 justify-center">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>
              {sign.element}
            </span>
            <span className="text-xs text-muted-foreground">{sign.dates}</span>
          </div>
        </div>
      </motion.div>

      {/* Loading state — premium skeleton while the computed sky assembles */}
      {!reading && !error && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-3 py-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Compass className="w-8 h-8 text-amber-400" />
            </motion.div>
            <p className="text-sm text-muted-foreground" role="status">
              {loading ? "Preparing your Bhavishyafal…" : "Reading today's computed transits…"}
            </p>
          </div>
          {[100, 92, 78, 96, 60].map((w, i) => (
            <div key={i} className="relative overflow-hidden h-3.5 rounded-full bg-surface-raised/60" style={{ width: `${w}%`, marginInline: "auto" }}>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear", delay: i * 0.12 }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm max-w-3xl mx-auto text-center"
        >
          <p className="mb-3">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> Try Again
          </button>
        </motion.div>
      )}

      {/* Reading content */}
      {reading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 180, damping: 22 }}
          className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 max-w-3xl mx-auto"
        >
          {/* Background accent */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
            style={{ backgroundColor: colors.hexSoft }}
          />
          <motion.div
            className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/[0.03] to-transparent blur-3xl rounded-full pointer-events-none"
            animate={{ x: [0, 20, 0], y: [0, -15, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative space-y-6">
            {/* Today's Energy badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <div
                className={`px-5 py-2.5 rounded-full bg-gradient-to-r ${colors.from} ${colors.to} bg-opacity-15 border ${colors.border}`}
                style={{ backgroundColor: colors.hexSoft }}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60 mr-2">
                  Today&apos;s Energy
                </span>
                <span className="text-sm font-bold text-white">{sign.element}</span>
              </div>
            </motion.div>

            {/* Moon position banner (computed) */}
            {data?.moon && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
              >
                <Moon size={12} className="text-blue-300" />
                <span>
                  Moon in <span className="font-bold text-foreground">{data.moon.sign}</span>
                  {" · "}{data.moon.nakshatra} pada {data.moon.pada}
                </span>
              </motion.div>
            )}

            {/* Soft notice when the AI lane was unavailable — reading is still complete */}
            {data && !data.aiAvailable && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-full px-4 py-1.5 mx-auto w-fit"
              >
                AI Jyotishi lane is busy — this reading is generated deterministically from today&apos;s exact computed transits.
              </motion.p>
            )}

            {/* Main forecast — structured markdown, never raw */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <ReadingMarkdown source={reading} />
            </motion.div>

            {/* Live gochara grid — real ephemeris numbers */}
            {data && data.transits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-2xl bg-surface-raised/40 border border-border/40 p-4"
              >
                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Orbit size={11} className="text-amber-400" />
                  Live gochara — computed sidereal positions{data.date ? ` for ${data.date}` : ""}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {data.transits.map((t) => (
                    <div
                      key={t.code}
                      className="flex flex-col items-center gap-0.5 rounded-xl bg-surface/70 border border-border/40 px-2 py-2.5 hover:border-amber-400/30 transition-colors"
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                        {t.code}
                      </span>
                      <span className="text-[11px] font-bold text-foreground">{t.sign}</span>
                      <span className="text-[9px] text-muted-foreground">
                        House {t.house} · {t.degreesInSign.toFixed(1)}&deg;
                      </span>
                      {t.retrograde && (
                        <span className="text-[8px] font-black uppercase text-rose-400">Rx</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Lucky numbers / time / color */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-3 gap-3"
            >
              <div className="rounded-2xl bg-surface-raised/50 border border-border/40 p-3 text-center">
                <Hash size={14} className="mx-auto mb-1 text-amber-400" />
                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                  Lucky Numbers
                </p>
                <p className="text-sm font-bold text-foreground">
                  {lucky.numbers.join(", ")}
                </p>
              </div>
              <div className="rounded-2xl bg-surface-raised/50 border border-border/40 p-3 text-center">
                <Clock size={14} className="mx-auto mb-1 text-amber-400" />
                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                  Auspicious Time
                </p>
                <p className="text-xs font-bold text-foreground">{lucky.time}</p>
              </div>
              <div className="rounded-2xl bg-surface-raised/50 border border-border/40 p-3 text-center">
                <Palette size={14} className="mx-auto mb-1 text-amber-400" />
                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                  Lucky Colour
                </p>
                <p className="text-sm font-bold text-foreground">{lucky.color}</p>
              </div>
            </motion.div>

            {/* Compatibility hint */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-pink-500/5 border border-pink-500/15"
            >
              <Heart size={16} className="text-pink-400 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-pink-400 mb-0.5">
                  Best Compatibility
                </p>
                <p className="text-sm text-foreground">
                  Today, {lucky.compatibility}&apos;s energy favours relationships
                </p>
              </div>
            </motion.div>

            {/* AI attribution footer */}
            <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                {(data?.sources.length ? data.sources : ["Zeal AI Jyotishi"]).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-raised/60 border border-border/40 text-[9px] font-semibold"
                  >
                    <Sparkles size={8} className="text-amber-400" /> {s}
                  </span>
                ))}
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
      {reading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, type: "spring", stiffness: 180, damping: 22 }}
          className="max-w-3xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 p-6 sm:p-8">
            <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="relative">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Zap size={18} className="text-amber-400" /> Go Deeper
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Want personalized guidance? Connect with an expert astrologer for a detailed chart reading.
              </p>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGoDeeper}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-amber-500/20 transition-shadow"
              >
                <Users size={14} /> Meet Our Astrologers
                <ArrowRight size={14} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Phase 5: Consultant Grid ───────────────────────────────────────────────── */

function ConsultPhase({
  consultants,
  loadingConsultants,
  onReset,
}: {
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="space-y-6 py-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Experienced Astrologers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect with verified astrology experts and get personalized guidance for yourself
        </p>
      </div>

      {loadingConsultants ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="text-amber-400 animate-spin" />
        </div>
      ) : consultants.length === 0 ? (
        <div className="text-center py-12">
          <Users size={32} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-4">No astrology experts online right now</p>
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5"
          >
            <RotateCcw size={12} /> New Reading
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {consultants.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Link
                href={`/consultant/${c.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl bg-surface/80 backdrop-blur-xl border border-border/60 hover:border-amber-500/30 transition-all group"
              >
                <div className="relative shrink-0">
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-400 text-sm font-bold overflow-hidden">
                    {c.avatar ? (
                      <Image src={c.avatar} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      c.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  {c.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {c.specialties?.[0] ?? c.category}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      <Star size={9} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-bold text-foreground">
                        {c.rating.toFixed(1)}
                      </span>
                    </div>
                    {c.perMinuteRate !== null && (
                      <span className="text-[10px] text-muted-foreground">
                        ₹{c.perMinuteRate}/min
                      </span>
                    )}
                    {c.isOnline && (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                        <Clock size={8} /> Online
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={14}
                  className="text-muted-foreground group-hover:text-amber-400 transition-colors shrink-0"
                />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Back to new reading */}
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={onReset}
          className="px-5 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5"
        >
          <RotateCcw size={12} /> New Reading
        </button>
      </div>
    </motion.div>
  );
}
