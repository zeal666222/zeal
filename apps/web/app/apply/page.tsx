"use client";

import { useEffect, useState } from "react";
import { submitConsultantApplication, checkApplicationStatus } from "@/actions/consultant";
import {
  Sparkles, Send, Loader2, BookOpen, Clock, ShieldCheck,
  ArrowRight, Briefcase, Check, AlertCircle, Compass, Star,
} from "lucide-react";
import Link from "next/link";

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
    if (!bioOk) { setError("Bio must be at least 20 characters."); return; }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="min-h-screen-app bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black mb-4 text-white">Application Under Review</h1>
          <p className="text-slate-400">
            Your profile has been transmitted. Our admin team will verify your credentials within 24 hours.
          </p>
          <div className="mt-6 p-4 rounded-2xl bg-slate-950/50 border border-white/5 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-300">
              <Check size={14} className="text-emerald-400" /> Profile created
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Check size={14} className="text-emerald-400" /> Wallet initialized
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Clock size={14} /> Awaiting verification
            </div>
          </div>
          <Link href="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl mt-8 font-bold transition-all text-sm text-white">
            Return to Explore
          </Link>
        </div>
      </div>
    );
  }

  if (status === "verified" || status === "approved") {
    return (
      <div className="min-h-screen-app bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black mb-4 text-white">You are a Consultant</h1>
          <p className="text-slate-400">Your profile is verified and live.</p>
          <Link href="/consultant/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white rounded-xl mt-8 font-bold transition-all text-sm shadow-xl shadow-emerald-500/20">
            Enter Command Center <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50 flex items-center justify-center p-4 sm:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${
                  step >= n
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  {step > n ? <Check size={14} /> : n}
                </div>
                {n < 3 && (
                  <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${step > n ? "bg-indigo-500" : "bg-slate-800"}`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center flex items-center justify-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                  <Briefcase size={14} /> Phase 1 · Domain
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Your Discipline</h1>
                <p className="text-slate-400 text-sm mt-2">Select your primary metaphysical practice.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setExpertise(c.id)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all ${
                      expertise === c.id
                        ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                        : "border-white/5 bg-slate-950 hover:border-white/20"
                    }`}
                  >
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <h3 className="font-bold text-slate-100 text-sm mb-0.5">{c.id}</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">{c.desc}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!expertise}
                className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                  <Star size={14} /> Phase 2 · Rate
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Consultation Rate</h1>
                <p className="text-slate-400 text-sm mt-2">Set your per-minute charge (₹10 – ₹500).</p>
              </div>

              <div className="p-8 bg-slate-950/50 rounded-3xl border border-white/5 mb-8 text-center">
                <p className="text-5xl font-black font-mono text-white mb-3">₹{rate}</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-6">per minute</p>
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
                  <span>₹10</span><span>₹500</span>
                </div>
                <div className="mt-6 pt-6 border-t border-white/5">
                  <p className="text-xs text-slate-400">
                    You earn <strong className="text-emerald-400">{Math.round(rate * 0.9)}₹/min</strong> after the 10% platform fee.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all text-white">Back</button>
                <button onClick={() => setStep(3)} className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                  <Sparkles size={14} /> Final · Bio
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Professional Bio</h1>
                <p className="text-slate-400 text-sm mt-2">Describe your lineage, certifications, and philosophy.</p>
              </div>

              <form onSubmit={handleSubmit}>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={6}
                  placeholder="I have practiced Vedic astrology for over 15 years, trained under..."
                  className={`w-full p-5 bg-slate-950 border rounded-2xl text-sm focus:border-emerald-500 outline-none text-slate-200 resize-none custom-scrollbar ${
                    bio.length > 0 && !bioOk ? "border-rose-500/40" : "border-white/10"
                  }`}
                />
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className={bioOk ? "text-emerald-400 font-medium" : "text-slate-500 font-medium"}>
                    {bioOk ? "✓ Bio meets minimum length" : `Minimum 20 characters (${bio.trim().length}/20)`}
                  </span>
                  <span className="text-slate-600 font-mono">{bio.length}/1000</span>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!bioOk || submitting}
                    className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <>Transmit Application <Send size={16} /></>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          Need help?{" "}
          <Link href="/explore" className="text-purple-400 hover:text-purple-300 font-bold">
            Return to Explore
          </Link>
        </p>
      </div>
    </div>
  );
}
