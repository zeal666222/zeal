"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Check, ChevronLeft, ChevronRight, Plus, Trash2,
  IndianRupee, Upload, Camera, AlertCircle,
} from "lucide-react";

const CATEGORIES = [
  { id: "ASTROLOGER",       icon: "🔮", label: "Vedic Astrology", desc: "Jyotish, Dasha, Kundali" },
  { id: "TAROT",            icon: "🃏", label: "Tarot Reading",   desc: "Rider-Waite, Oracle" },
  { id: "NUMEROLOGIST",     icon: "🔢", label: "Numerology",      desc: "Life Path, Chaldean" },
  { id: "VASTU",            icon: "🏛️", label: "Vastu Shastra",   desc: "Spatial alignment" },
  { id: "PSYCHOLOGIST",     icon: "🧠", label: "Psychology",      desc: "CBT, therapy" },
  { id: "LIFE_COACH",       icon: "🎯", label: "Life Coaching",   desc: "Career & life" },
  { id: "HEALER",           icon: "✨", label: "Energy Healing",  desc: "Reiki, pranic" },
  { id: "SPIRITUAL_GUIDE",  icon: "🕉️", label: "Spiritual Guide", desc: "Meditation, guidance" },
];

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];
type Block = { start: string; end: string };
type Availability = Record<Day, Block[]>;

const DEFAULT_AVAIL: Availability = {
  monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
};

interface ConsultantState {
  category: string | null;
  specialties: string[] | null;
  bio: string | null;
  perMinuteRate: number | null;
  languages: string[] | null;
  availability: unknown;
}

export default function ApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [category, setCategory] = useState<string>("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [rate, setRate] = useState(50);
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [langInput, setLangInput] = useState("");
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAIL);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consultant/pulse", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const c: ConsultantState | undefined = data?.consultant;
          if (c) {
            if (c.category) setCategory(c.category);
            if (c.specialties?.length) setSpecialties(c.specialties);
            if (c.bio) setBio(c.bio);
            if (c.perMinuteRate) setRate(c.perMinuteRate);
            if (c.languages?.length) setLanguages(c.languages);
            if (c.availability && typeof c.availability === "object") {
              setAvailability({ ...DEFAULT_AVAIL, ...(c.availability as Availability) });
            }
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async (patch: Record<string, unknown>): Promise<{ ok: boolean; isLive?: boolean; error?: string }> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/consultant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setSaving(false);
      return { ok: true, isLive: data?.isLive };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
      return { ok: false, error: String(err) };
    }
  };

  const finish = async () => {
    // Final save with full state
    const res = await save({
      category, specialties, bio, perMinuteRate: rate, languages, availability,
    });
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/consultant/dashboard"), 1500);
    }
  };

  const uploadAvatar = async (): Promise<void> => {
    if (!avatarFile) return;
    const fd = new FormData();
    fd.append("avatar", avatarFile);
    try {
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
  };

  const addSpecialty = () => {
    const t = specialtyInput.trim();
    if (t && !specialties.includes(t)) setSpecialties([...specialties, t]);
    setSpecialtyInput("");
  };
  const addLang = () => {
    const t = langInput.trim();
    if (t && !languages.includes(t)) setLanguages([...languages, t]);
    setLangInput("");
  };

  const addBlock = (d: Day) =>
    setAvailability({ ...availability, [d]: [...availability[d], { start: "09:00", end: "12:00" }] });
  const rmBlock = (d: Day, i: number) =>
    setAvailability({ ...availability, [d]: availability[d].filter((_, idx) => idx !== i) });
  const updBlock = (d: Day, i: number, key: "start" | "end", v: string) => {
    const next = availability[d].map((b, idx) => (idx === i ? { ...b, [key]: v } : b));
    setAvailability({ ...availability, [d]: next });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <Check size={36} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">You're live</h1>
          <p className="text-slate-400 text-sm">Routing to your Command Center…</p>
        </div>
      </div>
    );
  }

  const totalSteps = 5;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-3">
          <Sparkles size={13} /> Profile Builder
        </div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Complete your profile</h1>
        <p className="text-sm text-slate-400 mt-1">Step {step} of {totalSteps} — save any time, resume later.</p>
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex-1 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
              step >= n ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-slate-800 text-slate-500"
            }`}>
              {step > n ? <Check size={13} /> : n}
            </div>
            {n < totalSteps && (
              <div className={`flex-1 h-0.5 rounded-full transition-all ${step > n ? "bg-indigo-500" : "bg-slate-800"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold flex items-center gap-2.5">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Discipline & Specialties</h2>
              <p className="text-sm text-slate-400 mb-6">Choose your primary practice and list specializations.</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      category === c.id ? "border-indigo-500 bg-indigo-500/10" : "border-white/5 bg-slate-950 hover:border-white/20"
                    }`}>
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <p className="font-bold text-slate-100 text-xs">{c.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{c.desc}</p>
                  </button>
                ))}
              </div>

              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Specialties</label>
              <div className="flex gap-2 mb-3">
                <input type="text" value={specialtyInput} onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpecialty())}
                  placeholder="e.g., KP Astrology"
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                <button type="button" onClick={addSpecialty}
                  className="px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                    {s}
                    <button onClick={() => setSpecialties(specialties.filter((x) => x !== s))} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Set your rate</h2>
              <p className="text-sm text-slate-400 mb-6">Per-minute consultation charge (₹10 – ₹500).</p>

              <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5 mb-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <IndianRupee className="w-8 h-8 text-emerald-400" />
                  <span className="text-5xl font-black font-mono text-white">{rate}</span>
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-6">per minute</p>
                <input type="range" min={10} max={500} step={10} value={rate}
                  onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-indigo-500" />
                <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                  <span>₹10</span><span>₹500</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Your cut (90%)</p>
                    <p className="text-lg font-black font-mono text-emerald-400">₹{Math.round(rate * 0.9)}/min</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Platform (10%)</p>
                    <p className="text-lg font-black font-mono text-slate-400">₹{Math.round(rate * 0.1)}/min</p>
                  </div>
                </div>
              </div>

              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Languages</label>
              <div className="flex gap-2 mb-3">
                <input type="text" value={langInput} onChange={(e) => setLangInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLang())}
                  placeholder="e.g., Hindi"
                  className="flex-1 px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                <button type="button" onClick={addLang}
                  className="px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-bold">
                    {l}
                    <button onClick={() => setLanguages(languages.filter((x) => x !== l))} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Professional bio</h2>
              <p className="text-sm text-slate-400 mb-6">Describe your lineage, certifications, and approach (min 20 chars).</p>

              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={8}
                placeholder="I have practiced Vedic astrology for over 15 years, trained under…"
                className={`w-full p-5 bg-slate-950 border rounded-2xl text-sm outline-none text-slate-200 resize-none transition-colors ${
                  bio.length > 0 && bio.trim().length < 20 ? "border-rose-500/40" : "border-white/10 focus:border-indigo-500"
                }`} />
              <div className="flex justify-between text-[11px] mt-2">
                <span className={bio.trim().length >= 20 ? "text-emerald-400 font-medium" : "text-slate-500"}>
                  {bio.trim().length >= 20 ? "✓ Bio meets minimum" : `Minimum 20 characters (${bio.trim().length}/20)`}
                </span>
                <span className="text-slate-600 font-mono">{bio.length}/1000</span>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Weekly availability</h2>
              <p className="text-sm text-slate-400 mb-6">When can seekers book you? Add time blocks per day.</p>

              <div className="space-y-3">
                {DAYS.map((d) => (
                  <div key={d} className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-white capitalize">{d}</p>
                      <button type="button" onClick={() => addBlock(d)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20">
                        <Plus size={11} /> Add
                      </button>
                    </div>
                    {availability[d].length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No availability</p>
                    ) : (
                      <div className="space-y-2">
                        {availability[d].map((b, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="time" value={b.start} onChange={(e) => updBlock(d, i, "start", e.target.value)}
                              className="flex-1 px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-sm text-white font-mono" />
                            <span className="text-slate-500 text-xs">to</span>
                            <input type="time" value={b.end} onChange={(e) => updBlock(d, i, "end", e.target.value)}
                              className="flex-1 px-3 py-2 bg-slate-900 border border-white/5 rounded-lg text-sm text-white font-mono" />
                            <button type="button" onClick={() => rmBlock(d, i)}
                              className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-black text-white mb-1">Profile photo</h2>
              <p className="text-sm text-slate-400 mb-6">A clear headshot builds trust with seekers.</p>

              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden border-4 border-slate-900">
                  {avatarFile ? (
                    <img src={URL.createObjectURL(avatarFile)} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-10 h-10 text-white/50" />
                  )}
                </div>
                <label className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold cursor-pointer hover:bg-white/10 inline-flex items-center gap-2">
                  <Upload size={14} /> {avatarFile ? "Change photo" : "Choose photo"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                </label>
                <p className="text-[11px] text-slate-500 max-w-xs text-center">
                  Optional. You can add this later from Settings.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} disabled={saving}
              className="px-5 py-3.5 rounded-2xl bg-slate-900/60 border border-white/5 text-white text-sm font-bold hover:bg-slate-900 flex items-center gap-1.5 disabled:opacity-50">
              <ChevronLeft size={15} /> Back
            </button>
          )}

          {step < totalSteps ? (
            <button type="button"
              disabled={saving || (step === 1 && !category)}
              onClick={async () => {
                // Persist current step before advancing
                let patch: Record<string, unknown> = {};
                if (step === 1) patch = { category, specialties };
                if (step === 2) patch = { perMinuteRate: rate, languages };
                if (step === 3) patch = { bio };
                if (step === 4) patch = { availability };
                if (Object.keys(patch).length > 0) {
                  const r = await save(patch);
                  if (!r.ok) return;
                }
                setStep(step + 1);
              }}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <>Continue <ChevronRight size={15} /></>}
            </button>
          ) : (
            <button type="button" onClick={async () => { if (avatarFile) await uploadAvatar(); await finish(); }}
              disabled={saving || !category || bio.trim().length < 20}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Finalizing…</> : <><Check size={15} /> Go Live</>}
            </button>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link href="/consultant/dashboard" className="text-xs text-slate-500 hover:text-slate-300">
          Skip for now — finish later
        </Link>
      </div>
    </div>
  );
}
