"use client";

// Numerology — uses unified /api/ai?task=numerology (cached 24h)

import {useState} from "react";
import {motion} from "framer-motion";
import { Hash, Loader2, Sparkles } from "lucide-react";

export default function NumerologyPage() {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai?task=numerology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, dob }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { analysis?: string };
      setAnalysis(data.analysis ?? "Computation complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app bg-background text-foreground py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Hash className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-4xl font-black mb-2">Destiny Numerology</h1>
          <p className="text-muted-foreground">Calculate life path and karmic frequency cycles.</p>
        </div>

        {!analysis ? (
          <form
            onSubmit={handleSubmit}
            className="bg-surface backdrop-blur-xl border border-border p-8 sm:p-12 rounded-3xl shadow-2xl space-y-6"
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-2xl outline-none text-foreground focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Birth Date
              </label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDob(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-2xl outline-none text-foreground focus:border-amber-500"
              />
            </div>

            {error && <p className="text-rose-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl font-bold hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Compute Profile"}
            </button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface backdrop-blur-xl border border-border p-8 sm:p-12 rounded-3xl shadow-2xl space-y-6"
          >
            <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="text-amber-500" /> {fullName}&apos;s Matrix
            </h2>
            <p className="text-muted-foreground font-light leading-relaxed whitespace-pre-line">
              {analysis}
            </p>
            <button
              onClick={() => setAnalysis("")}
              className="px-6 py-3 bg-surface-raised border border-border rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground"
            >
              Calculate Another
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
