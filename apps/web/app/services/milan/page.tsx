"use client";

// ============================================================================
// Guna Milan (Ashtakoot vivah-milan) — 36-point Vedic compatibility, free.
// Every number here arrives from /api/milan, which is pure deterministic
// arithmetic over the SAME astronomical engine as Janam Kundali
// (Lahiri ayanamsa). No AI, no guesses — same birth data ⇒ same score.
// Motion policy: this file lives under apps/web, which resolves its OWN
// framer-motion copy (12.43.0) with no LazyMotion context — @zeal/ui's
// MotionProvider belongs to a separate packages/ui copy. So app-level files
// must use full `motion` (the `m` proxy here renders stuck at opacity 0).
// Inside packages/ui components the rule is inverted: use `m` (strict).
// ============================================================================

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeftRight, Calendar, CheckCircle2, Clock, Copy, Flame,
  Heart, Loader2, MapPin, Moon, Printer, RotateCcw, ScrollText, Share2, ShieldCheck,
  Sparkles, Star, Users, XCircle,
} from "lucide-react";
import { LocationAutocomplete, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@zeal/ui";
import ConsultantCTA from "@/components/shared/ConsultantCTA";
import type { KundaliResult, PlanetInHouse } from "@/lib/kundali/engine";
import type { KootScore, MangalStatus, MilanMatch, MilanPersonInput } from "@/lib/milan/types";

/* ─── Types & constants ─────────────────────────────────────────────────────── */

type Phase = "intro" | "input" | "computing" | "reading";
type Role = "groom" | "bride";

interface PersonForm {
  name: string;
  dob: string;
  tob: string;
  pob: string;
  pobPlace: PlacePick | null;
}

interface PlacePick {
  label: string;
  lat: number;
  lng: number;
  timezone: string;
  country?: string;
  source?: "gazetteer" | "nominatim";
}

interface FormState {
  groom: PersonForm;
  bride: PersonForm;
  question: string;
}

interface ChartsPayload {
  groom: KundaliResult;
  bride: KundaliResult;
}

const EMPTY_PERSON: PersonForm = { name: "", dob: "", tob: "", pob: "", pobPlace: null };
const EMPTY_FORM: FormState = { groom: EMPTY_PERSON, bride: EMPTY_PERSON, question: "" };

const SPRING = { type: "spring", stiffness: 200, damping: 22 } as const;

const COMPUTE_STEPS = [
  "Both kundalis are being built by the astronomical engine…",
  "Determining the Chandra rashi and Janma nakshatra…",
  "Running the 36-point Ashtakoot calculation…",
  "Checking Mangal (Kuja) Dosha and the Nadi balance…",
  "Preparing the Milan verdict and summary…",
];

/** Animation floor: keeps the multi-step phase readable even on cached hits. */
const MIN_COMPUTE_MS = 3200;

const HINGLISH_SIGNS: Record<string, string> = {
  Aries: "Mesha", Taurus: "Vrishabha", Gemini: "Mithuna", Cancer: "Karka",
  Leo: "Simha", Virgo: "Kanya", Libra: "Tula", Scorpio: "Vrishchika",
  Sagittarius: "Dhanu", Capricorn: "Makara", Aquarius: "Kumbha", Pisces: "Meena",
};

const ZODIAC_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/* ─── Consultant funnel fence ─────────────────────────────────────────────────
   ConsultantCTA is a shared component we must not edit; it renders through
   framer-motion's full `motion` proxy while this app mounts
   <LazyMotion features={domMax} strict>. It also fetches a live directory.
   Neither should ever be able to blank out a finished milan reading, so the
   subtree gets a local error boundary plus a static Hinglish fallback.
   ─────────────────────────────────────────────────────────────────────────── */

class CtaBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error("[milan] consultant CTA failed:", error);
  }

  override render(): ReactNode {
    if (this.state.failed) return <ConsultantFallback />;
    return this.props.children;
  }
}

function ConsultantFallback() {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
      <p className="text-sm font-bold text-foreground inline-flex items-center gap-2">
        <Users size={14} className="text-[var(--color-primary)]" />
        Want to know the 'why' behind this Milan?
      </p>
      <p className="text-xs text-muted-foreground mt-1.5">
        The live consultant list couldn't load just now. You can find online Jyotishis on the explore
        page — keep both kundalis and this 36-point breakdown handy when you ask.
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Link href="/explore" className="px-3 py-2 rounded-xl bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-xs font-semibold inline-flex items-center gap-1.5">
          <Users size={12} /> See online Jyotishis
        </Link>
        <Link href="/services/kundali" className="px-3 py-2 rounded-xl bg-surface-raised border border-border/60 text-xs font-medium text-foreground inline-flex items-center gap-1.5">
          <ScrollText size={12} /> View the Kundali again
        </Link>
      </div>
    </div>
  );
}

/* ─── Helpers (pure, SSR-safe) ──────────────────────────────────────────────── */

function signLabel(sign: string): string {
  const h = HINGLISH_SIGNS[sign];
  return h ? `${h} (${sign})` : sign;
}

function signIndex(sign: string): number {
  return SIGN_ORDER.indexOf(sign);
}

function signGlyph(sign: string): string {
  const i = signIndex(sign);
  return i >= 0 ? (ZODIAC_GLYPHS[i] ?? "") : "";
}

/** base64(url-safe) → JSON, forgiving on malformed links. */
function decodeShare(raw: string): MilanMatchShare | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(pad)));
    const parsed = JSON.parse(json) as MilanMatchShare;
    if (!parsed || parsed.v !== 1 || !parsed.groom || !parsed.bride) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeShare(f: FormState): string {
  const payload: MilanMatchShare = {
    v: 1,
    groom: toPersonInput(f.groom),
    bride: toPersonInput(f.bride),
  };
  const bytes = unescape(encodeURIComponent(JSON.stringify(payload)));
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toPersonInput(p: PersonForm): MilanPersonInput {
  return {
    name: p.name,
    dob: p.dob,
    tob: p.tob,
    pob: p.pob,
    ...(p.pobPlace ? { pobPlace: p.pobPlace } : {}),
  };
}

interface MilanMatchShare {
  v: 1;
  groom: MilanPersonInput;
  bride: MilanPersonInput;
}

function shareToForm(s: MilanMatchShare): FormState {
  const p = (x: MilanPersonInput): PersonForm => ({
    name: String(x.name ?? "").slice(0, 60),
    dob: /^\d{4}-\d{2}-\d{2}$/.test(String(x.dob ?? "")) ? String(x.dob) : "",
    tob: /^\d{2}:\d{2}$/.test(String(x.tob ?? "")) ? String(x.tob) : "",
    pob: String(x.pob ?? "").slice(0, 140),
    pobPlace: x.pobPlace && Number.isFinite(Number(x.pobPlace.lat)) && Number.isFinite(Number(x.pobPlace.lng))
      ? {
          label: String(x.pobPlace.label ?? "").slice(0, 140),
          lat: Number(x.pobPlace.lat),
          lng: Number(x.pobPlace.lng),
          timezone: String(x.pobPlace.timezone ?? "").slice(0, 64),
          country: String(x.pobPlace.country ?? ""),
          source: x.pobPlace.source === "nominatim" ? "nominatim" : "gazetteer",
        }
      : null,
  });
  return { groom: p(s.groom), bride: p(s.bride), question: "" };
}

function apiBody(f: FormState) {
  return {
    groom: {
      name: f.groom.name,
      dob: f.groom.dob,
      tob: f.groom.tob,
      pob: f.groom.pob,
      ...(f.groom.pobPlace ? { pobPlace: f.groom.pobPlace } : {}),
    },
    bride: {
      name: f.bride.name,
      dob: f.bride.dob,
      tob: f.bride.tob,
      pob: f.bride.pob,
      ...(f.bride.pobPlace ? { pobPlace: f.bride.pobPlace } : {}),
    },
    question: f.question,
  };
}

/** Deterministic pseudo-random for decorative particles (SSR === client). */
function hash(i: number, salt: number): number {
  const v = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */

export default function MilanPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [match, setMatch] = useState<MilanMatch | null>(null);
  const [charts, setCharts] = useState<ChartsPayload | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const computeStartRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Deep-link restore: ?m=<base64url JSON> (read from window, so no Suspense boundary needed).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("m");
      if (!q) return;
      const shared = decodeShare(q);
      if (!shared) return;
      setForm(shareToForm(shared));
      setRestored(true);
      setPhase("input");
    } catch {
      /* malformed share link — stay on the normal flow */
    }
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (submitting) return;
      setError("");
      setSubmitting(true);
      setPhase("computing");
      computeStartRef.current = Date.now();

      try {
        const res = await fetch("/api/milan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiBody(form)),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          match?: MilanMatch;
          charts?: ChartsPayload;
        };
        if (!res.ok || !data.match || !data.charts) {
          throw new Error(data.error ?? `Milan calculation failed (HTTP ${res.status}). Please try again.`);
        }

        const elapsed = Date.now() - computeStartRef.current;
        if (elapsed < MIN_COMPUTE_MS) {
          await new Promise((r) => setTimeout(r, MIN_COMPUTE_MS - elapsed));
        }
        if (!aliveRef.current) return;

        setMatch(data.match);
        setCharts(data.charts);
        setPhase("reading");
      } catch (err) {
        if (!aliveRef.current) return;
        setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
        setPhase("input");
      } finally {
        if (aliveRef.current) setSubmitting(false);
      }
    },
    [form, submitting],
  );

  const handleReset = useCallback(() => {
    setMatch(null);
    setCharts(null);
    setError("");
    setRestored(false);
    setForm(EMPTY_FORM);
    setPhase("intro");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("m");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* history unavailable — harmless */
    }
  }, []);

  const handleSwap = useCallback(() => {
    setForm((f) => ({ ...f, groom: f.bride, bride: f.groom }));
  }, []);

  const handleShareLink = useCallback(async (): Promise<boolean> => {
    try {
      const link = `${window.location.origin}${window.location.pathname}?m=${encodeShare(form)}`;
      await navigator.clipboard.writeText(link);
      return true;
    } catch {
      return false;
    }
  }, [form]);

  const handlePrint = useCallback(() => {
    try {
      window.print();
    } catch {
      /* print blocked (sandbox) — nothing to break */
    }
  }, []);

  return (
    <div className="min-h-screen-app pb-16">
      <PrintStyles />
      <HeroHeader phase={phase} onReset={handleReset} showReset={phase !== "intro"} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {phase === "intro" && <IntroPhase key="intro" onBegin={() => setPhase("input")} />}
          {phase === "input" && (
            <InputPhase
              key="input"
              form={form}
              setForm={setForm}
              error={error}
              restored={restored}
              submitting={submitting}
              onSubmit={handleSubmit}
              onSwap={handleSwap}
            />
          )}
          {phase === "computing" && <ComputingPhase key="computing" />}
          {phase === "reading" && match && charts && (
            <ReadingPhase
              key="reading"
              match={match}
              charts={charts}
              form={form}
              onReset={handleReset}
              onShare={handleShareLink}
              onPrint={handlePrint}
            />
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center mt-10">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> 100% Free · Ashtakoot math is 100% deterministic · no sign-up required
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Print stylesheet (page-scoped, no global CSS touched) ─────────────────── */

function PrintStyles() {
  return (
    <style href="milan-print-styles" precedence="medium">{`
      @media print {
        .milan-no-print { display: none !important; }
        .milan-print-block { break-inside: avoid; page-break-inside: avoid; }
        body { background: #fff !important; color: #000 !important; }
        main { max-width: 100% !important; }
      }
    `}</style>
  );
}

/* ─── Hero header ───────────────────────────────────────────────────────────── */

function HeroHeader({ phase, onReset, showReset }: { phase: Phase; onReset: () => void; showReset: boolean }) {
  return (
    <div className="relative overflow-hidden border-b border-border/40">
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[var(--color-primary)]/[0.06] blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-rose-500/[0.05] blur-[140px] rounded-full pointer-events-none" />
      <FloatingParticles />
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <Heart size={12} /> Ashtakoot Milan · 36 Points · Vedic Rule Table
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">Guna Milan</h1>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            The full Ashtakoot math from the Vara and Vadhoo Janma Kundali — Varna through Nadi,
            plus Mangal Dosha and the balance between both. All from the astronomical engine, nothing estimated.
          </p>
          {showReset && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={onReset}
              className={cn("mt-4 px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5", phase === "reading" && "milan-no-print")}
            >
              <RotateCcw size={12} /> Start Over
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: hash(i, 1) * 100,
        y: hash(i, 2) * 100,
        dur: 6 + hash(i, 3) * 4,
        delay: hash(i, 4) * 3,
      })),
    []
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-rose-300/30"
          initial={{ x: `${p.x.toFixed(3)}%`, y: `${p.y.toFixed(3)}%`, opacity: 0 }}
          animate={{ y: [null, -20, 20, -10, 0], opacity: [0, 0.6, 0.3, 0.5, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

/* ─── Phase 1: intro ────────────────────────────────────────────────────────── */

function IntroPhase({ onBegin }: { onBegin: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -20 }} transition={SPRING} className="flex flex-col items-center gap-8 py-10">
      <CoupleOrbit />
      <div className="text-center space-y-3 max-w-lg">
        <h2 className="text-2xl font-bold text-foreground">Two kundalis, measured on the scale of mathematics</h2>
        <p className="text-muted-foreground text-sm">
          The Ashtakoot system yields 36 points across 8 koots: Varna (1), Vashya (2), Tara (3),
          Yoni (4), Graha Maitri (5), Gana (6), Bhakoot (7) and Nadi (8). Our engine computes every
          koot from both Chandra rashi + Janma nakshatra using the classical rule table.
        </p>
      </div>
      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onBegin} className="px-8 py-5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-[var(--color-primary)]/30 transition-all inline-flex items-center gap-3">
        <Sparkles size={22} /> Start Milan
      </motion.button>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-2">
        {[
          { icon: ScrollText, title: "1. Both Kundalis", desc: "The Vara and Vadhoo birth kundalis come from the same Lahiri-ayanamsa engine — Chandra rashi and nakshatra are the basis of the Milan." },
          { icon: ShieldCheck, title: "2. 36-Point Math", desc: "Every koot's earned/max points come from the rule table — you can recalculate and verify them yourself." },
          { icon: Flame, title: "3. Mangal + Nadi", desc: "Kuja Dosha status, cancellation yog and the balance between both; when Nadi is the same you get the Antyashaja caution." },
        ].map((step, i) => (
          <motion.div key={step.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }} className="p-4 rounded-2xl bg-surface/60 border border-border/40 hover:border-[var(--color-primary)]/25 transition-colors">
            <step.icon size={16} className="text-[var(--color-primary)] mb-2" />
            <p className="text-xs font-bold text-foreground">{step.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{step.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="max-w-3xl w-full p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3">
        <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Milan is supportive mathematics, not a verdict. Marriage decisions should be taken with the
          families, practical compatibility and (where needed) an experienced Jyotishi's advice —
          especially when Nadi/Bhakoot/Gana score low.
        </p>
      </div>
    </motion.div>
  );
}

/** Two moon-sigils orbiting a shared centre — deterministic geometry. */
function CoupleOrbit() {
  const nodes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return {
          left: (50 + Math.cos(angle) * 34).toFixed(3),
          top: (50 + Math.sin(angle) * 34).toFixed(3),
          delay: (i * 0.35).toFixed(3),
        };
      }),
    []
  );
  return (
    <div className="relative w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]">
      <motion.div className="absolute inset-0 rounded-full border border-rose-500/15" animate={{ rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute inset-8 rounded-full border border-[var(--color-primary)]/15" animate={{ rotate: -360 }} transition={{ duration: 120, repeat: Infinity, ease: "linear" }} />
      {nodes.map((n, i) => (
        <motion.span
          key={i}
          className="absolute text-rose-400/40 text-lg"
          style={{ left: `${n.left}%`, top: `${n.top}%`, transform: "translate(-50%, -50%)" }}
          animate={{ opacity: [0.25, 0.7, 0.25], scale: [1, 1.15, 1] }}
          transition={{ duration: 3.2, delay: Number(n.delay), repeat: Infinity, ease: "easeInOut" }}
        >
          {i % 2 === 0 ? "☽" : "☉"}
        </motion.span>
      ))}
      <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-rose-500/10 blur-2xl" animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl">💞</div>
    </div>
  );
}

/* ─── Phase 2: intake ───────────────────────────────────────────────────────── */

function InputPhase({
  form,
  setForm,
  error,
  restored,
  submitting,
  onSubmit,
  onSwap,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  error: string;
  restored: boolean;
  submitting: boolean;
  onSubmit: (e?: React.FormEvent) => void;
  onSwap: () => void;
}) {
  const setPerson = useCallback(
    (role: Role, patch: Partial<PersonForm>) => setForm({ ...form, [role]: { ...form[role], ...patch } }),
    [form, setForm]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={SPRING}>
      <form onSubmit={onSubmit} className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-9 space-y-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[var(--color-primary)]/[0.03] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-rose-500/[0.03] blur-3xl rounded-full pointer-events-none" />

        <div className="relative space-y-6">
          {restored && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2">
              <Share2 size={13} className="text-sky-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-sky-200">Birth data restored from the shared link — review it and press “Run Milan”.</p>
            </div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="alert" className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-5 items-start">
            <PersonCard role="groom" person={form.groom} onChange={(patch) => setPerson("groom", patch)} storageKey="zeal:recent-places:milan-1" />
            <SwapButton onSwap={onSwap} />
            <PersonCard role="bride" person={form.bride} onChange={(patch) => setPerson("bride", patch)} storageKey="zeal:recent-places:milan-2" />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Any specific wish or question? (optional)</label>
            <textarea
              rows={2}
              maxLength={800}
              value={form.question}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, question: e.target.value })}
              placeholder="e.g. If both rashi are the same, does Nadi stay 0? (This is only recorded; the Milan math is deterministic.)"
              className="w-full px-4 py-3 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <Sparkles size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              Please give the exact birth minute — when the Chandra rashi or nakshatra sits near a boundary,
              the whole Milan result can change. The engine computes strictly from what your data says.
            </p>
          </div>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-[var(--color-primary)]/20 transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Computing Milan…
              </>
            ) : (
              <>
                <Heart size={18} /> Run Ashtakoot Milan
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

function SwapButton({ onSwap }: { onSwap: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onSwap}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92, rotate: 180 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      aria-label="Swap the Vara and Vadhoo data"
      className="mx-auto mt-14 w-11 h-11 rounded-full bg-surface-raised border border-border/60 flex items-center justify-center text-[var(--color-primary)] hover:bg-surface-overlay transition-colors"
    >
      <ArrowLeftRight size={16} />
    </motion.button>
  );
}

function PersonCard({
  role,
  person,
  onChange,
  storageKey,
}: {
  role: Role;
  person: PersonForm;
  onChange: (patch: Partial<PersonForm>) => void;
  storageKey: string;
}) {
  const isGroom = role === "groom";
  const title = isGroom ? "Vara (Groom)" : "Vadhoo (Bride)";
  const accent = isGroom ? "from-sky-500/15 to-[var(--color-primary)]/15" : "from-rose-500/15 to-amber-500/15";
  const icon = isGroom ? Users : Heart;

  return (
    <motion.div
      initial={{ opacity: 0, x: isGroom ? -14 : 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="rounded-2xl border border-border/50 bg-background/40 p-4 sm:p-5 space-y-4 milan-print-block"
    >
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r", accent)}>
        {(() => {
          const Icon = icon;
          return <Icon size={14} className="text-foreground" />;
        })()}
        <p className="text-xs font-black uppercase tracking-wider text-foreground">{title}</p>
      </div>

      <Field label="Name" icon={icon === Users ? Users : Heart}>
        <input
          id={`${role}-name`}
          type="text"
          required
          maxLength={60}
          value={person.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })}
          placeholder={isGroom ? "Vara's name" : "Vadhoo's name"}
          className="w-full px-4 py-3 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date of Birth" icon={Calendar}>
          <input
            id={`${role}-dob`}
            type="date"
            required
            min="1900-01-01"
            value={person.dob}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ dob: e.target.value })}
            className="w-full px-4 py-3 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
          />
        </Field>
        <Field label="Time of Birth" icon={Clock}>
          <input
            id={`${role}-tob`}
            type="time"
            required
            value={person.tob}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ tob: e.target.value })}
            className="w-full px-4 py-3 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
          />
        </Field>
      </div>

      <Field label="Place of Birth" icon={MapPin}>
        <LocationAutocomplete
          id={`${role}-pob`}
          required
          recentStorageKey={storageKey}
          placeholder="Search a city — e.g. Pune, Maharashtra"
          value={person.pob}
          onChange={(v) => onChange({ pob: v, pobPlace: null })}
          onSelect={(p) => onChange({ pob: p.label, pobPlace: p })}
        />
        {person.pobPlace?.source === "nominatim" && (
          <p className="mt-1.5 text-[10px] text-amber-400/80">These coordinates are approximate (OpenStreetMap) — picking the exact city makes the rashi certain.</p>
        )}
        {person.pobPlace && person.pobPlace.source !== "nominatim" && (
          <p className="mt-1.5 text-[10px] text-emerald-400/80 tabular-nums">
            Locked: {person.pobPlace.lat.toFixed(3)}°, {person.pobPlace.lng.toFixed(3)}° · {person.pobPlace.timezone}
          </p>
        )}
      </Field>
    </motion.div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
        <Icon size={10} /> {label}
      </label>
      {children}
    </div>
  );
}

/* ─── Phase 3: computing ────────────────────────────────────────────────────── */

function ComputingPhase() {
  const [stepIndex, setStepIndex] = useState(0);
  const [kootsDone, setKootsDone] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % COMPUTE_STEPS.length);
    }, 1300);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 8; i++) {
      timers.push(setTimeout(() => setKootsDone(i + 1), 300 + i * 330));
    }
    return () => {
      clearInterval(stepInterval);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING} className="flex flex-col items-center gap-7 py-12">
      {/* Eight koot lamps lighting up one by one */}
      <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] flex items-center justify-center">
        <motion.div className="absolute inset-0 rounded-full bg-rose-500/5 blur-3xl" animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
        {KOOT_ORDER.map((label, i) => {
          const angle = (i / KOOT_ORDER.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 118;
          const x = (Math.cos(angle) * radius).toFixed(3);
          const y = (Math.sin(angle) * radius).toFixed(3);
          const lit = i < kootsDone;
          return (
            <motion.div
              key={label}
              className="absolute flex flex-col items-center gap-1"
              style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: "translate(-50%, -50%)" }}
              initial={{ scale: 0.6, opacity: 0.25 }}
              animate={lit ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0.25 }}
              transition={{ type: "spring", stiffness: 300, damping: 16 }}
            >
              <span className={cn("w-9 h-9 rounded-full border flex items-center justify-center text-[10px] font-black", lit ? "bg-amber-400/20 border-amber-400/50 text-amber-300" : "bg-surface-raised/40 border-border/40 text-muted-foreground")}>{label}</span>
            </motion.div>
          );
        })}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
        <div className="absolute bottom-4 text-[10px] text-muted-foreground tabular-nums">{kootsDone}/8 koots computed</div>
      </div>

      <div className="text-center space-y-3">
        <AnimatePresence mode="wait">
          <motion.p key={stepIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="text-sm font-medium text-foreground">
            {COMPUTE_STEPS[stepIndex] ?? ""}
          </motion.p>
        </AnimatePresence>
        <div className="flex items-center justify-center gap-1.5">
          <Loader2 size={12} className="animate-spin text-amber-400" />
          <span className="text-[10px] text-muted-foreground">The engine is computing live — the full breakdown appears as soon as the result arrives</span>
        </div>
      </div>
    </motion.div>
  );
}

const KOOT_ORDER = ["Varna", "Vashya", "Tara", "Yoni", "Maitri", "Gana", "Bhakoot", "Nadi"];

/* ─── Phase 4: results ──────────────────────────────────────────────────────── */

function ReadingPhase({
  match,
  charts,
  form,
  onReset,
  onShare,
  onPrint,
}: {
  match: MilanMatch;
  charts: ChartsPayload;
  form: FormState;
  onReset: () => void;
  onShare: () => Promise<boolean>;
  onPrint: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    const ok = await onShare();
    if (ok) setCopied(true);
  }, [onShare]);

  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: "spring", stiffness: 180, damping: 22 }} className="space-y-6">
        <MetaBadges match={match} charts={charts} />
        <ScoreCard match={match} />
        <KootBars koots={match.koots} />
        <BandCard match={match} />
        <MangalSection match={match} />
        <BothKundalis charts={charts} match={match} />
        <SummaryCard match={match} />

        <div className="flex flex-wrap items-center gap-2 milan-no-print">
          <motion.button whileTap={{ scale: 0.97 }} onClick={onReset} className="px-4 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5">
            <RotateCcw size={12} /> Start Over
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onPrint} className="px-4 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5">
            <Printer size={12} /> Print / PDF
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCopy} className="px-4 py-2.5 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground inline-flex items-center gap-1.5">
            {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? "Link copied!" : "Share link"}
          </motion.button>
          <span className="text-[10px] text-muted-foreground">
            The share link contains only the birth data you provided (base64) — no server call beforehand.
          </span>
        </div>

        <div className="milan-no-print">
          <CtaBoundary>
            <ConsultantCTA
              category="ASTROLOGY"
              title="Want to know the 'why' behind this Milan?"
              description={`It scores ${match.total}/36 right now. For personal guidance on low Gana/Nadi/Bhakoot scores, the Kuja balance and Muhurat, talk to an experienced Jyotishi with both kundalis in hand.`}
              accentColor="primary"
            />
          </CtaBoundary>
        </div>

        <p className="text-[10px] text-muted-foreground/70 text-center">
          Engine version {match.version} · deterministic Ashtakoot rule table · your data is never persisted on the server · form: {form.groom.name || "vara"} × {form.bride.name || "vadhoo"}
        </p>
      </motion.div>
    </TooltipProvider>
  );
}

function MetaBadges({ match, charts }: { match: MilanMatch; charts: ChartsPayload }) {
  const items = [
    { icon: Users, text: `${charts.groom.input.name} · ${match.groom.signName}/${match.groom.nakshatraName}` },
    { icon: Heart, text: `${charts.bride.input.name} · ${match.bride.signName}/${match.bride.nakshatraName}` },
    { icon: Calendar, text: `${charts.groom.input.birthDate} ${charts.groom.input.birthTime}` },
    { icon: Clock, text: `${charts.bride.input.birthDate} ${charts.bride.input.birthTime}` },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground">
      {items.map((b, i) => (
        <span key={i} className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
          <b.icon size={9} /> {b.text}
        </span>
      ))}
      {match.sameDataFlag && (
        <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/25 rounded-full flex items-center gap-1 text-rose-300">
          <AlertTriangle size={9} /> Both have the same birth data — self-match flagged
        </span>
      )}
    </motion.div>
  );
}

/* ─── Score ring (SVG donut + deterministic count-up) ───────────────────────── */

const RING_R = 84;
const RING_C = 2 * Math.PI * RING_R; // constant, identical on server & client

function ScoreCard({ match }: { match: MilanMatch }) {
  const [shown, setShown] = useState(0);

  // Deterministic ease-out count-up driven by requestAnimationFrame (no Date.now in render).
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const totalFrames = 60;
    const target = match.total;
    const tick = () => {
      frame += 1;
      const p = 1 - Math.pow(1 - frame / totalFrames, 3);
      setShown(Math.round(target * p));
      if (frame < totalFrames) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [match.total]);

  const progress = Math.min(1, Math.max(0, shown / 36));
  const offset = (RING_C * (1 - progress)).toFixed(3);
  const tone = bandTone(match.total);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ...SPRING }} className={cn("relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 milan-print-block", tone.ringBorder)}>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">
        <div className="relative w-[200px] h-[200px] mx-auto">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90 select-none">
            <circle cx="100" cy="100" r={RING_R} fill="none" strokeWidth="14" className="stroke-surface-raised" />
            <motion.circle
              cx="100"
              cy="100"
              r={RING_R}
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={RING_C.toFixed(3)}
              strokeDashoffset={offset}
              className={tone.strokeClass}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-4xl font-black tabular-nums", tone.textClass)}>{shown}/36</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{match.percentage.toFixed(3)}%</span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-foreground">{match.band.label}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <Sparkles size={20} className={tone.textClass} /> {match.band.headline}
          </h2>
          <p className="text-xs text-muted-foreground">
            Range {match.band.range} · 8 koots, 36 points total ·{" "}
            {match.koots.filter((k) => k.earned === k.max).length}/8 koots at full marks
          </p>
          <div className="flex flex-wrap gap-2">
            {match.koots.map((k) => (
              <Tooltip key={k.key}>
                <TooltipTrigger asChild>
                  <span className={cn("px-2.5 py-1 rounded-lg border text-[10px] font-bold tabular-nums cursor-help", k.earned === k.max ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : k.earned <= k.max * 0.4 ? "bg-rose-500/10 border-rose-500/25 text-rose-300" : "bg-amber-500/10 border-amber-500/25 text-amber-300")}>
                    {k.name} {k.earned}/{k.max}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px]">
                  {k.verdict}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {match.advisories.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border/40 space-y-1.5">
          {match.advisories.map((a, i) => (
            <p key={i} className="text-[10px] text-amber-300/90 flex items-start gap-1.5">
              <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {a}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function bandTone(total: number): { textClass: string; strokeClass: string; ringBorder: string } {
  if (total >= 32) return { textClass: "text-emerald-400", strokeClass: "stroke-emerald-500", ringBorder: "border-emerald-500/25" };
  if (total >= 26) return { textClass: "text-[var(--color-primary)]", strokeClass: "stroke-[var(--color-primary)]", ringBorder: "border-[var(--color-primary)]/25" };
  if (total >= 18) return { textClass: "text-amber-400", strokeClass: "stroke-amber-500", ringBorder: "border-amber-500/25" };
  return { textClass: "text-rose-400", strokeClass: "stroke-rose-500", ringBorder: "border-rose-500/25" };
}

/* ─── Per-koot bars ─────────────────────────────────────────────────────────── */

function KootBars({ koots }: { koots: KootScore[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ...SPRING }} className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 milan-print-block">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-4">Ashtakoot breakdown — the math behind every koot</p>
      <div className="space-y-3.5">
        {koots.map((k, i) => (
          <KootRow key={k.key} koot={k} index={i} />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-4">
        Hover or tap any chip — you'll see that koot's rule-level detail (Classical table:
        Brihat Samhita, Phaladeepika, BPHS, Saravali).
      </p>
    </motion.div>
  );
}

function KootRow({ koot, index }: { koot: KootScore; index: number }) {
  const pct = (koot.earned / koot.max) * 100;
  const width = `${Math.max(0, Math.min(100, pct)).toFixed(3)}%`;
  const tone = koot.earned === koot.max ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : koot.earned <= koot.max * 0.4 ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-gradient-to-r from-amber-500 to-yellow-400";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 + index * 0.06 }}
          className="grid grid-cols-[92px_1fr_64px] sm:grid-cols-[150px_1fr_74px] gap-3 items-center cursor-help"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground truncate">{koot.name}</p>
            <p className="text-[9px] text-muted-foreground truncate">{koot.nameHi}</p>
          </div>
          <div className="h-2.5 bg-surface-raised rounded-full overflow-hidden">
            <motion.div className={cn("h-full rounded-full", tone)} initial={{ width: "0%" }} animate={{ width }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 + index * 0.06 }} />
          </div>
          <p className="text-[11px] font-black tabular-nums text-right text-foreground">
            {koot.earned}
            <span className="text-muted-foreground font-medium">/{koot.max}</span>
          </p>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] leading-relaxed">
        <p className="font-bold mb-0.5">{koot.name} — {koot.earned}/{koot.max}</p>
        <p className="mb-1 opacity-80">{koot.meaning}</p>
        <p>{koot.verdict}</p>
        <p className="mt-1 opacity-70 tabular-nums">{koot.detail}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Band verdict card ─────────────────────────────────────────────────────── */

function BandCard({ match }: { match: MilanMatch }) {
  const tone = bandTone(match.total);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, ...SPRING }} className={cn("relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border p-5 sm:p-8 milan-print-block", tone.ringBorder)}>
      <div className="absolute -top-16 -right-10 w-56 h-56 bg-[var(--color-primary)]/[0.05] blur-3xl rounded-full pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0", tone.ringBorder)}>
          <ShieldCheck size={18} className={tone.textClass} />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Milan band · {match.band.range} points</p>
          <h3 className="text-lg font-black text-foreground">{match.band.headline}</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{match.band.note}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(["shreshth", "uttam", "madhyam", "chetaavni"] as const).map((key) => {
              const active = match.band.key === key;
              return (
                <span key={key} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold border", active ? "bg-[var(--color-primary)]/15 border-[var(--color-primary)]/35 text-[var(--color-primary)]" : "bg-surface-raised/40 border-border/40 text-muted-foreground")}>
                  {key === "chetaavni" ? "Chetaavni (<18)" : `${BAND_RANGE_LABEL[key]}`}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const BAND_RANGE_LABEL: Record<"shreshth" | "uttam" | "madhyam" | "chetaavni", string> = {
  shreshth: "Shreshth 32-36",
  uttam: "Uttam 26-31",
  madhyam: "Madhyam 18-25",
  chetaavni: "Chetaavni <18",
};

/* ─── Mangal dosha ──────────────────────────────────────────────────────────── */

function MangalSection({ match }: { match: MilanMatch }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, ...SPRING }} className="rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 milan-print-block">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
        <Flame size={12} className="text-rose-400" /> Mangal (Kuja) Dosha — both kundalis' side
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MangalCard title={`Vara — ${match.groom.signName}`} status={match.mangal.groom} />
        <MangalCard title={`Vadhoo — ${match.bride.signName}`} status={match.mangal.bride} />
      </div>
      <div className={cn("mt-4 p-3 rounded-xl border flex items-start gap-2", match.mangal.santhulan ? "bg-emerald-500/5 border-emerald-500/20" : "bg-surface-raised/40 border-border/40")}>
        <Moon size={13} className={match.mangal.santhulan ? "text-emerald-400 mt-0.5 shrink-0" : "text-muted-foreground mt-0.5 shrink-0"} />
        <p className="text-[11px] text-muted-foreground leading-relaxed">{match.mangal.note}</p>
      </div>
      <p className="text-[10px] text-muted-foreground/80 mt-3">
        Note: a simplified cancellation rule is applied here (Mars in its own, exalted or Guru-ruled sign).
        Subtle rules like Jupiter or Moon conjunction/aspect on Mars can only be decided by a Jyotishi.
      </p>
    </motion.div>
  );
}

function MangalCard({ title, status }: { title: string; status: MangalStatus }) {
  const active = status.hasDosha && !status.cancelled;
  const tone = active ? { box: "bg-rose-500/10 border-rose-500/25", text: "text-rose-400", Icon: XCircle } : { box: "bg-emerald-500/10 border-emerald-500/25", text: "text-emerald-400", Icon: CheckCircle2 };
  const Icon = tone.Icon;
  return (
    <div className={cn("p-4 rounded-2xl border", tone.box)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-black text-foreground">{title}</p>
        <Icon size={15} className={tone.text} />
      </div>
      <p className={cn("text-[11px] font-bold", tone.text)}>
        {active ? "Mangal Dosha: active" : status.cancelled ? "Mangal Dosha: nivrutti (cancelled)" : "Mangal Dosha: none"}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{status.note}</p>
      <p className="text-[10px] text-muted-foreground/80 mt-2 tabular-nums">
        Mars Rashi: {status.marsSign} · {status.marsHouseFromLagna}th Bhava from Lagna · {status.marsHouseFromMoon}th Bhava from Chandra
      </p>
    </div>
  );
}

/* ─── Both kundalis side by side (mini North-Indian charts) ─────────────────── */

function BothKundalis({ charts, match }: { charts: ChartsPayload; match: MilanMatch }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, ...SPRING }} className="rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-5 sm:p-8 milan-print-block">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-4">Both Kundalis — the basis of this Milan</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <KundaliMini label={`Vara · ${charts.groom.input.name}`} k={charts.groom} moon={match.groom} />
        <KundaliMini label={`Vadhoo · ${charts.bride.input.name}`} k={charts.bride} moon={match.bride} />
      </div>
    </motion.div>
  );
}

function KundaliMini({ label, k, moon }: { label: string; k: KundaliResult; moon: MilanMatch["groom"] }) {
  const signOfHouse = useMemo(() => {
    const m = new Map<number, string>();
    for (const h of k.chart.houses) m.set(h.house, h.sign);
    return m;
  }, [k]);

  const marksOfHouse = useMemo(() => {
    const m = new Map<number, string[]>();
    const hot = k.chart.planets.filter((p) => p.planet === "Moon" || p.planet === "Mars" || p.planet === "Sun");
    for (const p of hot) {
      const list = m.get(p.house) ?? [];
      list.push(glyphFor(p));
      m.set(p.house, list);
    }
    return m;
  }, [k]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-foreground">{label}</p>
      <svg viewBox="-2 -2 204 204" className="w-full max-w-[300px] mx-auto select-none">
        <g stroke="currentColor" className="text-amber-500/30" strokeWidth="1.2" fill="none">
          <rect x="0" y="0" width="200" height="200" />
          <line x1="0" y1="0" x2="200" y2="200" />
          <line x1="200" y1="0" x2="0" y2="200" />
          <polygon points="100,0 200,100 100,200 0,100" />
        </g>
        {HOUSE_SHAPES.map((h) => {
          const sign = signOfHouse.get(h.house) ?? "";
          const sIdx = signIndex(sign);
          const marks = marksOfHouse.get(h.house) ?? [];
          return (
            <g key={h.house}>
              {sIdx >= 0 && (
                <text x={h.lx + h.numDx} y={h.ly + h.numDy} textAnchor="middle" className="fill-amber-500/60" fontSize="8" fontWeight="700">
                  {sIdx + 1}
                  {ZODIAC_GLYPHS[sIdx]}
                </text>
              )}
              {h.house === 1 && (
                <text x={h.lx} y={h.ly - 13} textAnchor="middle" className="fill-[var(--color-primary)]" fontSize="6.5" fontWeight="800">
                  Lagna
                </text>
              )}
              {marks.map((g, i) => (
                <text key={`${g}-${i}`} x={h.lx} y={h.ly + i * 10} textAnchor="middle" className="fill-foreground" fontSize="9" fontWeight="600">
                  {g}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <MiniFact label="Chandra rashi" value={`${signGlyph(moon.signName)} ${signLabel(moon.signName)}`} />
        <MiniFact label="Janma nakshatra" value={moon.nakshatraName} />
        <MiniFact label="Lagna" value={signLabel(k.chart.ascendantSign)} />
        <MiniFact label="Ayanamsa (Lahiri)" value={`${k.chart.ayanamsa.toFixed(3)}°`} />
      </div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-2 rounded-xl bg-background/60 border border-border/40 min-w-0">
      <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[11px] font-bold text-foreground truncate">{value}</p>
    </div>
  );
}

function glyphFor(p: PlanetInHouse): string {
  if (p.planet === "Moon") return "☽";
  if (p.planet === "Mars") return "♂";
  return "☉";
}

const HOUSE_SHAPES: ReadonlyArray<{ house: number; lx: number; ly: number; numDx: number; numDy: number }> = [
  { house: 1, lx: 100, ly: 52, numDx: 0, numDy: -26 },
  { house: 2, lx: 50, ly: 24, numDx: -22, numDy: -8 },
  { house: 3, lx: 26, ly: 50, numDx: -10, numDy: -26 },
  { house: 4, lx: 52, ly: 122, numDx: 0, numDy: 26 },
  { house: 5, lx: 26, ly: 150, numDx: -10, numDy: 12 },
  { house: 6, lx: 50, ly: 176, numDx: -22, numDy: 8 },
  { house: 7, lx: 100, ly: 148, numDx: 0, numDy: 26 },
  { house: 8, lx: 150, ly: 176, numDx: 22, numDy: 8 },
  { house: 9, lx: 174, ly: 150, numDx: 10, numDy: 12 },
  { house: 10, lx: 148, ly: 122, numDx: 0, numDy: -26 },
  { house: 11, lx: 174, ly: 50, numDx: 10, numDy: -26 },
  { house: 12, lx: 150, ly: 24, numDx: 22, numDy: -8 },
];

/* ─── Summary (deterministic Hinglish text, no AI) ──────────────────────────── */

function SummaryCard({ match }: { match: MilanMatch }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62, ...SPRING }} className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-9 milan-print-block">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.04] blur-3xl rounded-full pointer-events-none" />
      <div className="relative">
        <h3 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">
          <ScrollText size={18} className="text-[var(--color-primary)]" /> Milan Summary (from the rule table, not AI)
        </h3>
        <p className="text-[11px] text-muted-foreground mb-4">Every line is derived directly from your computed rashi/nakshatra and the classical rules — copy-pasteable and re-verifiable.</p>
        <div className="space-y-3">
          {match.summary.map((line, i) => (
            <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.07 }} className="text-[13px] text-muted-foreground leading-relaxed flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400/60 shrink-0" />
              {line}
            </motion.p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
