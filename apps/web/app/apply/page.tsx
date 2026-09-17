"use client";

import { useEffect, useState } from "react";
import { submitConsultantApplication, checkApplicationStatus } from "@/actions/consultant";
import {
  Sparkles, Send, Loader2, Clock, ShieldCheck, ArrowRight,
  Briefcase, Check, AlertCircle, Star, IndianRupee, Users,
  MessageCircle, Video, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { id: "Vedic Astrology", icon: "🔮", desc: "Jyotish, Dasha cycles, Kundali analysis" },
  { id: "Tarot Reading",   icon: "🃏", desc: "Rider-Waite, Oracle, Lenormand" },
  { id: "Numerology",      icon: "🔢", desc: "Life Path, Chaldean, Pythagorean" },
  { id: "Vastu Shastra",   icon: "🏛️", desc: "Spatial alignment, Feng Shui principles" },
];

export default function ApplyPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(50);

  const bioOk = bio.trim().length >= 20;

  useEffect(() => {
    (async () => {
      const r = await checkApplicationStatus();
      setStatus(r.status);
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bioOk) {
      setError("Bio must be at least 20 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append("expertise", expertise);
    fd.append("bio", bio);
    fd.append("perMinuteRate", String(rate));

    const res = await submitConsultantApplication(fd);
    if (res.success) setStatus("pending");
    else setError(res.error || "Submission failed.");
    setSubmitting(false);
  };

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  // ─── Pending state ───────────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full"
        >
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black mb-3 text-white">Application Under Review</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your profile has been transmitted. Our admin team will verify your credentials within 24 hours.
          </p>

          <div className="mt-7 p-5 rounded-2xl bg-slate-950/50 border border-white/5 text-left space-y-2.5">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check size={11} className="text-emerald-400" />
              </div>
              Profile created
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check size={11} className="text-emerald-400" />
              </div>
              Wallet initialized
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                <Clock size={11} />
              </div>
              Awaiting verification
            </div>
          </div>

          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl mt-8 font-bold transition-all text-sm text-white"
          >
            Return to Explore
          </Link>
        </motion.div>
      </div>
    );
  }

  // ─── Verified state ──────────────────────────────────────────────────────
  if (status === "verified" || status === "approved") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black mb-3 text-white">You are a Consultant</h1>
          <p className="text-slate-400 text-sm">Your profile is verified and live on the platform.</p>

          <Link
            href="/consultant/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white rounded-2xl mt-8 font-bold transition-all text-sm shadow-xl shadow-emerald-500/20"
          >
            Enter Command Center <ArrowRight size={15} />
          </Link>
        </motion.div>
      </div>
    );
  }

  // ─── Wizard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 relative z-10">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
            <Briefcase size={13} /> Consultant Application
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Join the Zeal network
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-2xl">
            Complete the 3 steps below. Our team will verify your credentials within 24 hours.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8 max-w-2xl">
          {[
            { n: 1, label: "Discipline" },
            { n: 2, label: "Rate" },
            { n: 3, label: "Bio" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                step >= s.n
                  ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                  : "bg-slate-900/60 border border-white/5 text-slate-500"
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step > s.n
                    ? "bg-indigo-500 text-white"
                    : step === s.n
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  {step > s.n ? <Check size={10} /> : s.n}
                </div>
                {s.label}
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all ${
                  step > s.n ? "bg-indigo-500" : "bg-slate-800"
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── Left: form ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold flex items-center gap-2.5">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-xl font-black text-white mb-1">
                      Your primary discipline
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Select the practice you specialize in.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                      {CATEGORIES.map((c) => {
                        const selected = expertise === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setExpertise(c.id)}
                            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                              selected
                                ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_-10px_rgba(99,102,241,0.5)]"
                                : "border-white/5 bg-slate-950 hover:border-white/20 hover:bg-slate-950/60"
                            }`}
                          >
                            {selected && (
                              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                <Check size={11} className="text-white" />
                              </div>
                            )}
                            <div className="text-2xl mb-2">{c.icon}</div>
                            <h3 className="font-bold text-slate-100 text-sm mb-0.5">{c.id}</h3>
                            <p className="text-[11px] text-slate-500 leading-snug">{c.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={!expertise}
                      onClick={() => setStep(2)}
                      className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight size={15} />
                    </button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-xl font-black text-white mb-1">
                      Set your rate
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Choose your per-minute consultation charge (₹10 – ₹500).
                    </p>

                    <div className="p-8 bg-slate-950/60 rounded-3xl border border-white/5 mb-6">
                      <div className="text-center mb-6">
                        <div className="flex items-center justify-center gap-2 text-white mb-2">
                          <IndianRupee className="w-7 h-7 text-emerald-400" />
                          <span className="text-5xl font-black font-mono">{rate}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          per minute
                        </p>
                      </div>

                      <input
                        type="range"
                        min={10}
                        max={500}
                        step={10}
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                        <span>₹10</span>
                        <span>₹500</span>
                      </div>

                      <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                            Your cut (90%)
                          </p>
                          <p className="text-lg font-black font-mono text-emerald-400">
                            ₹{Math.round(rate * 0.9)}/min
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                            Platform fee (10%)
                          </p>
                          <p className="text-lg font-black font-mono text-slate-400">
                            ₹{Math.round(rate * 0.1)}/min
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-6 py-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl font-bold text-sm transition-all text-white flex items-center gap-1.5"
                      >
                        <ChevronLeft size={15} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="btn-3d flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                      >
                        Continue <ArrowRight size={15} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.form
                    key="step3"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-xl font-black text-white mb-1">
                      Professional bio
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Describe your lineage, certifications, and philosophy.
                    </p>

                    <textarea
                      required
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={8}
                      placeholder="I have practiced Vedic astrology for over 15 years, trained under..."
                      className={`w-full p-5 bg-slate-950 border rounded-2xl text-sm focus:border-indigo-500 outline-none text-slate-200 resize-none custom-scrollbar transition-colors ${
                        bio.length > 0 && !bioOk ? "border-rose-500/40" : "border-white/10"
                      }`}
                    />

                    <div className="flex items-center justify-between mt-2 mb-6 text-[11px]">
                      <span className={bioOk ? "text-emerald-400 font-medium" : "text-slate-500"}>
                        {bioOk
                          ? "✓ Bio meets minimum length"
                          : `Minimum 20 characters (${bio.trim().length}/20)`}
                      </span>
                      <span className="text-slate-600 font-mono">{bio.length}/1000</span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={submitting}
                        className="px-6 py-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 text-white flex items-center gap-1.5"
                      >
                        <ChevronLeft size={15} /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={!bioOk || submitting}
                        className="btn-3d flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <><Loader2 size={17} className="animate-spin" /> Transmitting...</>
                        ) : (
                          <>Transmit Application <Send size={15} /></>
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ─── Right: live preview card ─────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                Live profile preview
              </p>

              <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-2xl">
                {/* Cover */}
                <div className="h-20 rounded-2xl bg-gradient-to-tr from-indigo-600/40 via-purple-600/30 to-indigo-600/40 -mx-1 -mt-1 mb-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(157,125,197,0.4),transparent_60%)]" />
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-4 border-slate-900 flex items-center justify-center text-white font-black text-lg -mt-8">
                    {bio.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-white text-sm truncate">
                      Your Name
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      @you · {expertise || "Discipline"}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 py-4 border-y border-white/5 mb-4">
                  <div className="text-center">
                    <p className="text-xs font-black text-white font-mono">0</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-amber-400 flex items-center justify-center gap-0.5">
                      <Star size={10} className="fill-amber-400" /> 5.0
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-indigo-400 font-mono">₹{rate}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Per min</p>
                  </div>
                </div>

                {/* Bio preview */}
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-4 mb-4 min-h-[3rem]">
                  {bio.trim() || "Your bio will appear here as you type..."}
                </p>

                {/* Service chips */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {[
                    { Icon: MessageCircle, label: "Chat" },
                    { Icon: Video, label: "Video" },
                  ].map(({ Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold"
                    >
                      <Icon size={10} /> {label}
                    </span>
                  ))}
                </div>

                {/* CTA preview */}
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs opacity-60 cursor-not-allowed"
                >
                  Consult Now
                </button>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Users size={10} /> 0 clients
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={10} /> Pending
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 text-center mt-3 leading-relaxed">
                This is how seekers will see your profile once verified.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
