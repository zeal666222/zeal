"use client";
import { useState } from "react";
import { generateTarotSpread } from "@/actions/free-tools";
import { Layers, Sparkles } from "lucide-react";

export default function TarotPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const drawCards = async () => {
    setLoading(true);
    const res = await generateTarotSpread("Past-Present-Future");
    if (res.success) setResult(res.data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-16 px-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3"><Layers className="text-blue-500"/> Oracle Tarot</h1>
        <p className="text-slate-500 mb-12">Draw your cards to reveal the cosmic narrative.</p>
        
        {!result ? (
          <button onClick={drawCards} disabled={loading} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-105 transition-all">
            {loading ? "Shuffling Deck..." : "Draw 3-Card Spread"}
          </button>
        ) : (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {result.cards.map((card: any, i: number) => (
                <div key={i} className={`bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border ${card.state === 'Reversed' ? 'border-rose-500/50' : 'border-blue-500/50'}`}>
                  <p className="text-xs uppercase font-bold text-slate-400 mb-4">{card.position}</p>
                  <h3 className="text-2xl font-black mb-1">{card.name}</h3>
                  <p className={`text-sm font-bold mb-4 ${card.state === 'Reversed' ? 'text-rose-500' : 'text-blue-500'}`}>{card.state}</p>
                  <p className="text-slate-500 text-sm">{card.meaning}</p>
                </div>
              ))}
            </div>
            <div className="p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-3xl text-left">
              <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2"><Sparkles/> AI Synthesis</h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{result.synthesis}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
