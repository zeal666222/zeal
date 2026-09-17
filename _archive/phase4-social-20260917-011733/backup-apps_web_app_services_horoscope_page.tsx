"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Sparkles, ArrowRight } from "lucide-react";

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

export default function HoroscopePage() {
  const [selectedSign, setSelectedSign] = useState("Aries");
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchHoroscope = async (sign: string) => {
    setSelectedSign(sign);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign })
      });
      const data = await res.json();
      if (data.success) setReading(data.reading);
    } catch (e) {
      setReading("Unable to fetch transit telemetry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium text-xs uppercase tracking-widest mb-6">
          <Star size={14} /> Ephemeris Transit Forecast
        </div>
        <h1 className="text-4xl sm:text-6xl font-medium tracking-tight mb-4">Daily Planetary Horoscope</h1>
        <p className="text-slate-600 dark:text-slate-400 font-light text-lg mb-12">Select your zodiac sign for real-time Groq AI transits.</p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-12">
          {SIGNS.map(sign => (
            <button key={sign} onClick={() => fetchHoroscope(sign)} className={`py-4 rounded-2xl font-bold transition-all border ${selectedSign === sign ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 hover:border-blue-400"}`}>
              {sign}
            </button>
          ))}
        </div>

        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 sm:p-12 text-left shadow-2xl">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Sparkles className="text-blue-500"/> {selectedSign} Forecast</h3>
          {loading ? <p className="text-slate-400 animate-pulse">Computing planetary degrees...</p> : <p className="text-slate-300 leading-relaxed font-light text-base">{reading || "Click a sign above to load forecast."}</p>}
        </div>
      </div>
    </div>
  );
}
