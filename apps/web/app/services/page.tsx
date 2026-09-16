"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { Sparkles, Search, ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const CATEGORIES = [
  "Vedic Astrology", "Western Astrology", "Chinese Astrology", "Hellenistic Astrology", "KP Astrology",
  "Nadi Astrology", "Horary (Prashna)", "Tarot Reading", "Oracle Cards", "Angel Reading",
  "Pythagorean Numerology", "Chaldean Numerology", "Islamic Numerology (Jafr)", "Kabbalistic Numerology", "Feng Shui",
  "Vastu Shastra", "Palmistry", "Face Reading", "Aura Reading", "Chakra Healing",
  "Reiki Healing", "Crystal Healing", "Shamanic Healing", "Past Life Regression", "Akashic Records",
  "Runes Casting", "I Ching", "Tea Leaf Reading", "Pendulum Dowsing", "Mediumship",
  "Dream Interpretation", "Symbology", "Karmic Debt Analysis", "Synastry (Matchmaking)", "Muhurta (Electional)",
  "Astro-Cartography", "Spiritual Coaching"
];

export default function ServicesHubPage() {
  const [query, setQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAiSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    
    // Simulate Groq AI LPU routing logic
    setTimeout(() => {
      setAiResponse("I have analyzed your request. I recommend connecting with a Vedic Astrologer specializing in Dasha cycles, or testing our Synastry AI.");
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-200 dark:bg-purple-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-[84rem] mx-auto relative z-10">
        <h1 className="text-4xl sm:text-6xl font-medium tracking-tight mb-4">Master Intelligence Hub.</h1>
        <p className="text-slate-600 dark:text-slate-400 font-light mb-12 text-lg">
          Discover 37 multi-faith disciplines, neural AI avatars, and verified human masters.
        </p>

        {/* Zeal Core AI Assistant Search */}
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 shadow-2xl mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Bot size={20} />
            </div>
            <h2 className="text-xl font-bold">Ask Zeal Core</h2>
          </div>
          
          <form onSubmit={handleAiSearch} className="relative mb-4">
            <Search className="absolute left-4 top-4 text-slate-400" size={20} />
            <input 
              type="text" 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="E.g., 'I am facing a career crisis, what reading do I need?'" 
              className="w-full pl-12 pr-32 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 transition-colors"
            />
            <button 
              type="submit" 
              disabled={loading || !query}
              className="absolute right-2 top-2 bottom-2 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-xl font-bold hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Computing..." : "Analyze"}
            </button>
          </form>

          {aiResponse && (
            <div className="p-4 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl text-purple-800 dark:text-purple-300 text-sm leading-relaxed flex gap-3">
              <Sparkles className="shrink-0 mt-0.5" size={16} />
              <p>{aiResponse}</p>
            </div>
          )}
        </div>

        {/* 37 Categories Grid */}
        <h3 className="text-2xl font-bold mb-6">Explore 37 Metaphysical Disciplines</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return (
              <Link 
                key={cat} 
                href={`/services/${slug}`} 
                className="p-5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-2xl hover:border-purple-500/50 hover:bg-white dark:hover:bg-slate-900 transition-all group flex justify-between items-center shadow-sm"
              >
                <span className="font-medium text-sm group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{cat}</span>
                <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
