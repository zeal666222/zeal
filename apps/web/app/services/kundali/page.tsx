"use client";

// ============================================================================
// Janam Kundali — real computed chart + Hinglish AI interpretation.
// All numbers on this page come from /api/kundali (deterministic astronomical
// engine). The AI only interprets; the client never shows fabricated values.
// ----------------------------------------------------------------------------
// Motion policy: apps/web resolves its own framer-motion copy (12.43.0 in
// apps/web/node_modules), which has NO LazyMotion context — @zeal/ui's
// MotionProvider belongs to a separate packages/ui copy. So app-level files
// must use full `motion`; `m` here would render stuck at initial opacity 0.
// Inside packages/ui components the rule is inverted: use `m` (strict LazyMotion).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Calendar, CheckCircle2, Clock, Diamond, Gauge,
  Layers, Link2, Loader2, MapPin, Orbit, Printer, RotateCcw, ScrollText,
  Share2, ShieldCheck, Sparkles, Square, Star, User, UserRound, Users, Wand2,
  X, XCircle,
} from "lucide-react";
import { cn, LocationAutocomplete, BrandSpinner, type PlaceSuggestionData } from "@zeal/ui";
import { ReadingMarkdown, sanitizeReading } from "@/components/astrology/ReadingMarkdown";
import type { KundaliResult, PlanetInHouse } from "@/lib/kundali/engine";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type Phase = "intro" | "input" | "computing" | "reading";
type ChartStyle = "north" | "south";

interface FormData {
  name: string;
  dob: string;
  tob: string;
  pob: string;
  question: string;
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

interface PlanetTip {
  p: PlanetInHouse;
  x: number; // svg coords (viewBox -2..202)
  y: number;
}

interface RecentProfile {
  name: string;
  dob: string;
  tob: string;
  pob: string;
}

interface SavedBirthProfile {
  fullName: string;
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  primaryConcern: string;
}

interface ChartProps {
  kundali: KundaliResult;
  activePlanet: string | null;
  onTip: (t: PlanetTip | null) => void;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const EMPTY_FORM: FormData = { name: "", dob: "", tob: "", pob: "", question: "" };

const PLANETS = [
  { symbol: "Su", name: "Sun" },
  { symbol: "Ch", name: "Moon" },
  { symbol: "Ma", name: "Mars" },
  { symbol: "Me", name: "Mercury" },
  { symbol: "Ju", name: "Jupiter" },
  { symbol: "Ve", name: "Venus" },
  { symbol: "Sa", name: "Saturn" },
];

// Two-character sign codes (no emoji/symbols anywhere in the chart UI).
const ZODIAC_SIGNS = [
  "Ar", "Ta", "Ge", "Cn", "Le", "Vi",
  "Li", "Sc", "Sg", "Cp", "Aq", "Pi",
];

const SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const HINGLISH_SIGNS: Record<string, string> = {
  Aries: "Mesha", Taurus: "Vrishabha", Gemini: "Mithuna", Cancer: "Karka",
  Leo: "Simha", Virgo: "Kanya", Libra: "Tula", Scorpio: "Vrishchika",
  Sagittarius: "Dhanu", Capricorn: "Makara", Aquarius: "Kumbha", Pisces: "Meena",
};

// Vedic two-letter graha codes — the convention Indian chart readers expect.
const CHART_GLYPHS: Record<string, string> = {
  Sun: "Su", Moon: "Ch", Mars: "Ma", Mercury: "Me", Jupiter: "Ju",
  Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

const COMPUTE_STEPS = [
  "Calculating planetary positions from the ephemeris…",
  "Determining the Lagna and Bhavas…",
  "Computing Nakshatra, Tithi and Dasha…",
  "Running the chart self-verification…",
  "Our Jyotishi is interpreting your chart…",
];

// Minimum time the computing animation stays visible — keeps phase transitions
// smooth when the result is served from cache, and never reveals the chart
// before the real request has resolved.
const MIN_COMPUTE_MS = 2800;

// Deep-link + saved-profile storage keys
const DEEP_LINK_KEY = "k";
const RECENT_PROFILES_KEY = "zeal:kundali:recent-profiles";
const RECENT_PROFILES_MAX = 5;

const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 22 } as const;
const SPRING_PILL = { type: "spring", stiffness: 320, damping: 26 } as const;
const SPRING_SWAP = { type: "spring", stiffness: 260, damping: 24 } as const;
const SPRING_TIP = { type: "spring", stiffness: 380, damping: 26 } as const;

/* ─── North-Indian chart geometry (viewBox 0 0 200 200) ─────────────────────── */

interface HouseShape {
  house: number;
  points: string;
  lx: number;
  ly: number;
  numDx: number;
  numDy: number;
}

const HOUSE_SHAPES: HouseShape[] = [
  { house: 1, points: "100,0 50,50 100,100 150,50", lx: 100, ly: 52, numDx: 0, numDy: -26 },
  { house: 2, points: "0,0 100,0 50,50", lx: 50, ly: 24, numDx: -22, numDy: -8 },
  { house: 3, points: "0,0 50,50 0,100", lx: 26, ly: 50, numDx: -10, numDy: -26 },
  { house: 4, points: "0,100 50,50 100,100 50,150", lx: 52, ly: 122, numDx: 0, numDy: 26 },
  { house: 5, points: "0,100 0,200 50,150", lx: 26, ly: 150, numDx: -10, numDy: 12 },
  { house: 6, points: "50,150 0,200 100,200", lx: 50, ly: 176, numDx: -22, numDy: 8 },
  { house: 7, points: "100,200 50,150 100,100 150,150", lx: 100, ly: 148, numDx: 0, numDy: 26 },
  { house: 8, points: "100,200 150,150 200,200", lx: 150, ly: 176, numDx: 22, numDy: 8 },
  { house: 9, points: "150,150 200,100 200,200", lx: 174, ly: 150, numDx: 10, numDy: 12 },
  { house: 10, points: "200,100 150,50 100,100 150,150", lx: 148, ly: 122, numDx: 0, numDy: -26 },
  { house: 11, points: "200,0 200,100 150,50", lx: 174, ly: 50, numDx: 10, numDy: -26 },
  { house: 12, points: "100,0 200,0 150,50", lx: 150, ly: 24, numDx: 22, numDy: -8 },
];

/* ─── South-Indian chart geometry (4×4 grid, viewBox 0 0 200 200) ─────────────
   Standard South style: 12 bahar ke cells = rashis, fixed positions.
   Top-left cell = rashi 1 (Mesha), phir clockwise (ghadi ki disha mein). */

const SOUTH_CELLS: Array<{ rashi: number; col: number; row: number }> = [
  { rashi: 1, col: 0, row: 0 },
  { rashi: 2, col: 1, row: 0 },
  { rashi: 3, col: 2, row: 0 },
  { rashi: 4, col: 3, row: 0 },
  { rashi: 5, col: 3, row: 1 },
  { rashi: 6, col: 3, row: 2 },
  { rashi: 7, col: 3, row: 3 },
  { rashi: 8, col: 2, row: 3 },
  { rashi: 9, col: 1, row: 3 },
  { rashi: 10, col: 0, row: 3 },
  { rashi: 11, col: 0, row: 2 },
  { rashi: 12, col: 0, row: 1 },
];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function signLabel(sign: string): string {
  const h = HINGLISH_SIGNS[sign];
  return h ? `${h} (${sign})` : sign;
}

function signIndex(sign: string): number {
  return SIGN_NAMES.indexOf(sign);
}

function signGlyph(sign: string): string {
  const i = signIndex(sign);
  return i >= 0 ? (ZODIAC_SIGNS[i] ?? "") : "";
}

function planetGlyph(p: string): string {
  return CHART_GLYPHS[p] ?? p.slice(0, 2);
}

// Degree within sign → "12°34′" (sign°' format). Deterministic rounding.
function degreeDms(deg: number): string {
  let d = Math.floor(deg);
  let m = Math.round((deg - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return `${d}°${String(m).padStart(2, "0")}′`;
}

// Deterministic seeded pseudo-random (same pattern as ComputingPhase particles)
// so SSR HTML and client markup stay identical.
function seededRnd(i: number, n: number): number {
  const v = Math.sin((i + 1) * 127.1 + n * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function confidenceTone(score: number) {
  if (score >= 85) {
    return {
      text: "text-emerald-400",
      bar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      label: "High confidence",
    };
  }
  if (score >= 60) {
    return {
      text: "text-amber-400",
      bar: "bg-gradient-to-r from-amber-500 to-yellow-400",
      label: "Good confidence — an exact birth minute can make it even more accurate",
    };
  }
  return {
    text: "text-rose-400",
    bar: "bg-gradient-to-r from-rose-500 to-orange-400",
    label: "Please correct your birth data — accuracy may be affected",
  };
}

function buildShareText(k: KundaliResult, interpretation: string | null): string {
  const lines = [
    `Birth Kundali — ${k.input.name}`,
    `Birth: ${k.input.birthDate} ${k.input.birthTime}, ${k.input.place}`,
    `Lagna: ${signLabel(k.chart.ascendantSign)} ${k.chart.ascendantDegree.toFixed(1)}° · Rashi: ${signLabel(k.chart.moonSign)} (${k.chart.moonNakshatra}) · Sun: ${signLabel(k.chart.sunSign)}`,
    `Panchanga: Tithi ${k.panchanga.tithi} · Nakshatra ${k.panchanga.nakshatra} · Yoga ${k.panchanga.yoga} · Karana ${k.panchanga.karana}`,
    ``,
    `Planet positions:`,
    ...k.chart.planets.map(
      (p) =>
        `  ${p.planet}: ${signLabel(p.sign)} ${p.degree.toFixed(2)}° · Bhava ${p.house} · ${p.nakshatra} pada ${p.nakshatraPada}${p.isRetrograde ? " · R" : ""}`,
    ),
    ``,
    `Current Dasha: ${k.dasha.currentMahadasha} Mahadasha / ${k.dasha.currentAntardasha} Antardasha (${k.dasha.remainingYears.toFixed(1)}y remaining)`,
    `Confidence: ${k.confidence.score}/100`,
  ];
  if (interpretation) {
    lines.push(``, `Jyotishi interpretation:`, markdownToPlainText(interpretation));
  }
  lines.push(``, `— Zeal`);
  return lines.join("\n");
}

/** Clipboard-friendly plain text — same content, no markdown syntax. */
function markdownToPlainText(src: string): string {
  return sanitizeReading(src)
    .split("\n")
    .filter((l) => !/^\s*```/.test(l))
    .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
    .map((l) => {
      let line = l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
      if (/^\s*\|/.test(line)) line = line.split("|").map((c) => c.trim()).filter(Boolean).join(" · ");
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ─── Deep-link (?k=) encode/decode — UTF-8 safe, URL-safe base64 ───────────── */

function encodeDeepLink(k: KundaliResult): string {
  const payload = {
    n: k.input.name,
    d: k.input.birthDate,
    t: k.input.birthTime,
    p: k.input.place,
    la: Math.round(k.input.resolvedPlace.lat * 10000) / 10000,
    ln: Math.round(k.input.resolvedPlace.lng * 10000) / 10000,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Strict validation — malformed / tampered params return null (never crash).
function decodeDeepLink(raw: string): FormData | null {
  try {
    let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const name = typeof obj.n === "string" ? obj.n.trim().slice(0, 60) : "";
    const dob = typeof obj.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.d) ? obj.d : "";
    const tob = typeof obj.t === "string" && /^\d{2}:\d{2}$/.test(obj.t) ? obj.t : "";
    const pob = typeof obj.p === "string" ? obj.p.trim().slice(0, 120) : "";
    if (!name || !dob || !tob || !pob) return null;
    return { name, dob, tob, pob, question: "" };
  } catch {
    return null;
  }
}

function buildShareUrl(k: KundaliResult): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?${DEEP_LINK_KEY}=${encodeDeepLink(k)}`;
}

function writeDeepLink(k: KundaliResult): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(DEEP_LINK_KEY, encodeDeepLink(k));
    window.history.replaceState(null, "", url.toString());
  } catch {
    // URL update is best-effort — never break the flow for it.
  }
}

function clearDeepLink(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(DEEP_LINK_KEY)) return;
    url.searchParams.delete(DEEP_LINK_KEY);
    window.history.replaceState(null, "", url.toString());
  } catch {
    // ignore
  }
}

// Clipboard with classic execCommand fallback (http / older browsers).
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ─── Recent birth profiles (localStorage, max 5) ───────────────────────────── */

function readRecentProfiles(): RecentProfile[] {
  try {
    const raw = localStorage.getItem(RECENT_PROFILES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[])
      .filter(
        (r): r is RecentProfile =>
          !!r &&
          typeof r === "object" &&
          typeof (r as RecentProfile).name === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test((r as RecentProfile).dob),
      )
      .slice(0, RECENT_PROFILES_MAX);
  } catch {
    return [];
  }
}

function saveRecentProfile(p: RecentProfile): void {
  try {
    const list = readRecentProfiles().filter(
      (r) => !(r.name === p.name && r.dob === p.dob),
    );
    list.unshift(p);
    localStorage.setItem(RECENT_PROFILES_KEY, JSON.stringify(list.slice(0, RECENT_PROFILES_MAX)));
  } catch {
    // storage may be unavailable (private mode) — silently skip
  }
}

function dropRecentProfile(p: RecentProfile): void {
  try {
    const list = readRecentProfiles().filter(
      (r) => !(r.name === p.name && r.dob === p.dob),
    );
    localStorage.setItem(RECENT_PROFILES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export default function KundaliPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [kundali, setKundali] = useState<KundaliResult | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loadingConsultants, setLoadingConsultants] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const computeStartRef = useRef(0);
  const aliveRef = useRef(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkHandledRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    if (phase !== "reading") return;
    let cancelled = false;
    setLoadingConsultants(true);
    fetch("/api/explore/consultants?category=ASTROLOGY&online=true&limit=4")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = (data.consultants ?? data.items ?? (Array.isArray(data) ? data : [])) as AvailableConsultant[];
        setConsultants(items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingConsultants(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Core compute pipeline — used by the form submit AND by deep-link auto-restore.
  const runCompute = useCallback(async (form: FormData) => {
    setError("");
    setSubmitting(true);
    setPhase("computing");
    computeStartRef.current = Date.now();

    try {
      const res = await fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        aiAvailable?: boolean;
        kundali?: KundaliResult;
        interpretation?: string;
      };
      if (!res.ok || !payload.kundali) {
        throw new Error(
          payload.error ?? `Kundali computation failed (HTTP ${res.status}). Please try again.`,
        );
      }

      const elapsed = Date.now() - computeStartRef.current;
      if (elapsed < MIN_COMPUTE_MS) {
        await new Promise((r) => setTimeout(r, MIN_COMPUTE_MS - elapsed));
      }
      if (!aliveRef.current) return;

      setKundali(payload.kundali);
      setInterpretation(payload.interpretation ?? null);
      setAiAvailable(payload.aiAvailable !== false);

      // Deep-link: after a chart is computed, keep the birth inputs in the URL
      // so reload / share restores and auto-computes the same chart.
      writeDeepLink(payload.kundali);
      // Saved-profile store for the InputPhase quick-fill row.
      saveRecentProfile({ name: form.name, dob: form.dob, tob: form.tob, pob: form.pob });

      setPhase("reading");
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setPhase("input");
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      void runCompute(formData);
    },
    [formData, submitting, runCompute],
  );

  // Deep-link restore: ?k=... → refill + auto-compute. Malformed → graceful ignore.
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    let raw: string | null = null;
    try {
      raw = new URLSearchParams(window.location.search).get(DEEP_LINK_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    const restored = decodeDeepLink(raw);
    if (!restored) {
      showToast("We couldn't read this share link — please fill in the details again");
      return;
    }
    setFormData(restored);
    void runCompute(restored);
  }, [runCompute, showToast]);

  const handleReset = useCallback(() => {
    setKundali(null);
    setInterpretation(null);
    setAiAvailable(true);
    setError("");
    setFormData(EMPTY_FORM);
    clearDeepLink();
    setPhase("intro");
  }, []);

  const handleShare = useCallback(async () => {
    if (!kundali) return false;
    return copyToClipboard(buildShareText(kundali, interpretation));
  }, [kundali, interpretation]);

  const handleCopyLink = useCallback(async () => {
    if (!kundali) return;
    const ok = await copyToClipboard(buildShareUrl(kundali));
    showToast(ok ? "Link copied — the chart will show up right when it's opened" : "Couldn't copy the link — please copy it from the address bar");
  }, [kundali, showToast]);

  return (
    <div className="min-h-screen-app pb-16">
      <PrintStyles />
      <HeroHeader phase={phase} onReset={handleReset} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <IntroPhase key="intro" onBegin={() => setPhase("input")} />
          )}
          {phase === "input" && (
            <InputPhase
              key="input"
              formData={formData}
              setFormData={setFormData}
              error={error}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
          {phase === "computing" && <ComputingPhase key="computing" />}
          {phase === "reading" && kundali && (
            <ReadingPhase
              key="reading"
              kundali={kundali}
              interpretation={interpretation}
              aiAvailable={aiAvailable}
              consultants={consultants}
              loadingConsultants={loadingConsultants}
              onShare={handleShare}
              onCopyLink={handleCopyLink}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>

        {/* Free badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-10 print-hide"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> 100% Free · No sign-up required
          </span>
        </motion.div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

/* ─── Print / PDF stylesheet ────────────────────────────────────────────────── */

function PrintStyles() {
  return (
    <style>{`@media print {
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .kundali-print-root, .kundali-print-root * { visibility: visible !important; }
  .kundali-print-root { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0 !important; }
  .kundali-print-root .print-hide, .print-hide { display: none !important; }
  .kundali-print-root, .kundali-print-root * {
    color: #000000 !important;
    background: transparent !important;
    border-color: #999999 !important;
    box-shadow: none !important;
    text-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .kundali-print-root svg text { fill: #000000 !important; }
  .kundali-print-root svg line, .kundali-print-root svg rect, .kundali-print-root svg polygon { stroke: #000000 !important; }
  .kundali-print-root .print-avoid-break { break-inside: avoid; }
  @page { margin: 14mm; }
}`}</style>
  );
}

/* ─── Toast ─────────────────────────────────────────────────────────────────── */

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <div key="toast" className="fixed bottom-6 inset-x-0 z-[60] flex justify-center pointer-events-none print-hide">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={SPRING_TIP}
            className="px-4 py-2.5 rounded-full bg-[var(--color-surface)]/90 backdrop-blur-xl border border-[var(--color-luxury-glass-border)] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] flex items-center gap-2 text-xs font-bold text-foreground"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            {message}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ─── Hero Header ───────────────────────────────────────────────────────────── */

function HeroHeader({ phase, onReset }: { phase: Phase; onReset: () => void }) {
  return (
    <div className="relative overflow-hidden border-b border-border/40">
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[var(--color-primary)]/[0.06] blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-amber-500/[0.05] blur-[140px] rounded-full pointer-events-none" />
      <FloatingParticles />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <Orbit size={12} /> Vedic Ephemeris Engine · 100% Deterministic
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
            Janam Kundali — Birth Chart
          </h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Exact planetary positions, Bhavas and Dasha from the astronomical engine — then an
            interpretation that starts by verifying your past.
          </p>
          {phase !== "intro" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.97 }}
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

/* ─── Floating Particles ────────────────────────────────────────────────────── */

function FloatingParticles() {
  // Deterministic pseudo-random (sin hash) so SSR HTML and client markup match.
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: seededRnd(i, 1) * 100,
        y: seededRnd(i, 2) * 100,
        dur: 6 + seededRnd(i, 3) * 4,
        delay: seededRnd(i, 4) * 3,
        repeatDelay: seededRnd(i, 5) * 2,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-amber-400/30"
          initial={{
            x: `${p.x.toFixed(3)}%`,
            y: `${p.y.toFixed(3)}%`,
            opacity: 0,
          }}
          animate={{
            y: [null, -20, 20, -10, 0],
            opacity: [0, 0.6, 0.3, 0.5, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: p.repeatDelay,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Floating Planetary Symbols ────────────────────────────────────────────── */

function FloatingPlanets() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {PLANETS.map((planet, i) => {
        const angle = (i / PLANETS.length) * Math.PI * 2;
        const radius = 120 + (i % 3) * 30;
        return (
          <motion.div
            key={planet.name}
            className="absolute text-amber-400/20 text-xl font-serif"
            style={{
              left: "50%",
              top: "50%",
            }}
            animate={{
              x: [
                Math.cos(angle) * radius,
                Math.cos(angle + 0.5) * (radius + 15),
                Math.cos(angle + 1) * (radius - 10),
                Math.cos(angle) * radius,
              ],
              y: [
                Math.sin(angle) * radius,
                Math.sin(angle + 0.5) * (radius + 15),
                Math.sin(angle + 1) * (radius - 10),
                Math.sin(angle) * radius,
              ],
              opacity: [0.15, 0.35, 0.2, 0.15],
            }}
            transition={{
              duration: 12 + i * 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {planet.symbol}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Zodiac Wheel ──────────────────────────────────────────────────────────── */

function ZodiacWheel() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.div
        className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border border-amber-500/10" />
        <div className="absolute inset-4 rounded-full border border-amber-500/[0.07]" />
        <div className="absolute inset-8 rounded-full border border-[var(--color-primary)]/[0.06]" />

        {/* Zodiac signs around the wheel */}
        {ZODIAC_SIGNS.map((sign, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const r = 46;
          // Fixed-precision so SSR and client produce identical strings (Float rounding differs across engines).
          const left = (50 + Math.cos(a) * r).toFixed(3);
          const top = (50 + Math.sin(a) * r).toFixed(3);
          return (
            <span
              key={i}
              className="absolute text-amber-500/15 text-sm"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {sign}
            </span>
          );
        })}

        {/* House division lines */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * 360;
          return (
            <div
              key={`line-${i}`}
              className="absolute top-1/2 left-1/2 w-[1px] h-1/2 bg-amber-500/[0.06] origin-top"
              style={{ transform: `rotate(${a}deg)` }}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

/* ─── Phase 1: Intro ────────────────────────────────────────────────────────── */

function IntroPhase({ onBegin }: { onBegin: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={SPRING_SOFT}
      className="flex flex-col items-center gap-8 py-12"
    >
      {/* Zodiac wheel + planets background */}
      <div className="relative w-full max-w-md h-[300px] sm:h-[360px]">
        <ZodiacWheel />
        <FloatingPlanets />

        {/* Central glow */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-amber-500/10 blur-2xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Central birth point */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400/60"
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="text-center space-y-3 max-w-md">
        <h2 className="text-2xl font-bold text-foreground">Your Cosmic Blueprint</h2>
        <p className="text-muted-foreground text-sm">
          Every planetary position is calculated from a real astronomical ephemeris (Lahiri ayanamsa,
          correct timezone) — the AI only interprets; it never guesses numbers.
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onBegin}
        className="px-8 py-5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-[var(--color-primary)]/30 transition-all inline-flex items-center gap-3"
      >
        <Sparkles size={22} /> Start Building Your Kundali
      </motion.button>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
        {[
          {
            icon: Orbit,
            title: "1. Chart Computation",
            desc: "The deterministic Vedic engine computes exact planetary positions, Bhavas, Nakshatras and Dasha — all 9 grahas, the same result every time.",
          },
          {
            icon: ShieldCheck,
            title: "2. Verification First",
            desc: "Along with the chart you get self-consistency checks and past-Dasha anchors — match them yourself and build your trust.",
          },
          {
            icon: Sparkles,
            title: "3. Jyotishi Interpretation",
            desc: "The Jyotishi AI interprets your real computed chart — background analysis, past-event verification, then the road ahead.",
          },
        ].map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="p-4 rounded-2xl bg-surface/60 border border-border/40 hover:border-[var(--color-primary)]/25 transition-colors"
          >
            <step.icon size={16} className="text-[var(--color-primary)] mb-2" />
            <p className="text-xs font-bold text-foreground">{step.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Phase 2: Input ────────────────────────────────────────────────────────── */

function InputPhase({
  formData,
  setFormData,
  error,
  submitting,
  onSubmit,
}: {
  formData: FormData;
  setFormData: (d: FormData) => void;
  error: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [resolvedPlace, setResolvedPlace] = useState<PlaceSuggestionData | null>(null);
  const [savedProfile, setSavedProfile] = useState<SavedBirthProfile | null>(null);
  const [recents, setRecents] = useState<RecentProfile[]>([]);

  // Quick-fill sources: (1) account birth profile via existing GET /api/profile/birth,
  // (2) recent kundali profiles from localStorage. Read-only reuse — no new endpoints.
  useEffect(() => {
    setRecents(readRecentProfiles());
    let cancelled = false;
    fetch("/api/profile/birth")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { profile?: Record<string, unknown> | null } | null) => {
        if (cancelled || !d?.profile) return;
        const p = d.profile;
        const fullName = typeof p.fullName === "string" ? p.fullName.trim() : "";
        const dateOfBirth = typeof p.dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth) ? p.dateOfBirth : "";
        if (!fullName || !dateOfBirth) return;
        const rawTob = typeof p.timeOfBirth === "string" ? p.timeOfBirth : "";
        setSavedProfile({
          fullName,
          dateOfBirth,
          timeOfBirth: /^\d{2}:\d{2}/.test(rawTob) ? rawTob.slice(0, 5) : "",
          placeOfBirth: typeof p.placeOfBirth === "string" ? p.placeOfBirth.trim() : "",
          primaryConcern: typeof p.primaryConcern === "string" ? p.primaryConcern.trim() : "",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fields = [
    { key: "name" as const, label: "Your Name", icon: User, type: "text", placeholder: "Full name (as on your hospital record)" },
    { key: "dob" as const, label: "Date of Birth", icon: Calendar, type: "date", placeholder: "" },
    { key: "tob" as const, label: "Time of Birth", icon: Clock, type: "time", placeholder: "" },
    { key: "pob" as const, label: "Place of Birth", icon: MapPin, type: "text", placeholder: "City, State — e.g. Pune, Maharashtra" },
  ];

  const applySavedProfile = () => {
    if (!savedProfile) return;
    setFormData({
      ...formData,
      name: savedProfile.fullName,
      dob: savedProfile.dateOfBirth,
      tob: savedProfile.timeOfBirth || formData.tob,
      pob: savedProfile.placeOfBirth || formData.pob,
      question: formData.question || savedProfile.primaryConcern,
    });
  };

  const applyRecent = (r: RecentProfile) => {
    setFormData({ ...formData, name: r.name, dob: r.dob, tob: r.tob || formData.tob, pob: r.pob || formData.pob });
  };

  const removeRecent = (r: RecentProfile) => {
    dropRecentProfile(r);
    setRecents(readRecentProfiles());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={SPRING_SOFT}
    >
      <form
        onSubmit={onSubmit}
        className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 space-y-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.03] blur-3xl rounded-full pointer-events-none" />
        <motion.div
          className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/[0.02] blur-3xl rounded-full pointer-events-none"
          animate={{ x: [0, 15, 0], y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-start gap-2"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Quick-fill: saved account profile + recent kundali profiles */}
          {(savedProfile || recents.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 240, damping: 22 }}
              className="flex flex-wrap items-center gap-2"
            >
              <p className="w-full flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <UserRound size={11} className="text-[var(--color-primary)]" /> Quick fill — previously used birth profiles
              </p>
              {savedProfile && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={applySavedProfile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] text-[11px] font-bold hover:bg-[var(--color-primary)]/20 transition-colors"
                >
                  <Wand2 size={11} /> Fill from your profile
                </motion.button>
              )}
              {recents.map((r) => (
                <span
                  key={`${r.name}|${r.dob}`}
                  className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-[var(--color-surface)]/70 backdrop-blur-xl border border-[var(--color-luxury-glass-border)] text-[11px] font-semibold text-foreground"
                >
                  <button type="button" onClick={() => applyRecent(r)} className="flex items-center gap-1.5 hover:text-[var(--color-primary)] transition-colors">
                    <User size={10} className="text-amber-400 shrink-0" />
                    <span className="max-w-[140px] truncate">{r.name}</span>
                    <span className="text-muted-foreground tabular-nums">{r.dob}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}'s profile`}
                    onClick={() => removeRecent(r)}
                    className="p-1 rounded-full hover:bg-surface-raised text-muted-foreground"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </motion.div>
          )}

          {/* Staggered field entry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {fields.map((field, i) => {
              const isFullWidth = field.key === "name" || field.key === "pob";
              return (
                <motion.div
                  key={field.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                  className={isFullWidth && i > 0 ? "sm:col-span-2" : ""}
                >
                  <label htmlFor={`fld-${field.key}`} className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
                    {field.label}
                  </label>
                  {field.key === "pob" ? (
                    <LocationAutocomplete
                      id="fld-pob"
                      required
                      recentStorageKey="zeal:recent-places:kundali"
                      placeholder="Search a city — suggestions appear as you type"
                      value={formData.pob}
                      onChange={(v) => setFormData({ ...formData, pob: v })}
                      onSelect={(p) => {
                        setFormData({ ...formData, pob: p.label });
                        setResolvedPlace(p);
                      }}
                    />
                  ) : null}
                  {field.key === "pob" && resolvedPlace?.source === "nominatim" && (
                    <p className="mt-1.5 text-[10px] text-amber-400/80">
                      These coordinates are approximate (from OpenStreetMap) — pick the exact city from the suggestions for better accuracy.
                    </p>
                  )}
                  {field.key !== "pob" && (
                    <div className="relative">
                      <field.icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id={`fld-${field.key}`}
                        type={field.type}
                        required
                        value={formData[field.key]}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, [field.key]: e.target.value })
                        }
                        placeholder={field.placeholder}
                        className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                      />
                    </div>
                  )}
                  {field.key === "tob" && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      24-hour format (e.g. 14:35). Take the exact minute from your hospital record — the Lagna depends on it.
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Optional question */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
          >
            <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
              Any specific question? (optional)
            </label>
            <textarea
              rows={2}
              maxLength={800}
              value={formData.question}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, question: e.target.value })
              }
              placeholder="Career, marriage, health, studies… write whatever you want to ask. Leave it blank for a complete reading."
              className="w-full px-4 py-3 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors resize-none"
            />
          </motion.div>

          {/* Accuracy hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15"
          >
            <Sparkles size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              The more exact your data, the truer your kundali. The chart is built 100% by the astronomical
              engine — the AI only interprets, so there is no room for arithmetic error.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-[var(--color-primary)]/20 transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <BrandSpinner size={18} /> Computing…
              </>
            ) : (
              <>
                Compute Kundali <ArrowRight size={18} />
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

/* ─── Phase 3: Computing ────────────────────────────────────────────────────── */

function ComputingPhase() {
  const [stepIndex, setStepIndex] = useState(0);
  const [orbitsDrawn, setOrbitsDrawn] = useState(0);
  const [planetsShown, setPlanetsShown] = useState(0);
  const [housesDrawn, setHousesDrawn] = useState(0);

  useEffect(() => {
    // Cycle step labels until the real request resolves.
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % COMPUTE_STEPS.length);
    }, 1400);

    const orbitTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 9; i++) {
      orbitTimers.push(setTimeout(() => setOrbitsDrawn(i + 1), 200 + i * 300));
    }

    const planetTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < PLANETS.length; i++) {
      planetTimers.push(setTimeout(() => setPlanetsShown(i + 1), 800 + i * 400));
    }

    const houseTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 12; i++) {
      houseTimers.push(setTimeout(() => setHousesDrawn(i + 1), 2000 + i * 150));
    }

    return () => {
      clearInterval(stepInterval);
      orbitTimers.forEach(clearTimeout);
      planetTimers.forEach(clearTimeout);
      houseTimers.forEach(clearTimeout);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={SPRING_SOFT}
      className="flex flex-col items-center gap-6 py-12"
    >
      {/* Particle field background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-400/40"
            style={{
              left: `${(10 + seededRnd(i, 1) * 80).toFixed(3)}%`,
              top: `${(10 + seededRnd(i, 2) * 80).toFixed(3)}%`,
            }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2 + seededRnd(i, 3) * 2,
              repeat: Infinity,
              delay: seededRnd(i, 4) * 3,
            }}
          />
        ))}
      </div>

      {/* Chart computation visualization */}
      <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
        {/* Amber glow behind */}
        <motion.div
          className="absolute inset-0 rounded-full bg-amber-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Central birth point */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-400 z-10"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white z-10" />

        {/* Concentric orbits */}
        {Array.from({ length: 9 }, (_, i) => {
          const size = 50 + i * 28;
          const isDrawn = i < orbitsDrawn;
          return (
            <motion.div
              key={`orbit-${i}`}
              className="absolute top-1/2 left-1/2 rounded-full border border-amber-500/15"
              style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={isDrawn ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          );
        })}

        {/* House division lines (12 houses) */}
        {Array.from({ length: 12 }, (_, i) => {
          const isDrawn = i < housesDrawn;
          const angle = (i / 12) * 360;
          return (
            <motion.div
              key={`house-${i}`}
              className="absolute top-1/2 left-1/2 w-[1px] origin-top bg-indigo-400/20"
              style={{
                height: 140,
                transform: `rotate(${angle}deg)`,
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={isDrawn ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          );
        })}

        {/* Planetary symbols on orbits (decorative — real values arrive with the chart) */}
        {PLANETS.map((planet, i) => {
          const isShown = i < planetsShown;
          const orbitRadius = 25 + i * 14;
          const angle = (i / PLANETS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <motion.div
              key={`planet-${i}`}
              className="absolute z-20 flex flex-col items-center"
              style={{
                left: `calc(50% + ${Math.cos(angle) * orbitRadius}px)`,
                top: `calc(50% + ${Math.sin(angle) * orbitRadius}px)`,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={isShown ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <span className="text-amber-400 text-base font-serif">{planet.symbol}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Cycling step label */}
      <div className="text-center space-y-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-foreground"
          >
            {COMPUTE_STEPS[stepIndex] ?? ""}
          </motion.p>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-1.5">
          <BrandSpinner size={12} className="text-amber-400" />
          <span className="text-[10px] text-muted-foreground">
            The astronomical engine is working live — the full chart appears as soon as the result arrives
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Particle Burst ────────────────────────────────────────────────────────── */

function GoldenParticleBurst({ active }: { active: boolean }) {
  // Seeded (sin-hash) so SSR + client render identical width/height styles.
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        angle: (i / 24) * Math.PI * 2,
        distance: 50 + seededRnd(i, 1) * 60,
        size: 2 + seededRnd(i, 2) * 4,
        delay: seededRnd(i, 3) * 0.2,
      })),
    [],
  );

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-amber-400"
          style={{ width: `${p.size.toFixed(3)}px`, height: `${p.size.toFixed(3)}px` }}
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

/* ─── Interactive planet glyph (shared by both chart styles) ────────────────── */

function PlanetGlyphNode({
  p,
  x,
  y,
  fontSize,
  showDegree,
  active,
  onTip,
}: {
  p: PlanetInHouse;
  x: number;
  y: number;
  fontSize: number;
  showDegree?: boolean;
  active: boolean;
  onTip: (t: PlanetTip | null) => void;
}) {
  const code = planetGlyph(p.planet);
  return (
    <g
      tabIndex={0}
      role="img"
      aria-label={`${p.planet} — ${p.sign} ${degreeDms(p.degree)}, Bhava ${p.house}, ${p.nakshatra} pada ${p.nakshatraPada}${p.isRetrograde ? ", retrograde" : ""}`}
      className="cursor-pointer outline-none"
      onMouseEnter={() => onTip({ p, x, y })}
      onMouseLeave={() => onTip(null)}
      onFocus={() => onTip({ p, x, y })}
      onBlur={() => onTip(null)}
    >
      <rect
        x={x - 19}
        y={y - fontSize}
        width={showDegree ? 38 : 16}
        height={fontSize + 4}
        rx={3.5}
        fill={active ? "rgba(251,191,36,0.14)" : "transparent"}
        stroke={active ? "rgba(251,191,36,0.45)" : "none"}
        strokeWidth={0.7}
      />
      <text
        x={showDegree ? x - 16 : x}
        y={y}
        textAnchor="start"
        className={active ? "fill-amber-300" : "fill-foreground"}
        fontSize={fontSize}
        fontWeight="800"
        letterSpacing="0.2"
      >
        {code}
        {p.isRetrograde ? (
          <tspan className="fill-sky-400" fontSize={fontSize * 0.62} dy={-fontSize * 0.32}>
            R
          </tspan>
        ) : null}
      </text>
      {showDegree && (
        <text
          x={x + 17}
          y={y}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={fontSize * 0.62}
          fontWeight="600"
        >
          {Math.round(p.degree)}
        </text>
      )}
    </g>
  );
}

/* ─── Planet tooltip card (glassmorphic) ────────────────────────────────────── */

function PlanetTipCard({ tip }: { tip: PlanetTip }) {
  const p = tip.p;
  // Anchor inside the max-w-[360px] chart box; viewBox is -2..202 (204 wide).
  const leftPct = Math.min(Math.max(((tip.x + 2) / 204) * 100, 22), 78);
  const topPct = ((tip.y + 2) / 204) * 100;
  const flipBelow = tip.y < 72;
  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: `${leftPct.toFixed(3)}%`,
        top: `${topPct.toFixed(3)}%`,
        transform: flipBelow ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: flipBelow ? -4 : 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={SPRING_TIP}
        className="w-max max-w-[240px] rounded-2xl border border-[var(--color-luxury-glass-border)] bg-[var(--color-surface)]/90 backdrop-blur-xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)] p-3 space-y-1.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none text-amber-400">{planetGlyph(p.planet)}</span>
          <p className="text-xs font-black text-foreground">{p.planet}</p>
          {p.isRetrograde && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[8px] font-black uppercase tracking-wide">
              Retrograde
            </span>
          )}
          <span className="ml-auto text-[9px] font-bold text-muted-foreground tabular-nums">Bhava {p.house}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="text-amber-400/80">{signGlyph(p.sign)}</span>
          <span className="font-semibold text-foreground">{signLabel(p.sign)}</span>
          <span className="tabular-nums font-bold text-[var(--color-primary)]">{degreeDms(p.degree)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Orbit size={9} className="text-amber-400/70 shrink-0" />
          <span>{p.nakshatra} · pada {p.nakshatraPada}</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── North-Indian Chart (real computed data) ───────────────────────────────── */

function NorthIndianChart({ kundali, activePlanet, onTip }: ChartProps) {
  const signOfHouse = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of kundali.chart.houses) map.set(h.house, h.sign);
    return map;
  }, [kundali]);

  const planetsOfHouse = useMemo(() => {
    const map = new Map<number, PlanetInHouse[]>();
    for (const p of kundali.chart.planets) {
      const list = map.get(p.house) ?? [];
      list.push(p);
      map.set(p.house, list);
    }
    return map;
  }, [kundali]);

  return (
    <div>
      <svg viewBox="-2 -2 204 204" className="w-full max-w-[360px] mx-auto select-none">
        <defs>
          <linearGradient id="kundali-gold-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(212,175,55,0.85)" />
            <stop offset="50%" stopColor="rgba(212,175,55,0.4)" />
            <stop offset="100%" stopColor="rgba(212,175,55,0.75)" />
          </linearGradient>
          <linearGradient id="kundali-lagna-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(157,125,197,0.10)" />
            <stop offset="100%" stopColor="rgba(157,125,197,0.02)" />
          </linearGradient>
        </defs>

        {/* Frame: outer double border + chart skeleton */}
        <g fill="none">
          <rect x="-1.6" y="-1.6" width="203.2" height="203.2" stroke="rgba(212,175,55,0.22)" strokeWidth="1" rx="2" />
          <g stroke="url(#kundali-gold-edge)" strokeWidth="1.1">
            <rect x="0" y="0" width="200" height="200" />
            <line x1="0" y1="0" x2="200" y2="200" />
            <line x1="200" y1="0" x2="0" y2="200" />
            <polygon points="100,0 200,100 100,200 0,100" />
          </g>
        </g>

        {/* Houses: tint + corner rashi chip + Lagna mark + planet rows */}
        {HOUSE_SHAPES.map((h) => {
          const sign = signOfHouse.get(h.house) ?? "";
          const sIdx = signIndex(sign);
          const ps = planetsOfHouse.get(h.house) ?? [];
          return (
            <g key={h.house}>
              <polygon
                points={h.points}
                fill={h.house === 1 ? "url(#kundali-lagna-fill)" : "rgba(255,255,255,0.015)"}
              />
              {sIdx >= 0 && (
                <text
                  x={h.lx + h.numDx}
                  y={h.ly + h.numDy}
                  textAnchor="middle"
                  className="fill-amber-400/80"
                  fontSize="7"
                  fontWeight="800"
                  letterSpacing="0.3"
                >
                  {sIdx + 1} {ZODIAC_SIGNS[sIdx]}
                </text>
              )}
              {h.house === 1 && (
                <text
                  x={h.lx}
                  y={h.ly + h.numDy + 7}
                  textAnchor="middle"
                  className="fill-[var(--color-primary)]"
                  fontSize="6"
                  fontWeight="800"
                  letterSpacing="1"
                >
                  LAGNA
                </text>
              )}
              {ps.map((p, i) => (
                <PlanetGlyphNode
                  key={p.planet}
                  p={p}
                  x={h.lx}
                  y={h.ly + (h.house === 1 ? -10 : -6) + i * 10.5}
                  fontSize={7.5}
                  showDegree
                  active={activePlanet === p.planet}
                  onTip={onTip}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        North-Indian Rashi chart · cells run clockwise from the top (Lagna) ·
        corner number = Rashi (1 Mesha to 12 Meena) · R = retrograde
      </p>
    </div>
  );
}

/* ─── South-Indian Chart (same data, rashi-grid style) ──────────────────────── */

function SouthIndianChart({ kundali, activePlanet, onTip }: ChartProps) {
  const ascIdx = Math.max(0, signIndex(kundali.chart.ascendantSign));

  const planetsOfSign = useMemo(() => {
    const map = new Map<number, PlanetInHouse[]>();
    for (const p of kundali.chart.planets) {
      const list = map.get(p.signIndex) ?? [];
      list.push(p);
      map.set(p.signIndex, list);
    }
    return map;
  }, [kundali]);

  return (
    <div>
      <svg viewBox="-2 -2 204 204" className="w-full max-w-[360px] mx-auto select-none">
        {/* Grid: outer square + 12-cell ring; middle 2×2 stays open */}
        <g stroke="currentColor" className="text-amber-500/30" strokeWidth="1.2" fill="none">
          <rect x="0" y="0" width="200" height="200" />
          <line x1="50" y1="0" x2="50" y2="200" />
          <line x1="150" y1="0" x2="150" y2="200" />
          <line x1="0" y1="50" x2="200" y2="50" />
          <line x1="0" y1="150" x2="200" y2="150" />
          <line x1="100" y1="0" x2="100" y2="50" />
          <line x1="100" y1="150" x2="100" y2="200" />
          <line x1="0" y1="100" x2="50" y2="100" />
          <line x1="150" y1="100" x2="200" y2="100" />
        </g>

        {/* Center block ornament */}
        <text x="100" y="95" textAnchor="middle" className="fill-amber-500/60" fontSize="6.5" fontWeight="800">
          LAGNA
        </text>
        <text x="100" y="111" textAnchor="middle" className="fill-[var(--color-primary)]" fontSize="12" fontWeight="800">
          {signGlyph(kundali.chart.ascendantSign)}
        </text>

        {/* 12 rashi cells — top-left = 1 (Mesha), clockwise */}
        {SOUTH_CELLS.map((cell) => {
          const sIdx = cell.rashi - 1;
          const x0 = cell.col * 50;
          const y0 = cell.row * 50;
          const house = ((sIdx - ascIdx + 12) % 12) + 1;
          const ps = planetsOfSign.get(sIdx) ?? [];
          return (
            <g key={cell.rashi}>
              {house === 1 && (
                <rect x={x0 + 1} y={y0 + 1} width={48} height={48} rx={2} fill="rgba(245,158,11,0.07)" stroke="none" />
              )}
              {/* Rashi number + sign code (top-left corner) */}
              <text x={x0 + 4} y={y0 + 9} textAnchor="start" className="fill-amber-400/80" fontSize="6" fontWeight="800">
                {cell.rashi} {ZODIAC_SIGNS[sIdx]}
              </text>
              {/* House number (bottom-right corner); Lagna cell marked */}
              <text
                x={x0 + 46}
                y={y0 + 48}
                textAnchor="end"
                className={house === 1 ? "fill-[var(--color-primary)]" : "fill-amber-500/40"}
                fontSize={house === 1 ? 5.5 : 6.5}
                fontWeight="800"
              >
                {house === 1 ? "Lagna" : house}
              </text>
              {/* Planets of this rashi — single column inside the cell */}
              {ps.map((p, i) => {
                const px = x0 + 12;
                const py = y0 + 22 + i * 7;
                return (
                  <PlanetGlyphNode
                    key={p.planet}
                    p={p}
                    x={px}
                    y={py}
                    fontSize={6}
                    active={activePlanet === p.planet}
                    onTip={onTip}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        South-Indian Rashi chart · Rashi cells run clockwise (R = retrograde)
      </p>
    </div>
  );
}

/* ─── Chart Showcase — North/South toggle + tooltips ────────────────────────── */

const CHART_STYLES: Array<{ id: ChartStyle; label: string; icon: typeof Diamond }> = [
  { id: "north", label: "North", icon: Diamond },
  { id: "south", label: "South", icon: Square },
];

function ChartShowcase({ kundali }: { kundali: KundaliResult }) {
  const reduce = useReducedMotion();
  const [style, setStyle] = useState<ChartStyle>("north");
  const [tip, setTip] = useState<PlanetTip | null>(null);

  const chart = (s: ChartStyle) =>
    s === "north" ? (
      <NorthIndianChart kundali={kundali} activePlanet={tip?.p.planet ?? null} onTip={setTip} />
    ) : (
      <SouthIndianChart kundali={kundali} activePlanet={tip?.p.planet ?? null} onTip={setTip} />
    );

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Rashi Chart (D-1)
        </p>
        <div
          role="group"
          aria-label="Choose chart style"
          className="print-hide inline-flex items-center gap-1 p-1 rounded-full bg-[var(--color-surface)]/60 backdrop-blur-xl border border-[var(--color-luxury-glass-border)]"
        >
          {CHART_STYLES.map((opt) => {
            const isActive = style === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setTip(null);
                  setStyle(opt.id);
                }}
                className={cn(
                  "relative px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-colors",
                  isActive ? "text-[var(--color-primary)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="kundali-chart-style-pill"
                    transition={reduce ? { duration: 0 } : SPRING_PILL}
                    className="absolute inset-0 rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30"
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <opt.icon size={11} />
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full max-w-[360px] mx-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={style}
            initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -12, scale: reduce ? 1 : 0.98 }}
            transition={reduce ? { duration: 0.15 } : SPRING_SWAP}
          >
            {chart(style)}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {tip && <PlanetTipCard key={tip.p.planet} tip={tip} />}
        </AnimatePresence>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/80 mt-1 print-hide flex items-center justify-center gap-1.5">
        <Layers size={10} className="text-amber-400/60" />
        Hover or keyboard-focus any planet glyph — its degree, Nakshatra and Bhava appear in the tooltip.
      </p>

      {/* Print extras: both chart styles in the PDF report */}
      <div className="hidden print:block">
        {chart(style === "north" ? "south" : "north")}
      </div>
    </div>
  );
}

/* ─── Confidence Meter ──────────────────────────────────────────────────────── */

function ConfidenceMeter({ score, factors }: { score: number; factors: string[] }) {
  const tone = confidenceTone(score);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Gauge size={14} className={`${tone.text} shrink-0`} />
        <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${tone.bar}`}
            initial={{ width: "0%" }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
          />
        </div>
        <span className={`text-sm font-black tabular-nums ${tone.text}`}>{score}/100</span>
      </div>
      <p className={`text-[11px] font-semibold ${tone.text}`}>{tone.label}</p>
      <ul className="space-y-1.5">
        {factors.map((f, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className="text-[11px] text-muted-foreground flex items-start gap-2"
          >
            <span className="mt-1 w-1 h-1 rounded-full bg-amber-400/60 shrink-0" />
            {f}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Verification Checklist ────────────────────────────────────────────────── */

function VerificationList({ checks }: { checks: KundaliResult["verification"] }) {
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08 }}
          className="flex items-start gap-2"
        >
          {c.passed ? (
            <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <XCircle size={13} className="text-rose-400 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground">{c.label}</p>
            <p className="text-[10px] text-muted-foreground">{c.detail}</p>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

/* ─── Dasha Timeline ────────────────────────────────────────────────────────── */

function DashaTimeline({ kundali }: { kundali: KundaliResult }) {
  const past = kundali.dasha.anchors.filter((a) => a.elapsed);
  const rest = kundali.dasha.anchors.filter((a) => !a.elapsed);
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15">
        <p className="text-xs font-bold text-foreground">
          Currently running:{" "}
          <span className="text-[var(--color-primary)]">
            {kundali.dasha.currentMahadasha} Mahadasha · {kundali.dasha.currentAntardasha} Antardasha
          </span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {kundali.dasha.remainingYears.toFixed(1)} years remaining · Vimshottari Dasha (seeded from the Moon nakshatra)
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
          Past Dasha periods — verify them against your own life
        </p>
        <div className="space-y-1.5">
          {past.map((a, i) => (
            <motion.div
              key={`past-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-raised/40 border border-border/40"
            >
              <span className="text-[11px] font-semibold text-muted-foreground">
                {planetGlyph(a.planet)} {a.planet}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {a.startDate} → {a.endDate}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
          Present and future
        </p>
        <div className="space-y-1.5">
          {rest.map((a, i) => (
            <motion.div
              key={`rest-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.05 }}
              className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border ${a.isCurrent ? "bg-amber-500/10 border-amber-500/30" : "bg-surface-raised/40 border-border/40"}`}
            >
              <span className={`text-[11px] font-semibold ${a.isCurrent ? "text-amber-300" : "text-muted-foreground"}`}>
                {planetGlyph(a.planet)} {a.planet}
                {a.isCurrent && (
                  <span className="ml-2 text-[9px] font-black uppercase tracking-wide">Running</span>
                )}
              </span>
              <span className={`text-[10px] tabular-nums ${a.isCurrent ? "text-amber-300/80" : "text-muted-foreground"}`}>
                {a.startDate} → {a.endDate}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Planet Table ──────────────────────────────────────────────────────────── */

function PlanetTable({ planets }: { planets: PlanetInHouse[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1.5 pr-2 font-black uppercase tracking-wider text-[9px]">Graha</th>
            <th className="py-1.5 pr-2 font-black uppercase tracking-wider text-[9px]">Rashi (Degree)</th>
            <th className="py-1.5 pr-2 font-black uppercase tracking-wider text-[9px]">Bhava</th>
            <th className="py-1.5 font-black uppercase tracking-wider text-[9px]">Nakshatra</th>
          </tr>
        </thead>
        <tbody>
          {planets.map((p, i) => (
            <motion.tr
              key={p.planet}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.04 }}
              className="border-t border-border/30"
            >
              <td className="py-1.5 pr-2 font-bold text-foreground whitespace-nowrap">
                <span className="text-amber-400 mr-1.5">{planetGlyph(p.planet)}</span>
                {p.planet}
                {p.isRetrograde && (
                  <span className="ml-1.5 px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[8px] font-black">℞</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">
                {signGlyph(p.sign)} {p.sign} <span className="tabular-nums">{p.degree.toFixed(2)}°</span>
              </td>
              <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{p.house}</td>
              <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                {p.nakshatra} <span className="tabular-nums opacity-70">pada {p.nakshatraPada}</span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Interpretation Markdown → premium structured blocks ───────────────────── */
/* Renderer + sanitizer extracted to @/components/astrology/ReadingMarkdown.   */


/* ─── Phase 4: Reading ──────────────────────────────────────────────────────── */

function ReadingPhase({
  kundali,
  interpretation,
  aiAvailable,
  consultants,
  loadingConsultants,
  onShare,
  onCopyLink,
  onReset,
}: {
  kundali: KundaliResult;
  interpretation: string | null;
  aiAvailable: boolean;
  consultants: AvailableConsultant[];
  loadingConsultants: boolean;
  onShare: () => Promise<boolean>;
  onCopyLink: () => void;
  onReset: () => void;
}) {
  const [burstActive, setBurstActive] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBurstActive(false), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    const ok = await onShare();
    if (ok) setCopied(true);
  }, [onShare]);

  const k = kundali;
  const allPassed = k.verification.every((c) => c.passed);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      className="space-y-6 kundali-print-root"
    >
      {/* Print-only report header (screen: hidden) */}
      <div className="hidden print:block border-b border-border/60 pb-3 mb-4">
        <p className="text-lg font-black">Birth Kundali — {k.input.name}</p>
        <p className="text-xs">
          Birth: {k.input.birthDate} {k.input.birthTime}, {k.input.place} · Lagna: {signLabel(k.chart.ascendantSign)} {k.chart.ascendantDegree.toFixed(2)}° · Rashi: {signLabel(k.chart.moonSign)} ({k.chart.moonNakshatra})
        </p>
      </div>

      {/* Particle burst on entry */}
      <div className="relative h-0 print-hide">
        <GoldenParticleBurst active={burstActive} />
      </div>

      {/* Meta info badges */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground"
      >
        <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
          <User size={9} /> {k.input.name}
        </span>
        <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
          <Calendar size={9} /> {k.input.birthDate}
        </span>
        <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
          <Clock size={9} /> {k.input.birthTime}
        </span>
        <span
          className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1"
          title={`${k.input.resolvedPlace.lat}, ${k.input.resolvedPlace.lng} · ${k.input.resolvedPlace.timezone} (${k.input.resolvedPlace.source})`}
        >
          <MapPin size={9} /> {k.input.resolvedPlace.canonicalName || k.input.place}
        </span>
      </motion.div>

      {/* ── Trust header: key placements + confidence + verification ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, type: "spring", stiffness: 180, damping: 22 }}
        className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 print-avoid-break"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.04] blur-3xl rounded-full pointer-events-none print-hide" />

        <div className="relative space-y-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <ScrollText size={20} className="text-[var(--color-primary)]" />
              {k.input.name}'s Kundali — verify first, then trust
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              The full chart was computed by the astronomical engine (Lahiri ayanamsa,
              {" "}{k.input.resolvedPlace.timezone} timezone, {k.input.resolvedPlace.lat.toFixed(2)}°, {k.input.resolvedPlace.lng.toFixed(2)}°).
              You can check every number below — the interpretation is based on this chart alone.
            </p>
          </div>

          {/* Key placements */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Lagna",
                value: `${signGlyph(k.chart.ascendantSign)} ${signLabel(k.chart.ascendantSign)}`,
                sub: `${k.chart.ascendantDegree.toFixed(2)}° · Navamsa: ${signLabel(k.chart.navamsaAscendant)}`,
              },
              {
                label: "Rashi (Moon)",
                value: `${signGlyph(k.chart.moonSign)} ${signLabel(k.chart.moonSign)}`,
                sub: k.chart.moonNakshatra,
              },
              {
                label: "Rashi (Sun)",
                value: `${signGlyph(k.chart.sunSign)} ${signLabel(k.chart.sunSign)}`,
                sub: `Ayanamsa ${k.chart.ayanamsa.toFixed(2)}°`,
              },
              {
                label: "Birth Panchang",
                value: k.panchanga.tithi,
                sub: `${k.panchanga.nakshatra} · ${k.panchanga.yoga} · ${k.panchanga.karana}`,
              },
            ].map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.08, type: "spring", stiffness: 260, damping: 20 }}
                className="p-3 rounded-2xl bg-background/60 border border-border/40"
              >
                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{b.label}</p>
                <p className="text-sm font-bold text-foreground mt-1 leading-snug">{b.value}</p>
                <p className="text-[10px] text-amber-400/70 mt-0.5">{b.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Confidence + verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                Accuracy confidence
              </p>
              <ConfidenceMeter score={k.confidence.score} factors={k.confidence.factors} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                Self-verification{" "}
                {allPassed ? (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] normal-case">
                    all passed
                  </span>
                ) : (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[8px] normal-case">
                    please review
                  </span>
                )}
              </p>
              <VerificationList checks={k.verification} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Chart + planets ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, type: "spring", stiffness: 180, damping: 22 }}
        className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 print-avoid-break"
      >
        <ChartShowcase kundali={k} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
            Graha Sthiti — {k.chart.planets.length} planets, engine-computed
          </p>
          <PlanetTable planets={k.chart.planets} />
        </div>
      </motion.div>

      {/* ── Dasha timeline ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 180, damping: 22 }}
        className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 print-avoid-break"
      >
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-4">
          Vimshottari Dasha — verify with the past, navigate by the future
        </p>
        <DashaTimeline kundali={k} />
      </motion.div>

      {/* ── AI interpretation ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, type: "spring", stiffness: 180, damping: 22 }}
        className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 print-avoid-break"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.04] blur-3xl rounded-full pointer-events-none print-hide" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/[0.03] blur-3xl rounded-full pointer-events-none print-hide" />

        <div className="relative">
          <h3 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-primary)]" />
            Jyotishi's Analysis
          </h3>
          <p className="text-[11px] text-muted-foreground mb-4">
            The AI read only your computed chart — every number comes from it; nothing was guessed.
          </p>

          {!aiAvailable && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-300">
                The AI Jyotishi lane is busy right now — the reading below is generated
                deterministically from your exact engine-computed chart. Try again in a few
                minutes for the full personalised interpretation.
              </p>
            </div>
          )}

          <ReadingMarkdown
            source={interpretation ?? "The interpretation couldn't be generated — the chart above is still fully accurate."}
          />

          <div className="mt-6 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Gauge size={9} className="text-emerald-400" /> Confidence {k.confidence.score}/100
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Orbit size={9} /> Sidereal (Lahiri {k.chart.ayanamsa.toFixed(2)}°)
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <ShieldCheck size={9} /> Deterministic chart + AI interpretation
              </span>
            </div>
            <div className="flex items-center gap-2 print-hide">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-surface-raised border border-border/60 rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={10} className="text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Share2 size={10} /> Copy
                  </>
                )}
              </button>
              <button
                onClick={onCopyLink}
                className="px-3 py-1.5 bg-surface-raised border border-border/60 rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1"
              >
                <Link2 size={10} /> Share Link
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-surface-raised border border-border/60 rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1"
              >
                <Printer size={10} /> Print / PDF
              </button>
              <button
                onClick={onReset}
                className="px-4 py-1.5 bg-surface-raised border border-border/60 rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1"
              >
                <RotateCcw size={10} /> New Kundali
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Consultant CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, type: "spring", stiffness: 200, damping: 22 }}
        className="space-y-4 print-hide"
      >
        <div className="flex items-center gap-2">
          <Users size={14} className="text-[var(--color-primary)]" />
          <h3 className="text-sm font-bold text-foreground">Talk to a Vedic Jyotishi</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Need personal guidance on Dasha remedies, planetary transits or one specific question?
          Share your kundali with a live Jyotishi and ask.
        </p>

        {loadingConsultants ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="text-[var(--color-primary)] animate-spin" />
          </div>
        ) : consultants.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {consultants.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 + i * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <Link
                  href={`/consultant/${c.id}`}
                  className="block p-3 rounded-2xl bg-surface/80 border border-border/60 hover:border-[var(--color-primary)]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-primary)]/20 to-amber-500/20 flex items-center justify-center text-xs font-bold text-[var(--color-primary)]">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.specialties?.[0] ?? c.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-amber-400">★ {c.rating.toFixed(1)}</span>
                    {c.perMinuteRate && (
                      <span className="text-muted-foreground">₹{c.perMinuteRate}/min</span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No Vedic Jyotishi is online right now — please check again in a while.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
