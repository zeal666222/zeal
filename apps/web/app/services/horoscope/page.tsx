"use client";

import {useState} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {Loader2, Sparkles, Star, Sun, Moon, CloudSun, Compass} from "lucide-react";

const SIGNS = [
  {name: "Aries", symbol: "♈", emoji: "🐏", dates: "Mar 21 – Apr 19", element: "Fire"},
  {name: "Taurus", symbol: "♉", emoji: "🐂", dates: "Apr 20 – May 20", element: "Earth"},
  {name: "Gemini", symbol: "♊", emoji: "👯", dates: "May 21 – Jun 20", element: "Air"},
  {name: "Cancer", symbol: "♋", emoji: "🦀", dates: "Jun 21 – Jul 22", element: "Water"},
  {name: "Leo", symbol: "♌", emoji: "🦁", dates: "Jul 23 – Aug 22", element: "Fire"},
  {name: "Virgo", symbol: "♍", emoji: "🌾", dates: "Aug 23 – Sep 22", element: "Earth"},
  {name: "Libra", symbol: "♎", emoji: "⚖️", dates: "Sep 23 – Oct 22", element: "Air"},
  {name: "Scorpio", symbol: "♏", emoji: "🦂", dates: "Oct 23 – Nov 21", element: "Water"},
  {name: "Sagittarius", symbol: "♐", emoji: "🏹", dates: "Nov 22 – Dec 21", element: "Fire"},
  {name: "Capricorn", symbol: "♑", emoji: "🐐", dates: "Dec 22 – Jan 19", element: "Earth"},
  {name: "Aquarius", symbol: "♒", emoji: "🏺", dates: "Jan 20 – Feb 18", element: "Air"},
  {name: "Pisces", symbol: "♓", emoji: "🐟", dates: "Feb 19 – Mar 20", element: "Water"},
];

const ELEMENT_COLORS: Record<string, {from: string; to: string; bg: string; text: string}> = {
  Fire: {from: "from-rose-500", to: "to-orange-500", bg: "bg-rose-500/10", text: "text-rose-400"},
  Earth: {from: "from-emerald-500", to: "to-green-600", bg: "bg-emerald-500/10", text: "text-emerald-400"},
  Air: {from: "from-cyan-400", to: "to-sky-500", bg: "bg-cyan-500/10", text: "text-cyan-400"},
  Water: {from: "from-blue-500", to: "to-indigo-600", bg: "bg-blue-500/10", text: "text-blue-400"},
};

export default function HoroscopePage() {
  const [selectedSign, setSelectedSign] = useState(SIGNS[0]!);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHoroscope = async (sign: typeof SIGNS[number]) => {
    setSelectedSign(sign);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai?task=horoscope", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({sign: sign.name}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as {error?: string})?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {reading?: string};
      setReading(data.reading ?? "No reading available.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const colors = ELEMENT_COLORS[selectedSign.element] ?? ELEMENT_COLORS["Fire"]!;

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-amber-500/[0.06] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-purple-500/[0.05] blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <motion.div initial={{opacity: 0, y: 16}} animate={{opacity: 1, y: 0}} transition={{type: "spring", stiffness: 200, damping: 20}}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Sun size={12} /> Daily Transit Forecast
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
              Daily Horoscope
            </h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
              Real-time planetary transit guidance powered by Vedic ephemeris calculations.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Zodiac grid */}
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.1}}
          className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3"
        >
          {SIGNS.map((sign, idx) => {
            const elColors = ELEMENT_COLORS[sign.element] ?? ELEMENT_COLORS["Fire"]!;
            const isSelected = selectedSign.name === sign.name;
            return (
              <motion.button
                key={sign.name}
                initial={{opacity: 0, y: 12}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: idx * 0.03, type: "spring", stiffness: 300, damping: 22}}
                whileHover={{y: -4, scale: 1.04}}
                whileTap={{scale: 0.96}}
                onClick={() => void fetchHoroscope(sign)}
                disabled={loading}
                className={`relative overflow-hidden rounded-2xl p-3 text-center transition-all border ${
                  isSelected
                    ? `bg-gradient-to-br ${elColors.from} ${elColors.to} text-white border-transparent shadow-lg`
                    : "bg-surface/80 backdrop-blur border-border/60 text-foreground hover:border-[var(--color-primary)]/30"
                }`}
              >
                <div className="text-2xl mb-1">{sign.symbol}</div>
                <p className={`text-xs font-bold ${isSelected ? "text-white" : "text-foreground"}`}>{sign.name}</p>
                <p className={`text-[9px] mt-0.5 ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>{sign.dates}</p>
                {isSelected && (
                  <motion.div
                    layoutId="horoscope-selected"
                    className="absolute inset-0 border-2 border-white/30 rounded-2xl pointer-events-none"
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Reading panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedSign.name + (loading ? "-loading" : "")}
            initial={{opacity: 0, y: 16}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -10}}
            transition={{type: "spring", stiffness: 200, damping: 24}}
            className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10"
          >
            {/* Background accent */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${colors.from} ${colors.to} opacity-[0.04] blur-3xl rounded-full pointer-events-none`} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center text-2xl shadow-lg`}>
                  {selectedSign.symbol}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground">{selectedSign.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={colors.text}>{selectedSign.element}</span>
                    <span>·</span>
                    <span>{selectedSign.dates}</span>
                  </div>
                </div>
                <div className="ml-auto">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                    Today
                  </span>
                </div>
              </div>

              {/* Content */}
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <motion.div animate={{rotate: 360}} transition={{duration: 2, repeat: Infinity, ease: "linear"}}>
                    <Compass className="w-8 h-8 text-[var(--color-primary)]" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Computing planetary degrees...</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Analyzing transits for {selectedSign.name}</p>
                  </div>
                </div>
              ) : error ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">
                  {error}
                </div>
              ) : reading ? (
                <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.1}}>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-[15px]">
                    {reading}
                  </p>
                  <div className="mt-6 pt-4 border-t border-border/40 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Sparkles size={9} className="text-[var(--color-primary)]" /> AI-generated</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Moon size={9} /> Vedic transit data</span>
                    <span>·</span>
                    <span>Cached 6h</span>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CloudSun className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Select your zodiac sign above to load today&apos;s forecast
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Free badge */}
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.4}}
          className="text-center"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> 100% Free · No sign-up required
          </span>
        </motion.div>
      </div>
    </div>
  );
}
