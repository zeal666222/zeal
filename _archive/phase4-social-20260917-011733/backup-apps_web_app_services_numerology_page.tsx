"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Hash, Sparkles, ArrowRight } from "lucide-react";

export default function NumerologyPage() {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/ai/numerology", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, dob })
      });
      const data = await res.json();
      if (data.success) setAnalysis(data.analysis);
    } catch (e) { setAnalysis("Computation failed."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Hash className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-4xl font-medium mb-2">Destiny Numerology Frequency</h1>
          <p className="text-slate-400">Calculate life path and karmic frequency cycles.</p>
        </div>

        {!analysis ? (
          <form onSubmit={handleSubmit} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Full Name</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl outline-none text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Birth Date</label>
              <input type="date" required value={dob} onChange={e => setDob(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl outline-none text-white" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl font-bold hover:bg-amber-400 transition-all">
              {loading ? "Calculating..." : "Compute Numerology Profile"}
            </button>
          </form>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl space-y-6">
            <h3 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-amber-500"/> {fullName}'s Numerology Matrix</h3>
            <p className="text-slate-300 font-light leading-relaxed whitespace-pre-line">{analysis}</p>
            <button onClick={() => setAnalysis("")} className="px-6 py-3 bg-slate-800 rounded-xl text-sm font-medium">Calculate Another</button>
          </div>
        )}
      </div>
    </div>
  );
}
