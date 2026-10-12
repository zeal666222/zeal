"use client";

import {useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {
  ArrowRight, Calendar, Clock, Loader2, MapPin, Orbit, Sparkles,
  User, RotateCcw, Star, Shield, Download, Share2,
} from "lucide-react";

export default function KundaliPage() {
  const [formData, setFormData] = useState({name: "", dob: "", tob: "", pob: ""});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai?task=kundali", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as {error?: string})?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {analysis?: string};
      setResult(data.analysis ?? "Kundali computation complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError("");
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`Janam Kundali for ${formData.name}\n${formData.dob} · ${formData.tob} · ${formData.pob}\n\n${result}`);
    } catch { /* clipboard may not be available */ }
  };

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[var(--color-primary)]/[0.06] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-amber-500/[0.05] blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <motion.div initial={{opacity: 0, y: 16}} animate={{opacity: 1, y: 0}} transition={{type: "spring", stiffness: 200, damping: 20}}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Orbit size={12} /> Vedic Ephemeris Engine
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
              Janam Kundali
            </h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
              Generate your precise Vedic birth chart with planetary positions, dashas, and yogas.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{opacity: 0, y: 16}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -16}}
            >
              <form
                onSubmit={handleSubmit}
                className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 space-y-6"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.03] blur-3xl rounded-full pointer-events-none" />

                <div className="relative space-y-6">
                  {error && (
                    <motion.div
                      initial={{opacity: 0, y: -8}}
                      animate={{opacity: 1, y: 0}}
                      className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, name: e.target.value})}
                        placeholder="Enter your full name"
                        className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="date"
                          required
                          value={formData.dob}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, dob: e.target.value})}
                          className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Time of Birth</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="time"
                          required
                          value={formData.tob}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, tob: e.target.value})}
                          className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Place of Birth</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        value={formData.pob}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, pob: e.target.value})}
                        placeholder="City, Country"
                        className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                      />
                    </div>
                  </div>

                  {/* Quick fill hint */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                    <Sparkles size={13} className="text-amber-400 shrink-0" />
                    <p className="text-xs text-muted-foreground flex-1">
                      Enter exact birth data for the most accurate Vedic chart computation.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-[var(--color-primary)]/20 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" size={18} /> Computing planetary positions...</>
                    ) : (
                      <>Compute Janam Kundali <ArrowRight size={18} /></>
                    )}
                  </button>

                  {loading && (
                    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="space-y-2">
                      <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]"
                          initial={{width: "0%"}}
                          animate={{width: "85%"}}
                          transition={{duration: 12, ease: "easeOut"}}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Computing ephemeris, calculating houses, determining nakshatras...
                      </p>
                    </motion.div>
                  )}
                </div>
              </form>

              {/* How it works */}
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.3}}
                className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                {[
                  {icon: Orbit, title: "Chart Computation", desc: "Deterministic Vedic engine calculates exact planetary positions and houses."},
                  {icon: Shield, title: "Classical Rules", desc: "BPHS, Phaladeepika, and Jataka Parijata rules applied to your chart."},
                  {icon: Sparkles, title: "AI Synthesis", desc: "LLM generates comprehensive natural language interpretation."},
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{opacity: 0, y: 12}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.4 + i * 0.1}}
                    className="p-4 rounded-2xl bg-surface/60 border border-border/40"
                  >
                    <step.icon size={16} className="text-[var(--color-primary)] mb-2" />
                    <p className="text-xs font-bold text-foreground">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{step.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -16}}
              transition={{type: "spring", stiffness: 180, damping: 22}}
              className="space-y-6"
            >
              {/* Meta info */}
              <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
                <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
                  <User size={9} /> {formData.name}
                </span>
                <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
                  <Calendar size={9} /> {formData.dob}
                </span>
                <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
                  <Clock size={9} /> {formData.tob}
                </span>
                <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
                  <MapPin size={9} /> {formData.pob}
                </span>
              </div>

              {/* Main result */}
              <div className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.04] blur-3xl rounded-full pointer-events-none" />
                <div className="relative">
                  <h2 className="text-2xl font-black text-foreground mb-2">
                    {formData.name}&apos;s Janam Kundali
                  </h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Vedic birth chart analysis
                  </p>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-[15px]">
                    {result}
                  </p>

                  <div className="mt-6 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Sparkles size={9} className="text-[var(--color-primary)]" /> AI analysis</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Orbit size={9} /> Vedic system</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleShare}
                        className="px-3 py-1.5 bg-surface-raised border border-border/60 rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1"
                      >
                        <Share2 size={10} /> Copy
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-4 py-1.5 bg-surface-raised border border-border/60 rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1"
                      >
                        <RotateCcw size={10} /> New Reading
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Free badge */}
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.5}}
          className="text-center mt-10"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> 100% Free · No sign-up required
          </span>
        </motion.div>
      </div>
    </div>
  );
}
