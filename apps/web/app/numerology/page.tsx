"use client";
import { useState } from "react";
import { generateNumerology } from "@/actions/free-tools";
import { Hash, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function NumerologyPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await generateNumerology("User", "2000-01-01");
    if (res.success) setResult(res.data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-16 px-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 flex items-center gap-3"><Hash className="text-amber-500"/> Pythagorean Numerology</h1>
        
        {!result ? (
          <form onSubmit={calculate} className="bg-white/80 dark:bg-slate-900/60 p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-white/5">
            <input type="text" placeholder="Exact Name on Birth Certificate" required className="w-full p-4 mb-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
            <input type="date" required className="w-full p-4 mb-8 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10" />
            <button type="submit" disabled={loading} className="w-full py-4 bg-amber-600 text-white rounded-xl font-bold shadow-lg hover:bg-amber-500 transition-colors">
              {loading ? "Decoding Matrix..." : "Calculate Core Numbers"}
            </button>
          </form>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-amber-500/20 text-center">
                <p className="text-xs uppercase font-bold text-slate-400 mb-2">Life Path</p>
                <h3 className="text-5xl font-black text-amber-500 mb-4">{result.life_path}</h3>
                <p className="text-sm text-slate-500">{result.life_path_meaning}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-amber-500/20 text-center">
                <p className="text-xs uppercase font-bold text-slate-400 mb-2">Destiny</p>
                <h3 className="text-5xl font-black text-amber-500 mb-4">{result.destiny}</h3>
                <p className="text-sm text-slate-500">{result.destiny_meaning}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-amber-500/20 text-center">
                <p className="text-xs uppercase font-bold text-slate-400 mb-2">Soul Urge</p>
                <h3 className="text-5xl font-black text-amber-500 mb-4">{result.soul_urge}</h3>
                <p className="text-sm text-slate-500">{result.soul_urge_meaning}</p>
              </div>
            </div>
            {result.name_correction_alert && (
              <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-amber-500" />
                  <div>
                    <h4 className="font-bold text-amber-700 dark:text-amber-300">Name Misalignment Detected</h4>
                    <p className="text-sm text-amber-600 dark:text-amber-400">Your Destiny number conflicts with your Life Path. Minor spelling corrections can align your vibrations.</p>
                  </div>
                </div>
                <Link href="/services/numerology" className="shrink-0 px-4 py-2 bg-amber-600 text-white rounded-xl font-bold shadow-md hover:bg-amber-500">
                  Consult Master
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
