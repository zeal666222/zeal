"use client";

// ============================================================================
// Daily Panchang + Rahu Kaal — aaj ka patra, astronomical engine se.
// Every number on this page comes from /api/panchang (pure deterministic
// engine: NOAA solar equations + Lahiri-sidereal lunisolar angles). The page
// renders no clock-derived values at first paint — today, chips and the
// current-time marker are all mount-gated effects (React 19 hydration-safe).
// Motion: apps/web has its own framer-motion copy with no LazyMotion context
// (that lives in a separate packages/ui copy), so app files use full `motion`.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes, CalendarDays, CheckCircle2, ChevronDown, CloudMoon, Copy, Leaf, Link2,
  Loader2, MapPin, Moon, RefreshCw, ScrollText, Share2, Sparkles, Star, Sun,
  Sunrise, Sunset, Users,
} from "lucide-react";
import { LocationAutocomplete, BrandSpinner, type PlaceSuggestionData } from "@zeal/ui";
import ConsultantCTA from "@/components/shared/ConsultantCTA";
import {
  KARANA_GUIDANCE, NAKSHATRA_GUIDANCE, TITHI_GUIDANCE, VARA_GUIDANCE,
  WINDOW_GUIDANCE, YOGA_GUIDANCE,
} from "@/lib/panchang/knowledge";
import type { PanchangAnga, PanchangDayResult, PanchangWindow } from "@/lib/panchang/engine";

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const DEFAULT_PLACE = "Delhi, India";
const PAKSHA_LABEL: Record<string, string> = {
  Shukla: "Shukla Paksha — waxing Moon",
  Krishna: "Krishna Paksha — waning Moon",
};

/* ─── Pure client-time helpers (only ever run inside effects) ───────────────── */

function todayInKolkata(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split("-").map(Number);
  const t = Date.UTC(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function shortDate(dateStr: string): string {
  const dt = new Date(`${dateStr}T12:00:00Z`);
  return dt.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Fraction [0..1] of an instant between two ISO endpoints (clamped, NaN-safe). */
function fractionBetween(startIso: string, endIso: string, curMs: number): number {
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  const f = (curMs - a) / (b - a);
  return Math.max(0, Math.min(1, Number.isFinite(f) ? f : 0));
}

/* ─── Sun-arc geometry (cubic Bézier — deterministic, pure) ─────────────────── */

const ARC = { p0: [26, 148], p1: [96, 18], p2: [304, 18], p3: [374, 148] } as const;

function bezierPoint(t: number): [number, number] {
  const mt = 1 - t;
  const x = mt * mt * mt * ARC.p0[0] + 3 * mt * mt * t * ARC.p1[0] + 3 * mt * t * t * ARC.p2[0] + t * t * t * ARC.p3[0];
  const y = mt * mt * mt * ARC.p0[1] + 3 * mt * mt * t * ARC.p1[1] + 3 * mt * t * t * ARC.p2[1] + t * t * t * ARC.p3[1];
  return [x, y];
}

function rahuSegmentPath(f0: number, f1: number): string {
  const steps = 36;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const f = f0 + ((f1 - f0) * i) / steps;
    const pt = bezierPoint(f);
    d += `${i === 0 ? "M" : "L"}${pt[0].toFixed(3)} ${pt[1].toFixed(3)} `;
  }
  return d;
}

/* ─── Kiosk-card view model ─────────────────────────────────────────────────── */

interface ElementCard {
  key: string;
  icon: typeof Moon;
  label: string;
  value: string;
  sub: string;
  timing: string;
  guidance: string;
}

function angaTiming(p: PanchangDayResult, a: PanchangAnga): string {
  const endHint = a.endOn !== p.date ? ` (${shortDate(a.endOn)})` : "";
  const startHint = a.startOn !== p.date ? ` (${shortDate(a.startOn)})` : "";
  return `${a.time}${startHint} → ${a.end}${endHint}`;
}

function buildCards(p: PanchangDayResult): ElementCard[] {
  return [
    {
      key: "tithi",
      icon: Moon,
      label: "Tithi",
      value: `${p.paksha} ${p.tithi.name}`,
      sub: `Tithi ${p.tithi.number} of the paksha · elongation ${p.tithi.index * 12}° to ${p.tithi.index * 12 + 12}°`,
      timing: angaTiming(p, p.tithi),
      guidance: TITHI_GUIDANCE[p.tithi.name] ?? "Keep the day balanced — start auspicious work at a good time.",
    },
    {
      key: "nakshatra",
      icon: Star,
      label: "Nakshatra",
      value: `${p.nakshatra.name} · Pada ${p.nakshatra.pada}`,
      sub: `Janma-tara of the Moon · ruled by ${p.nakshatra.lord}`,
      timing: angaTiming(p, p.nakshatra),
      guidance: NAKSHATRA_GUIDANCE[p.nakshatra.name] ?? "The Nakshatra's influence is supportive — take decisions calmly.",
    },
    {
      key: "yoga",
      icon: Link2,
      label: "Yoga",
      value: p.yoga.name,
      sub: `Part ${p.yoga.index + 1} of Surya + Chandra (13°20′)`,
      timing: angaTiming(p, p.yoga),
      guidance: YOGA_GUIDANCE[p.yoga.name] ?? "The day's nature is mixed — think carefully before major beginnings.",
    },
    {
      key: "karana",
      icon: Boxes,
      label: "Karana",
      value: p.karana.name,
      sub: `Half-tithi · quarter ${p.karana.index + 1} of the lunar month`,
      timing: angaTiming(p, p.karana),
      guidance: KARANA_GUIDANCE[p.karana.name] ?? "Stay patient with practical work.",
    },
    {
      key: "vara",
      icon: CalendarDays,
      label: "Vara (Day)",
      value: `${p.vara.hinglish} · ${p.vara.english}`,
      sub: `${p.vara.lord} presides · varjya kaal in the card below`,
      timing: `Sunrise ${p.sunrise.time} → Sunset ${p.sunset.time}`,
      guidance: VARA_GUIDANCE[p.vara.english] ?? "Make auspicious use of the day — do routine work on time.",
    },
  ];
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export default function PanchangPage() {
  const [dateStr, setDateStr] = useState("");
  const [place, setPlace] = useState("");
  const [picked, setPicked] = useState<PlaceSuggestionData | null>(null);
  const [panchang, setPanchang] = useState<PanchangDayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [chips, setChips] = useState<Array<{ label: string; value: string }>>([]);
  const [nowFraction, setNowFraction] = useState<number | null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [copied, setCopied] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* Mount-gated clock: "today in Asia/Kolkata view", Kal/Aaj/Parmkal chips and
     deep-link params — nothing here runs during SSR, so no hydration delta. */
  useEffect(() => {
    const today = todayInKolkata();
    setTodayStr(today);
    setChips([
      { label: "Yesterday", value: addDays(today, -1) },
      { label: "Today", value: today },
      { label: "Tomorrow", value: addDays(today, 1) },
    ]);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    const p = params.get("p");
    setDateStr(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today);
    setPlace(p && p.length <= 120 ? p : DEFAULT_PLACE);
    setMounted(true);
  }, []);

  const fetchPanchang = useCallback(async (d: string, placeLabel: string, sel: PlaceSuggestionData | null) => {
    if (!d) return;
    setLoading(true);
    setError("");
    try {
      let qs = `date=${encodeURIComponent(d)}`;
      if (sel && Number.isFinite(sel.lat) && Number.isFinite(sel.lng) && sel.timezone) {
        qs += `&lat=${sel.lat.toFixed(4)}&lng=${sel.lng.toFixed(4)}&tz=${encodeURIComponent(sel.timezone)}&place=${encodeURIComponent(sel.label)}`;
      } else {
        qs += `&place=${encodeURIComponent(placeLabel)}`;
      }
      const res = await fetch(`/api/panchang?${qs}`);
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        panchang?: PanchangDayResult;
        error?: string;
      };
      if (!res.ok || !data.panchang) {
        throw new Error(data.error ?? `Panchang not available (HTTP ${res.status}). Please try again.`);
      }
      if (!aliveRef.current) return;
      setPanchang(data.panchang);
      window.history.replaceState(null, "", `/services/panchang?d=${data.panchang.date}&p=${encodeURIComponent(data.panchang.placeLabel)}`);
    } catch (err) {
      if (aliveRef.current) {
        setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
        setPanchang(null);
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  /* First fetch once mount defaults are in place. */
  useEffect(() => {
    if (!mounted || !dateStr || !place) return;
    void fetchPanchang(dateStr, place, picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, dateStr]);

  /* Current-time marker ONLY if browser now is inside the displayed day's
     sunrise→sunset window AND that day is today (Asia/Kolkata view). */
  useEffect(() => {
    if (!mounted || !panchang || !todayStr || panchang.date !== todayStr) {
      setNowFraction(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const a = Date.parse(panchang.sunrise.iso);
      const b = Date.parse(panchang.sunset.iso);
      setNowFraction(now >= a && now <= b ? fractionBetween(panchang.sunrise.iso, panchang.sunset.iso, now) : null);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [mounted, panchang, todayStr]);

  const handleRefresh = useCallback(() => {
    const d = todayInKolkata();
    setDateStr(d);
    void fetchPanchang(d, place, picked);
  }, [fetchPanchang, place, picked]);

  const handleSelectPlace = useCallback(
    (p: PlaceSuggestionData) => {
      setPicked(p);
      setPlace(p.label);
      void fetchPanchang(dateStr, p.label, p);
    },
    [dateStr, fetchPanchang],
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/services/panchang?d=${dateStr}&p=${encodeURIComponent(place)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Couldn't copy the link — please allow clipboard access in your browser.");
    }
  }, [dateStr, place]);

  const cards = useMemo(() => (panchang ? buildCards(panchang) : []), [panchang]);
  const todayActive = mounted && !!dateStr && dateStr === todayStr;

  return (
    <div className="min-h-screen-app pb-16">
      <style>{PRINT_CSS}</style>

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[var(--color-primary)]/[0.06] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-amber-500/[0.05] blur-[140px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Sunrise size={12} /> Deterministic Panchanga Engine · NOAA + Lahiri
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">Today's Panchang</h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
              Exact timings of Tithi, Nakshatra, Yoga, Karana and Rahu Kaal — for your city's sunrise–sunset,
              from pure astronomical math. Not a single number is estimated.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ── Controls ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }} className="panchang-relative relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 sm:gap-4 items-end">
            <div className="panchang-print-keep">
              <label htmlFor="panchang-date" className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Date</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input id="panchang-date" type="date" value={dateStr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateStr(e.target.value)} className="pl-9 pr-3 py-3 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors w-full" />
              </div>
            </div>
            <div className="panchang-print-keep">
              <label htmlFor="panchang-place" className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">City / Location</label>
              <LocationAutocomplete
                id="panchang-place"
                required
                recentStorageKey="zeal:recent-places:panchang"
                placeholder="Search a city — suggestions appear as you type"
                value={place}
                onChange={(v) => setPlace(v)}
                onSelect={handleSelectPlace}
              />
            </div>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleRefresh} className="px-4 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Today's Panchang
              </motion.button>
            </div>
          </div>

          {/* Quick date chips — computed in mount effect only */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button key={c.label} onClick={() => setDateStr(c.value)} className={dateStr === c.value ? "px-3 py-1.5 rounded-full text-xs font-semibold border bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]" : "px-3 py-1.5 rounded-full text-xs font-semibold border bg-surface-raised border-border/60 text-muted-foreground hover:bg-surface-overlay transition-colors"}>
                  {c.label} · {shortDate(c.value)}
                </button>
              ))}
              {panchang && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin size={10} /> {panchang.placeLabel} · {panchang.timezone}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Error ── */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="alert" className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-start gap-2">
            <Sunset size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* ── Loading ── */}
        {loading && !panchang && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <BrandSpinner size={26} className="text-[var(--color-primary)]" />
            <p className="text-sm text-muted-foreground animate-pulse">Computing your Panchang — tithi, nakshatra, Rahu Kaal…</p>
          </div>
        )}

        {/* ── Result ── */}
        {panchang && (
          <div className="space-y-6">
            <SunArc panchang={panchang} nowFraction={todayActive ? nowFraction : null} />

            {/* Paksh + maheena strip */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 22 }} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 rounded-2xl bg-surface/70 backdrop-blur-xl border border-border/50 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-foreground"><Moon size={13} className="text-[var(--color-primary)]" /> {PAKSHA_LABEL[panchang.paksha] ?? panchang.paksha}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><ScrollText size={13} className="text-amber-400" /> Masa indicator: <b className="text-foreground">{panchang.masa.name}</b></span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><Sun size={13} className="text-amber-400" /> Vara: <b className="text-foreground">{panchang.vara.hinglish}</b></span>
              <span className="flex items-center gap-1.5 text-muted-foreground tabular-nums"><Star size={13} className="text-amber-400" /> Sun {panchang.sunSiderealDeg.toFixed(3)}° · Moon {panchang.moonSiderealDeg.toFixed(3)}° sidereal</span>
              <span className="text-[10px] text-muted-foreground/70 basis-full sm:basis-auto">{panchang.masa.note}</span>
            </motion.div>

            {/* Kiosk grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((c, i) => (
                <ElementCardView key={c.key} card={c} delay={0.06 * i} />
              ))}

              {/* Varjya kaal: Rahu / Yamagandam (Ambreyal) / Gulika */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 22 }} className="sm:col-span-2 lg:col-span-2 p-5 rounded-3xl bg-surface/80 backdrop-blur-xl border border-rose-500/25 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/[0.05] blur-3xl rounded-full pointer-events-none" />
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-400 mb-3 flex items-center gap-1.5"><CloudMoon size={13} /> Varjya Kaal — avoid starting new work in these windows</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <WindowBlock w={panchang.rahukaal} meta={WINDOW_GUIDANCE.rahukaal} />
                  <WindowBlock w={panchang.yamagandam} meta={WINDOW_GUIDANCE.yamagandam} />
                  <WindowBlock w={panchang.gulika} meta={WINDOW_GUIDANCE.gulika} />
                </div>
              </motion.div>

              {/* Shubh muhurat */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, type: "spring", stiffness: 200, damping: 22 }} className="p-5 rounded-3xl bg-surface/80 backdrop-blur-xl border border-emerald-500/25 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/[0.05] blur-3xl rounded-full pointer-events-none" />
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5"><Sparkles size={13} /> Shubh Muhurat</p>
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-background/60 border border-border/40">
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Sun size={10} className="text-amber-400" /> {WINDOW_GUIDANCE.abhijit.title}</p>
                    <p className="text-base font-black text-foreground tabular-nums mt-1">{panchang.abhijitMuhurat.time} – {panchang.abhijitMuhurat.end}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{WINDOW_GUIDANCE.abhijit.line}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-background/60 border border-border/40">
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Leaf size={10} className="text-emerald-400" /> {WINDOW_GUIDANCE.brahma.title}</p>
                    <p className="text-base font-black text-foreground tabular-nums mt-1">{panchang.brahmaMuhurat.time} – {panchang.brahmaMuhurat.end}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{WINDOW_GUIDANCE.brahma.line}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Actions */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="flex flex-wrap items-center gap-2">
              <button onClick={handleCopyLink} className="px-4 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5">
                {copied ? (<><CheckCircle2 size={12} className="text-emerald-400" /> Link copied!</>) : (<><Copy size={12} /> Copy share link</>)}
              </button>
              <button onClick={() => window.print()} className="px-4 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5">
                <ScrollText size={12} /> Print / PDF
              </button>
              <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                <Share2 size={10} /> Deep link: ?d={panchang.date}&p={panchang.placeLabel}
              </span>
            </motion.div>

            {/* How it's made — trust collapsible */}
            <HowItWorks panchang={panchang} open={howOpen} setOpen={setHowOpen} />

            {/* Consultant funnel */}
            <ConsultantCTA category="ASTROLOGY" accentColor="primary" title="Unsure about picking a Muhurat? Ask a Jyotishi" description="Whether it's avoiding Rahu Kaal or making the most of Abhijit — confirm the exact auspicious time for your work with an experienced Jyotishi." />

            {/* Free badge */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
                <Star size={11} /> 100% Free · Deterministic engine · No sign-up required
              </span>
            </motion.div>
          </div>
        )}

        {/* Idle prompt before first result */}
        {!panchang && !loading && !error && mounted && (
          <div className="text-center py-16 text-sm text-muted-foreground">Pick a city and set a date — your Panchang will appear instantly.</div>
        )}
      </div>
    </div>
  );
}

/* ─── Window block (Rahu / Yama / Gulika) ───────────────────────────────────── */

function WindowBlock({ w, meta }: { w: PanchangWindow; meta: { title: string; line: string } }) {
  return (
    <div className="p-3.5 rounded-2xl bg-background/60 border border-border/40">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{meta.title}</p>
      <p className="text-lg font-black text-foreground tabular-nums mt-1">{w.time} – {w.end}</p>
      <p className="text-[10px] text-amber-400/80 mt-0.5">part {w.part} of the day (8 equal divisions from sunrise)</p>
      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{meta.line}</p>
    </div>
  );
}

/* ─── Sun-arc hero ──────────────────────────────────────────────────────────── */

function SunArc({ panchang, nowFraction }: { panchang: PanchangDayResult; nowFraction: number | null }) {
  const f0 = fractionBetween(panchang.sunrise.iso, panchang.sunset.iso, Date.parse(panchang.rahukaal.iso));
  const f1 = fractionBetween(panchang.sunrise.iso, panchang.sunset.iso, Date.parse(panchang.rahukaal.endISO));
  const marker = nowFraction !== null ? bezierPoint(nowFraction) : null;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }} className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-7">
      <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/[0.05] blur-3xl rounded-full pointer-events-none" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{panchang.date} · {panchang.placeLabel} · {panchang.timezone}</p>
          <h2 className="text-xl sm:text-2xl font-black text-foreground mt-1">The Sun's path — {panchang.sunrise.time} to {panchang.sunset.time}</h2>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">Day length {panchang.dayLengthMinutes} minutes · Solar noon {panchang.solarNoon.time}{panchang.polar !== "none" ? " · note: noon ± 6h fallback for polar locations" : ""}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center justify-end gap-1"><CloudMoon size={11} /> Rahu Kaal</p>
          <p className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">{panchang.rahukaal.time} – {panchang.rahukaal.end}</p>
          <p className="text-[11px] text-muted-foreground">Part {panchang.rahukaal.part} of {panchang.vara.hinglish}</p>
        </div>
      </div>

      <svg viewBox="0 0 400 165" className="w-full select-none" role="img" aria-label="Sun arc with Rahu Kaal shaded segment">
        <line x1="10" y1="150" x2="390" y2="150" stroke="currentColor" className="text-border/60" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={`M${ARC.p0[0]} ${ARC.p0[1]} C${ARC.p1[0]} ${ARC.p1[1]} ${ARC.p2[0]} ${ARC.p2[1]} ${ARC.p3[0]} ${ARC.p3[1]}`} fill="none" stroke="currentColor" className="text-amber-500/30" strokeWidth="2" />
        {f1 > f0 && (
          <path d={rahuSegmentPath(f0, f1)} fill="none" stroke="currentColor" className="text-rose-500/80" strokeWidth="6" strokeLinecap="round" />
        )}
        <circle cx={ARC.p0[0]} cy={ARC.p0[1]} r="4" className="fill-amber-400/80" />
        <circle cx={ARC.p3[0]} cy={ARC.p3[1]} r="4" className="fill-orange-500/70" />
        <text x={ARC.p0[0]} y="162" textAnchor="middle" className="fill-current text-muted-foreground" fontSize="10">{panchang.sunrise.time}</text>
        <text x={ARC.p3[0]} y="162" textAnchor="middle" className="fill-current text-muted-foreground" fontSize="10">{panchang.sunset.time}</text>
        {/* now marker — mounted-effect driven; only when "now" is inside today's arc */}
        {marker !== null && (
          <g>
            <circle cx={marker[0].toFixed(3)} cy={marker[1].toFixed(3)} r="10" className="fill-amber-400/25" />
            <motion.circle cx={marker[0].toFixed(3)} cy={marker[1].toFixed(3)} r="5.5" className="fill-amber-400" initial={{ opacity: 0.5 }} animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
            <circle cx={marker[0].toFixed(3)} cy={marker[1].toFixed(3)} r="2" className="fill-white" />
          </g>
        )}
      </svg>
      {marker === null && (
        <p className="text-[10px] text-muted-foreground text-center -mt-1 flex items-center justify-center gap-1">
          <Sunset size={10} /> The live sun marker only appears when you're viewing today and the current moment falls between sunrise and sunset.
        </p>
      )}
    </motion.div>
  );
}

/* ─── Element card ──────────────────────────────────────────────────────────── */

function ElementCardView({ card, delay }: { card: ElementCard; delay: number }) {
  const Icon = card.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 220, damping: 22 }} whileHover={{ y: -3 }} className="p-5 rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/50 hover:border-[var(--color-primary)]/25 transition-colors relative overflow-hidden">
      <div className="absolute top-0 right-0 w-36 h-36 bg-[var(--color-primary)]/[0.04] blur-2xl rounded-full pointer-events-none" />
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon size={13} className="text-[var(--color-primary)]" /> {card.label}
      </p>
      <p className="text-lg font-black text-foreground mt-2 leading-snug">{card.value}</p>
      <p className="text-[10px] text-amber-400/70 mt-0.5">{card.sub}</p>
      <p className="text-xs text-foreground/90 tabular-nums mt-2 font-semibold flex items-center gap-1.5">
        <ChevronDown size={11} className="text-muted-foreground -rotate-90" /> {card.timing}
      </p>
      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed border-t border-border/30 pt-2">{card.guidance}</p>
    </motion.div>
  );
}

/* ─── "Yeh panchang kaise banta hai" trust collapsible ──────────────────────── */

function HowItWorks({ panchang, open, setOpen }: { panchang: PanchangDayResult; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-3xl bg-surface/60 backdrop-blur-xl border border-border/50 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Users size={14} className="text-[var(--color-primary)]" /> How this Panchang is made
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="block">
          <ChevronDown size={16} className="text-muted-foreground" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-3 text-[12px] text-muted-foreground leading-relaxed border-t border-border/30 pt-4">
              <p><b className="text-foreground">1. Time math (NOAA):</b> Sunrise/sunset come from the standard NOAA solar equations — solar declination + hour angle, refraction/solar-disc correction h0 = −0.833°, and one refinement pass at the event instants. All instants are computed in UTC and rendered via Intl in your city's IANA timezone ({panchang.timezone}) — so there is no room for timezone/DST mistakes.</p>
              <p><b className="text-foreground">2. The Panchang limbs:</b> Tithi = a 12° segment of the (Moon − Sun) elongation, Nakshatra = a 13°20′ segment of the sidereal Moon + pada (13°20′/4), Yoga = a 13°20′ segment of (sidereal Sun + Moon), Karana = half-tithi (6°) — from the 11 karanas, with 4 sthira ones (Shakuni/Chatushpada/Naga/Kimstughna) following a special rule. Every boundary's exact time comes from bisection on the monotonic elongation series (~second precision).</p>
              <p><b className="text-foreground">3. Same engine, same truth:</b> The planetary longitudes use the very same primitives as our kundali engine (astronomy-engine + Chitrapaksha/Lahiri ayanamsa) — so the Panchang and the Kundali will never contradict each other. For your day: ayanamsa {panchang.ayanamsaDeg.toFixed(3)}°, Sun {panchang.sunSiderealDeg.toFixed(3)}°, Moon {panchang.moonSiderealDeg.toFixed(3)}°.</p>
              <p><b className="text-foreground">4. Rahu Kaal / Yamagandam / Gulika:</b> The day from sunrise to sunset is divided into 8 equal parts; per weekday we use the widely published mapping — Rahu: Sunday 2nd, Monday 7th, Tuesday 5th, Wednesday 4th, Thursday 3rd, Friday 1st, Saturday 6th; Yamagandam (Ambreyal) and Gulika have their own standard weekday/part (comment in engine source). Abhijit Muhurat = solar noon ± 24 minutes; Brahma Muhurat = 96→48 minutes before sunrise.</p>
              <p className="text-[11px] text-muted-foreground/80">The whole engine is pure and deterministic — same date + same city = same numbers, every time, anywhere in the world. Verify by comparing the times against any reputed panchanga (a ±1–2 minute difference between two valid astronomical sources is normal).</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Scoped print stylesheet (visibility trick: sirf panchang print ho) ────── */

const PRINT_CSS = `@media print { body * { visibility: hidden !important; } .min-h-screen-app, .min-h-screen-app * { visibility: visible !important; } .min-h-screen-app { position: absolute !important; left: 0; top: 0; width: 100%; } }`;
