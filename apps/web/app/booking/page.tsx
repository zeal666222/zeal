"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Booking wizard — consultant → duration → slot → confirm
// ═══════════════════════════════════════════════════════════════════════════════
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Calendar, CheckCircle2, Clock, Loader2,
  ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { formatCurrency } from "@zeal/utils";

interface ConsultantSummary {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  category: string;
  perMinuteRate: number;
  rating: number;
}

const DURATIONS = [15, 30, 45, 60] as const;
type Duration = (typeof DURATIONS)[number];

function friendlyError(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).toLowerCase();
  if (s.includes("unauthorized") || s.includes("401")) {
    return "Please sign in to complete your booking.";
  }
  if (s.includes("insufficient") || s.includes("balance")) {
    return "Your wallet balance is too low. Please top up to continue.";
  }
  if (s.includes("conflict") || s.includes("409") || s.includes("not available")) {
    return "That slot was just taken. Please pick a different time.";
  }
  if (s.includes("rate limit") || s.includes("429")) {
    return "Slow down for a moment. Please try again shortly.";
  }
  if (s.includes("network") || s.includes("fetch")) {
    return "Connection hiccup. Please check your internet.";
  }
  return "Something didn't go through. Please try again.";
}

function BookingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const consultantId = params.get("consultantId") || "";

  const [consultant, setConsultant] = useState<ConsultantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState<Duration>(30);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Load consultant summary
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
        const data = await res.json();
        if (!cancelled) setConsultant(data.consultant || data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load consultant");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [consultantId]);

  const total = useMemo(() => {
    if (!consultant) return 0;
    return (duration / 60) * consultant.perMinuteRate;
  }, [consultant, duration]);

  const canConfirm = Boolean(consultant && selectedSlot && !submitting);

  const confirm = async () => {
    if (!consultant || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantId: consultant.id,
          scheduledAt: selectedSlot,
          durationMinutes: duration,
          amount: total,
          platformFee: total * 0.1,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      setDone(true);
      setTimeout(() => router.push("/bookings"), 1500);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : "Booking failed"));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Booking Confirmed</h2>
          <p className="text-sm text-slate-400">
            Redirecting to your bookings…
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-purple-400 mb-6">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-widest mb-4">
          <Calendar size={14} /> Book Consultation
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
          Schedule your session
        </h1>
        <p className="text-slate-400 mb-8">Pick a duration and slot. Payment is held in escrow until the session completes.</p>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Consultant card */}
        {consultant && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-purple-500/20 overflow-hidden flex items-center justify-center">
              {consultant.avatar ? (
                <img src={consultant.avatar} alt={consultant.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-purple-400 font-black text-lg">
                  {consultant.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{consultant.name}</p>
              <p className="text-xs text-slate-400 capitalize">{consultant.category.toLowerCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Rate</p>
              <p className="text-purple-400 font-bold font-mono">
                {formatCurrency(consultant.perMinuteRate)}/min
              </p>
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="mb-6">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button key={d} onClick={() => setDuration(d)}
                className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                  duration === d
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                    : "bg-slate-900/60 border border-white/10 text-slate-300 hover:border-purple-500/40"
                }`}>
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Slot picker */}
        {consultant && (
          <div className="mb-6">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
              Pick a time
            </label>
            <SlotPicker
              consultantId={consultant.id}
              durationMinutes={duration}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
            />
          </div>
        )}

        {/* Summary */}
        {consultant && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Service</span>
              <span className="text-white font-medium">Live consultation</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Duration</span>
              <span className="text-white font-medium">{duration} minutes</span>
            </div>
            {selectedSlot && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">When</span>
                <span className="text-white font-medium">
                  {new Date(selectedSlot).toLocaleString("en-IN", {
                    weekday: "short", day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            <div className="pt-3 mt-3 border-t border-white/5 flex justify-between font-bold text-lg">
              <span className="text-white">Total</span>
              <span className="text-purple-400">{formatCurrency(total)}</span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
              <ShieldCheck size={12} /> Held in escrow until session completes
            </p>
          </div>
        )}

        <button onClick={confirm} disabled={!canConfirm}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-purple-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Confirming…</>
          ) : (
            <>Confirm & Pay {formatCurrency(total)} <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
