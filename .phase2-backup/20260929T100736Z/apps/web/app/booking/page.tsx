"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Booking — single-page state machine
// ─────────────────────────────────────────────────────────────────────────────
//   duration → slot → pay → confirming → done
// Deep-linkable: consultantId, service, duration, date, slot live in the URL.
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowLeft, ArrowRight, Calendar, CheckCircle2,
  Clock, Loader2, ShieldCheck, Sparkles, Video,
} from "lucide-react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { useWallet, loadRazorpayScript } from "@/hooks/useWallet";
import { toast } from "@/components/ui/toaster";

type ServiceType = "chat" | "audio" | "video" | "physical";
type Step = "duration" | "slot" | "pay" | "confirming" | "done";

interface ConsultantSummary {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  category: string;
  perMinuteRate: number;
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  physicalRate: number | null;
  rating: number;
}

interface BookingResult {
  bookingId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

const DURATIONS = [15, 30, 45, 60] as const;
const SERVICES: Array<{ id: ServiceType; label: string; icon: typeof Video }> = [
  { id: "chat", label: "Chat", icon: Sparkles },
  { id: "audio", label: "Audio", icon: Clock },
  { id: "video", label: "Video", icon: Video },
];

interface State {
  step: Step;
  service: ServiceType;
  duration: number;
  slot: string | null;
}

type Action =
  | { type: "SET_SERVICE"; service: ServiceType }
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_SLOT"; slot: string }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "CONFIRMING" }
  | { type: "DONE" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_SERVICE":   return { ...s, service: a.service };
    case "SET_DURATION":  return { ...s, duration: a.duration };
    case "SET_SLOT":      return { ...s, slot: a.slot };
    case "NEXT":
      if (s.step === "duration") return { ...s, step: "slot" };
      if (s.step === "slot" && s.slot) return { ...s, step: "pay" };
      return s;
    case "BACK":
      if (s.step === "slot") return { ...s, step: "duration" };
      if (s.step === "pay")  return { ...s, step: "slot" };
      return s;
    case "CONFIRMING": return { ...s, step: "confirming" };
    case "DONE":       return { ...s, step: "done" };
    default: return s;
  }
}

function BookingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const consultantId = params.get("consultantId") ?? "";

  const [state, dispatch] = useReducer(reducer, {
    step: "duration",
    service: "chat",
    duration: 30,
    slot: null,
  });

  const [consultant, setConsultant] = useState<ConsultantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadRazorpayScript();
    fetch("/api/users/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { id: string } } | null) => {
        if (d?.user?.id) setUserId(d.user.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!consultantId) {
      setError("Missing consultant. Please start again from Explore.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/consultants/${consultantId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { consultant?: ConsultantSummary } & ConsultantSummary;
        const c = data.consultant ?? data;
        if (!cancelled) setConsultant(c);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [consultantId]);

  const wallet = useWallet(userId);

  const rate = useMemo(() => {
    if (!consultant) return 0;
    const map: Record<ServiceType, number | null> = {
      chat: consultant.chatRate,
      audio: consultant.audioRate,
      video: consultant.videoRate,
      physical: consultant.physicalRate,
    };
    return Number(map[state.service] ?? consultant.perMinuteRate ?? 50);
  }, [consultant, state.service]);

  const amount = useMemo(() => {
    if (state.service === "physical") return rate;
    return Math.round((rate * state.duration / 60) * 100) / 100;
  }, [rate, state.duration, state.service]);

  const canAdvance =
    (state.step === "duration" && state.duration > 0) ||
    (state.step === "slot" && state.slot !== null) ||
    (state.step === "pay" && !submitting);

  const handlePay = useCallback(async () => {
    if (!state.slot || !consultant) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/instamojo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantId: consultant.id,
          scheduledAt: state.slot,
          durationMinutes: state.duration,
          serviceType: state.service,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const booking = (await res.json()) as BookingResult;

      dispatch({ type: "CONFIRMING" });

      const result = await wallet.openCheckout(
        {
          orderId: booking.orderId,
          amount: booking.amount,
          currency: booking.currency,
          keyId: booking.keyId,
        },
        `Session with ${consultant.name}`,
      );

      if (!result?.verified) {
        throw new Error("Payment cancelled or failed");
      }

      const confirmRes = await fetch(`/api/bookings/${booking.bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razorpayPaymentId: result.razorpay_payment_id }),
      });
      if (!confirmRes.ok) throw new Error("Could not confirm booking");

      dispatch({ type: "DONE" });
      toast({ title: "Booking confirmed", variant: "success" });
      setTimeout(() => router.push("/bookings"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
      dispatch({ type: "BACK" });
    } finally {
      setSubmitting(false);
    }
  }, [state.slot, state.duration, state.service, consultant, wallet, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (state.step === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Booking confirmed</h2>
          <p className="text-sm text-muted-foreground">
            Taking you to your bookings…
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => (state.step === "duration" ? router.back() : dispatch({ type: "BACK" }))}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground
                     hover:text-[var(--color-primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight">Book a session</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick your service, choose a time, and pay securely.
          </p>
        </div>

        <Stepper current={state.step} />

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20
                       text-rose-400 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle size={13} /> {error}
          </motion.div>
        )}

        {consultant && (
          <div className="mb-5 p-4 rounded-2xl bg-surface border border-border flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/20 overflow-hidden flex items-center justify-center shrink-0">
              {consultant.avatar
                ? <img src={consultant.avatar} alt="" className="w-full h-full object-cover" />
                : <span className="text-[var(--color-primary)] font-black">
                    {consultant.name.charAt(0).toUpperCase()}
                  </span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{consultant.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {consultant.category.toLowerCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Rate</p>
              <p className="text-sm font-mono font-black text-[var(--color-primary)]">
                ₹{rate}/min
              </p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {state.step === "duration" && (
            <motion.div
              key="duration"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-5"
            >
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Service
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SERVICES.map((s) => {
                    const Icon = s.icon;
                    const active = state.service === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => dispatch({ type: "SET_SERVICE", service: s.id })}
                        className={`p-3.5 rounded-2xl border transition-all active:scale-95 ${
                          active
                            ? "bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-foreground"
                            : "bg-surface border-border text-muted-foreground hover:border-[var(--color-primary)]/40"
                        }`}
                      >
                        <Icon size={16} className="mx-auto mb-1.5" />
                        <p className="text-xs font-black">{s.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => dispatch({ type: "SET_DURATION", duration: d })}
                      className={`py-3 rounded-2xl text-sm font-black transition-all active:scale-95 ${
                        state.duration === d
                          ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-lg"
                          : "bg-surface border border-border text-muted-foreground"
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-mono">₹{rate}/min</span>
                </div>
                <div className="flex justify-between text-xs mb-3">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-mono">{state.duration} min</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border">
                  <span className="font-black">Total</span>
                  <span className="font-black font-mono text-[var(--color-primary)]">
                    ₹{amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {state.step === "slot" && consultant && (
            <motion.div
              key="slot"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Pick a time
              </label>
              <SlotPicker
                consultantId={consultant.id}
                durationMinutes={state.duration}
                selectedSlot={state.slot}
                onSelect={(iso) => dispatch({ type: "SET_SLOT", slot: iso })}
              />
            </motion.div>
          )}

          {(state.step === "pay" || state.step === "confirming") && consultant && (
            <motion.div
              key="pay"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-5"
            >
              <div className="p-5 rounded-2xl bg-surface border border-border space-y-3">
                <Row label="Consultant" value={consultant.name} />
                <Row label="Service" value={state.service.charAt(0).toUpperCase() + state.service.slice(1)} />
                <Row label="Duration" value={`${state.duration} min`} />
                {state.slot && (
                  <Row
                    label="When"
                    value={new Date(state.slot).toLocaleString("en-IN", {
                      weekday: "short", day: "numeric", month: "short",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  />
                )}
                <div className="pt-3 border-t border-border flex justify-between">
                  <span className="font-black">Total</span>
                  <span className="font-black font-mono text-lg text-[var(--color-primary)]">
                    ₹{amount.toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-1">
                  <ShieldCheck size={10} /> Held in escrow until the session ends
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Nav ─────────────────────────────────────────────────── */}
        {state.step !== "confirming" && (
          <div className="mt-6 flex gap-3">
            {state.step === "slot" && (
              <button
                onClick={() => dispatch({ type: "BACK" })}
                className="px-5 py-3 rounded-2xl bg-surface border border-border
                           text-muted-foreground text-sm font-black
                           transition-all active:scale-95"
              >
                Back
              </button>
            )}
            {state.step === "duration" && (
              <button
                onClick={() => dispatch({ type: "NEXT" })}
                disabled={!canAdvance}
                className="flex-1 py-3.5 rounded-2xl
                           bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                           text-white text-sm font-black
                           shadow-xl shadow-[var(--color-primary-hover)]/20
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2
                           transition-all active:scale-[0.98]"
              >
                Continue <ArrowRight size={15} />
              </button>
            )}
            {state.step === "slot" && (
              <button
                onClick={() => dispatch({ type: "NEXT" })}
                disabled={!canAdvance}
                className="flex-1 py-3.5 rounded-2xl
                           bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                           text-white text-sm font-black
                           shadow-xl shadow-[var(--color-primary-hover)]/20
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2
                           transition-all active:scale-[0.98]"
              >
                Continue <ArrowRight size={15} />
              </button>
            )}
            {state.step === "pay" && (
              <button
                onClick={() => void handlePay()}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl
                           bg-gradient-to-r from-emerald-600 to-teal-600
                           text-white text-sm font-black
                           shadow-xl shadow-emerald-600/20
                           disabled:opacity-50
                           flex items-center justify-center gap-2
                           transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <><Loader2 size={15} className="animate-spin" /> Opening checkout…</>
                ) : (
                  <>Pay ₹{amount.toFixed(2)} <ArrowRight size={15} /></>
                )}
              </button>
            )}
          </div>
        )}

        {state.step === "confirming" && (
          <div className="mt-6 p-5 rounded-2xl bg-surface border border-border text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)] mx-auto mb-3" />
            <p className="text-sm font-bold">Confirming your booking…</p>
            <p className="text-xs text-muted-foreground mt-1">
              This usually takes a few seconds.
            </p>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-8 flex items-center justify-center gap-1.5">
          <ShieldCheck size={11} /> Every payment is escrow-protected
        </p>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: "duration", label: "Service" },
    { id: "slot", label: "Time" },
    { id: "pay", label: "Pay" },
  ];
  const activeIdx = current === "confirming" || current === "done"
    ? 2
    : steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              i <= activeIdx
                ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-lg"
                : "bg-surface-raised border border-border text-muted-foreground"
            }`}>
              {i < activeIdx ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-[9px] uppercase tracking-widest font-black ${
              i <= activeIdx ? "text-foreground" : "text-muted-foreground"
            }`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 rounded-full mb-5 transition-colors ${
              i < activeIdx ? "bg-[var(--color-primary)]" : "bg-surface-raised"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium truncate ml-2">{value}</span>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
