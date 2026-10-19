"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Onboarding Wizard (4-step)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Calendar, Clock, MapPin } from "lucide-react";
import { createClient } from "@zeal/database";
import { LocationAutocomplete, type PlaceSuggestionData } from "@zeal/ui";

const INTERESTS = [
  "Astrology", "Tarot", "Numerology", "Palmistry", "Therapy",
  "Meditation", "Yoga", "Coaching", "Energy Healing", "Dreams",
  "Relationships", "Career", "Wellness", "Spirituality",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [tobUnknown, setTobUnknown] = useState(false);
  const [pob, setPob] = useState("");
  const [pobCoords, setPobCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [goal, setGoal] = useState("");

  const canNext = () => {
    switch (step) {
      case 1: return displayName.trim().length >= 2;
      case 2: return dob.length >= 8;
      case 3: return picked.length >= 1;
      default: return true;
    }
  };

  const next = () => canNext() && setStep(step + 1);

  // In-flight ref guard: disabled-state rendering is async, so also block
  // rapid double-clicks on Finish from firing two saves.
  const savingRef = useRef(false);
  const finish = async () => {
    if (savingRef.current) return;
    if (!canNext()) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: err } = await supabase
        .from("User")
        .update({
          name: displayName.trim(),
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (err) throw err;

      await fetch("/api/profile/birth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: displayName.trim(),
          dateOfBirth: dob,
          timeOfBirth: tobUnknown ? null : (tob || null),
          placeOfBirth: pob.trim() || null,
          latitude: pobCoords?.lat ?? null,
          longitude: pobCoords?.lng ?? null,
        }),
      }).catch(() => {});

      try {
        await supabase.from("UserPreferences").upsert({
          userId: user.id,
          interests: picked,
          goals: goal ? [goal] : [],
        });
      } catch { /* table optional */ }

      router.push("/explore");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
      savingRef.current = false; // allow retry after failure
    }
  };

  const toggle = (interest: string) => {
    setPicked((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= n
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-surface text-muted-foreground border border-border"
              }`}>
                {step > n ? <Check size={14} /> : n}
              </div>
              {n < 4 && (
                <div className={`w-8 h-0.5 ${step > n ? "bg-purple-500" : "bg-surface-sunken"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-8">
            {step === 1 && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
                  <Sparkles size={12} /> Step 1 of 4
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">What should we call you?</h2>
                <p className="text-sm text-muted-foreground mb-6">Your consultants will see this name.</p>
                <input type="text" value={displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                  placeholder="Your name" autoFocus aria-label="Display name"
                  className="w-full px-4 py-3.5 bg-background border border-border rounded-2xl text-sm text-foreground outline-none focus:border-purple-500" />
              </>
            )}

            {step === 2 && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
                  <Calendar size={12} /> Step 2 of 4
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">Your birth chart details</h2>
                <p className="text-sm text-muted-foreground mb-6">Needed for accurate readings — never shared without your permission.</p>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1.5">
                      <Calendar size={12} /> Date of Birth
                    </label>
                    <input type="date" value={dob}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDob(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-sm text-foreground outline-none focus:border-purple-500" />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1.5">
                      <Clock size={12} /> Time of Birth
                    </label>
                    <div className="flex items-center gap-3">
                      <input type="time" value={tob}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTob(e.target.value)}
                        disabled={tobUnknown}
                        className="flex-1 px-4 py-3 bg-background border border-border rounded-2xl text-sm text-foreground outline-none focus:border-purple-500 disabled:opacity-40" />
                      <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer whitespace-nowrap">
                        <input type="checkbox" checked={tobUnknown}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setTobUnknown(e.target.checked);
                            if (e.target.checked) setTob("");
                          }}
                          className="rounded border-border" />
                        I don&apos;t know
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1.5">
                      <MapPin size={12} /> Place of Birth <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <LocationAutocomplete
                      id="onboarding-pob"
                      value={pob}
                      onChange={(v) => { setPob(v); if (!v.trim()) setPobCoords(null); }}
                      onSelect={(p: PlaceSuggestionData) => setPobCoords({ lat: p.lat, lng: p.lng })}
                      placeholder="City, Country"
                      recentStorageKey="zeal:recent-birth-places"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
                  <Sparkles size={12} /> Step 3 of 4
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">What are you interested in?</h2>
                <p className="text-sm text-muted-foreground mb-6">Pick at least one — your feed will personalize accordingly.</p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((i) => (
                    <button key={i} type="button" onClick={() => toggle(i)}
                      aria-pressed={picked.includes(i)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${
                        picked.includes(i)
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                          : "bg-background border border-border text-muted-foreground hover:border-purple-500/40"
                      }`}>
                      {i}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
                  <Sparkles size={12} /> Step 4 of 4
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">What brought you here?</h2>
                <p className="text-sm text-muted-foreground mb-6">Optional — it helps us find the right guide for you.</p>
                <textarea value={goal}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGoal(e.target.value)}
                  rows={3} maxLength={500} aria-label="Your goal"
                  placeholder="e.g. I need clarity about a career change, or want to understand my next step in life…"
                  className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-sm text-foreground resize-none outline-none focus:border-purple-500" />
              </>
            )}

            {error && (
              <div role="alert" className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-6">
          {step > 1 && (
            <motion.button
              type="button"
              onClick={() => !saving && setStep(step - 1)}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1 px-5 py-3 rounded-2xl bg-surface border border-border text-muted-foreground font-bold text-sm hover:text-foreground transition-colors disabled:opacity-50"
            >
              <ArrowLeft size={14} /> Back
            </motion.button>
          )}
          {step < 4 ? (
            <motion.button
              type="button"
              onClick={next}
              disabled={!canNext()}
              whileHover={canNext() ? { scale: 1.01 } : undefined}
              whileTap={canNext() ? { scale: 0.98 } : undefined}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight size={14} />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => void finish()}
              disabled={saving}
              whileHover={!saving ? { scale: 1.01 } : undefined}
              whileTap={!saving ? { scale: 0.98 } : undefined}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-xl disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Begin Your Journey</>}
            </motion.button>
          )}
        </div>
        {step < 4 && !canNext() && (
          <p className="mt-2 text-[11px] text-muted-foreground text-right">
            {step === 1 && "Name must be at least 2 letters."}
            {step === 2 && "Date of birth is required."}
            {step === 3 && "Pick at least one interest."}
          </p>
        )}
      </motion.div>
    </div>
  );
}
