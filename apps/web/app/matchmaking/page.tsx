"use client";
import { useState } from "react";
import { generateMatchmaking } from "@/actions/free-tools";
import { Users, Heart, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function MatchmakingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await generateMatchmaking({}, {});
    if (res.success) setResult(res.data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-16 px-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 flex items-center gap-3"><Users className="text-emerald-500"/> Synastry Engine (Kundali Milan)</h1>
        {!result ? (
          <div className="bg-white/80 dark:bg-slate-900/60 p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-white/5">
            <form onSubmit={handleMatch}>
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-blue-500">Partner 1 (Boy)</h3>
                  <input type="text" placeholder="Name" required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                  <input type="date" required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-rose-500">Partner 2 (Girl)</h3>
                  <input type="text" placeholder="Name" required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                  <input type="date" required className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-500 transition-colors">
                {loading ? "Calculating Ashtakoot Matrix..." : "Match Kundalis"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/80 dark:bg-slate-900/60 p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-white/5 text-center">
              <p className="uppercase tracking-widest text-emerald-500 font-bold mb-2">Guna Milan Score</p>
              <h2 className="text-6xl font-black mb-4">{result.score} <span className="text-3xl text-slate-400">/ 36</span></h2>
              {result.alerts.length > 0 && (
                <div className="mt-6 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center gap-3 font-bold border border-rose-200 dark:border-rose-500/20">
                  <AlertTriangle /> {result.alerts[0]}
                </div>
              )}
            </div>
            {result.alerts.length > 0 && (
              <Link href="/services/vedic-astrology" className="block w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-center font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2">
                Consult a Master for Dosha Remedies <ArrowRight />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
