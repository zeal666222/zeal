"use client";

// Janam Kundali — uses unified /api/ai?task=kundali

import {useState} from "react";
import {motion} from "framer-motion";
import { ArrowRight, Calendar, Clock, Loader2, MapPin, Orbit, Sparkles, User } from "lucide-react";

export default function KundaliPage() {
  const [formData, setFormData] = useState({ name: "", dob: "", tob: "", pob: "" });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { analysis?: string };
      setResult(data.analysis ?? "Kundali computation complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app bg-background text-foreground py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] font-medium text-xs uppercase tracking-widest mb-6">
            <Orbit size={14} /> Vedic Ephemeris
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            Janam Kundali
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate your precise Vedic birth chart analysis.
          </p>
        </div>

        {!result ? (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6"
          >
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-2xl focus:border-[var(--color-primary)] outline-none text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type="date"
                    required
                    value={formData.dob}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-2xl focus:border-[var(--color-primary)] outline-none text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Time of Birth
                </label>
                <div className="relative">
                  <Clock className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type="time"
                    required
                    value={formData.tob}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tob: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-2xl focus:border-[var(--color-primary)] outline-none text-foreground"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Place of Birth
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={formData.pob}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, pob: e.target.value })}
                  placeholder="City, Country"
                  className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-2xl focus:border-[var(--color-primary)] outline-none text-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-[var(--color-primary-hover)]/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={20} /> Computing...</>
              ) : (
                <>Compute Janam Kundali <ArrowRight size={18} /></>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-8 sm:p-12 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {formData.name}&apos;s Kundali
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {formData.dob} · {formData.tob} · {formData.pob}
            </p>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {result}
            </p>
            <button
              onClick={() => setResult(null)}
              className="mt-6 px-6 py-3 bg-surface-raised border border-border rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground"
            >
              Recalculate
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
