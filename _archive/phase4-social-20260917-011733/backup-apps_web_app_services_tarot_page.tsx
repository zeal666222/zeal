"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Layers, Sparkles, ArrowRight, RotateCcw } from "lucide-react";

const MAJOR_ARCANA = [
  "The Fool", "The Magician", "The High Priestess", "The Empress", 
  "The Emperor", "The Hierophant", "The Lovers", "The Chariot", 
  "Strength", "The Hermit", "Wheel of Fortune", "Justice", 
  "The Hanged Man", "Death", "Temperance", "The Devil", 
  "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World"
];

export default function TarotPage() {
  const [drawnCards, setDrawnCards] = useState<string[]>([]);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const drawSpread = async () => {
    setLoading(true);
    setReading("");
    // Randomly pick 3 distinct cards
    const shuffled = [...MAJOR_ARCANA].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    setDrawnCards(selected);

    try {
      const res = await fetch("/api/ai/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: selected }),
      });
      const data = await res.json();
      if (data.success) {
        setReading(data.reading);
      } else {
        setReading("Tarot synthesis complete. Energy is aligned.");
      }
    } catch (err) {
      setReading("Network transmission interrupted. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-200 dark:bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[72rem] mx-auto relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-medium text-xs uppercase tracking-widest mb-6">
          <Layers size={14} /> Arcane Divination Spread
        </div>
        <h1 className="text-4xl sm:text-6xl font-medium tracking-tight mb-4">Three-Card Temporal Tarot</h1>
        <p className="text-slate-600 dark:text-slate-400 font-light text-lg max-w-2xl mx-auto mb-12">Draw your Past, Present, and Future cards for Groq LPU AI-synthesized esoteric guidance.</p>

        {drawnCards.length === 0 ? (
          <button onClick={drawSpread} disabled={loading} className="px-8 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-full font-bold text-lg hover:bg-purple-600 dark:hover:bg-purple-400 transition-all shadow-2xl inline-flex items-center gap-3">
            {loading ? <Sparkles className="animate-spin" size={22} /> : <>Draw Your Spread <ArrowRight size={20} /></>}
          </button>
        ) : (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {drawnCards.map((card, idx) => (
                <motion.div key={card} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.2 }} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-xl flex flex-col items-center justify-between min-h-[320px]">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                    {idx === 0 ? "Past Energy" : idx === 1 ? "Present State" : "Future Horizon"}
                  </span>
                  <div className="w-20 h-28 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg my-4">
                    {card.charAt(0)}
                  </div>
                  <h3 className="text-xl font-bold">{card}</h3>
                </motion.div>
              ))}
            </div>

            {reading && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 sm:p-12 max-w-3xl mx-auto text-left shadow-2xl">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Sparkles className="text-purple-500"/> Esoteric Synthesis</h3>
                <p className="text-slate-300 leading-relaxed font-light text-base whitespace-pre-line">{reading}</p>
                <button onClick={() => { setDrawnCards([]); setReading(""); }} className="mt-8 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors inline-flex items-center gap-2">
                  <RotateCcw size={16} /> Draw New Spread
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
