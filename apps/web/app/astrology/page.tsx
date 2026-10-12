"use client";

import {useState, useCallback} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {
  ArrowRight, Calendar, Clock, Loader2, MapPin, Orbit, Sparkles,
  RotateCcw, AlertCircle, Star, Shield, Zap,
} from "lucide-react";
import AstrologyReading, {type AstrologyInterpretation} from "@/components/astrology/AstrologyReading";

type ChartType = "vedic" | "western" | "chinese";

interface ApiResponse {
  success: boolean;
  interpretation: AstrologyInterpretation;
  chart: Record<string, unknown>;
  ruleBasedInterpretations: string[];
  meta: {
    chartType: string;
    llmProvider?: string;
    cached: boolean;
    ragContext: {
      chunksRetrieved: number;
      totalChunks: number;
      retrievalTimeMs: number;
    };
  };
}

const CITY_COORDS: Record<string, {lat: number; lng: number; tz: string}> = {
  "porbandar": {lat: 21.6417, lng: 69.6293, tz: "Asia/Kolkata"},
  "mumbai": {lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata"},
  "delhi": {lat: 28.6139, lng: 77.209, tz: "Asia/Kolkata"},
  "new delhi": {lat: 28.6139, lng: 77.209, tz: "Asia/Kolkata"},
  "kolkata": {lat: 22.5726, lng: 88.3639, tz: "Asia/Kolkata"},
  "chennai": {lat: 13.0827, lng: 80.2707, tz: "Asia/Kolkata"},
  "bangalore": {lat: 12.9716, lng: 77.5946, tz: "Asia/Kolkata"},
  "bengaluru": {lat: 12.9716, lng: 77.5946, tz: "Asia/Kolkata"},
  "hyderabad": {lat: 17.385, lng: 78.4867, tz: "Asia/Kolkata"},
  "pune": {lat: 18.5204, lng: 73.8567, tz: "Asia/Kolkata"},
  "jaipur": {lat: 26.9124, lng: 75.7873, tz: "Asia/Kolkata"},
  "varanasi": {lat: 25.3176, lng: 82.9739, tz: "Asia/Kolkata"},
  "ahmedabad": {lat: 23.0225, lng: 72.5714, tz: "Asia/Kolkata"},
  "london": {lat: 51.5074, lng: -0.1278, tz: "Europe/London"},
  "new york": {lat: 40.7128, lng: -74.006, tz: "America/New_York"},
  "los angeles": {lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles"},
  "tokyo": {lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo"},
  "singapore": {lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore"},
  "dubai": {lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai"},
  "sydney": {lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney"},
};

function resolveCity(name: string): {lat: number; lng: number; tz: string} | null {
  const lower = name.toLowerCase().trim();
  for (const [city, data] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city) || city.includes(lower)) return data;
  }
  return null;
}

const CHART_TYPES: {key: ChartType; label: string; desc: string; icon: string}[] = [
  {key: "vedic", label: "Vedic", desc: "Sidereal zodiac", icon: "🕉️"},
  {key: "western", label: "Western", desc: "Tropical zodiac", icon: "♈"},
  {key: "chinese", label: "Chinese", desc: "Lunar calendar", icon: "🐉"},
];

export default function AstrologyTestPage() {
  const [birthDate, setBirthDate] = useState("1869-10-02");
  const [birthTime, setBirthTime] = useState("19:00");
  const [birthPlace, setBirthPlace] = useState("Porbandar, India");
  const [chartType, setChartType] = useState<ChartType>("vedic");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const computeInterpretation = useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);

    const city = resolveCity(birthPlace);
    if (!city) {
      setError(`Could not find coordinates for "${birthPlace}". Try: Mumbai, Delhi, Porbandar, London, New York, Tokyo, etc.`);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/astrology/interpret", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          birthDate, birthTime,
          birthPlace: {lat: city.lat, lng: city.lng},
          timezone: city.tz, chartType,
          question: question || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as {error?: string})?.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as ApiResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compute interpretation");
    } finally {
      setLoading(false);
    }
  }, [birthDate, birthTime, birthPlace, chartType, question]);

  const handleFollowUp = useCallback(async (q: string) => {
    if (!result) return;
    setFollowUpLoading(true);
    try {
      const city = resolveCity(birthPlace);
      if (!city) return;
      const res = await fetch("/api/astrology/interpret", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          birthDate, birthTime,
          birthPlace: {lat: city.lat, lng: city.lng},
          timezone: city.tz, chartType, question: q,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as {error?: string})?.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as ApiResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow-up failed");
    } finally {
      setFollowUpLoading(false);
    }
  }, [result, birthDate, birthTime, birthPlace, chartType]);

  const handleReset = () => {
    setResult(null);
    setError("");
    setQuestion("");
  };

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[var(--color-primary)]/[0.06] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-purple-500/[0.05] blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <motion.div initial={{opacity: 0, y: 16}} animate={{opacity: 1, y: 0}} transition={{type: "spring", stiffness: 200, damping: 20}}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Orbit size={12} /> AI Interpretation Engine
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
              Vedic Astrology Reading
            </h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
              Classical text-powered interpretations via RAG pipeline + LLM.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{opacity: 0, y: 16}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -16}}
            >
              <div className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 space-y-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/[0.03] blur-3xl rounded-full pointer-events-none" />

                <div className="relative space-y-6">
                  {error && (
                    <motion.div
                      initial={{opacity: 0, y: -8}}
                      animate={{opacity: 1, y: 0}}
                      className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-start gap-2"
                    >
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      {error}
                    </motion.div>
                  )}

                  {/* Chart Type */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">Chart System</label>
                    <div className="grid grid-cols-3 gap-3">
                      {CHART_TYPES.map(({key, label, desc, icon}) => (
                        <motion.button
                          key={key}
                          whileHover={{y: -2}}
                          whileTap={{scale: 0.97}}
                          onClick={() => setChartType(key)}
                          className={`py-3.5 px-4 rounded-2xl border text-sm font-medium transition-all ${
                            chartType === key
                              ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10"
                              : "bg-background/80 border-border/60 text-muted-foreground hover:border-[var(--color-primary)]/20"
                          }`}
                        >
                          <span className="text-lg">{icon}</span>
                          <p className="font-bold mt-1">{label}</p>
                          <p className="text-[10px] opacity-60">{desc}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Time of Birth</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="time"
                          value={birthTime}
                          onChange={(e) => setBirthTime(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Place */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Place of Birth</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={birthPlace}
                        onChange={(e) => setBirthPlace(e.target.value)}
                        placeholder="City, Country"
                        className="w-full pl-11 pr-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm transition-colors"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1 ml-1">
                      Supported: Porbandar, Mumbai, Delhi, Kolkata, Chennai, Bangalore, London, New York, Tokyo, etc.
                    </p>
                  </div>

                  {/* Question */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Specific Question (optional)</label>
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., When is a good time for career changes?"
                      className="w-full px-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl focus:border-[var(--color-primary)]/50 outline-none text-foreground text-sm placeholder:text-muted-foreground/40 transition-colors"
                    />
                  </div>

                  {/* Quick-fill: Gandhi */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                    <Sparkles size={13} className="text-amber-400 shrink-0" />
                    <p className="text-xs text-muted-foreground flex-1">
                      Test with Gandhi&apos;s birth data: Oct 2, 1869, 7:00 PM, Porbandar
                    </p>
                    <button
                      onClick={() => {
                        setBirthDate("1869-10-02");
                        setBirthTime("19:00");
                        setBirthPlace("Porbandar, India");
                        setChartType("vedic");
                      }}
                      className="px-3 py-1.5 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 hover:bg-amber-500/20 transition-colors font-medium"
                    >
                      Fill
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={computeInterpretation}
                    disabled={loading || !birthDate || !birthTime || !birthPlace}
                    className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-[var(--color-primary)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" size={18} /> Computing chart & interpretation...</>
                    ) : (
                      <><Zap size={18} /> Generate Reading <ArrowRight size={18} /></>
                    )}
                  </button>

                  {loading && (
                    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="space-y-2">
                      <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]"
                          initial={{width: "0%"}}
                          animate={{width: "90%"}}
                          transition={{duration: 15, ease: "easeOut"}}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Computing planetary positions, retrieving classical knowledge, generating interpretation...
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* How it works */}
              <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                transition={{delay: 0.3}}
                className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                {[
                  {icon: Orbit, title: "Chart Computation", desc: "Deterministic Vedic engine computes exact planetary positions, houses, nakshatras, yogas, and dashas."},
                  {icon: Shield, title: "RAG Retrieval", desc: "Keyword-based retrieval from classical texts (BPHS, Phaladeepika, Jataka Parijata) finds relevant verses."},
                  {icon: Sparkles, title: "AI Interpretation", desc: "LLM receives chart data + classical context and generates comprehensive natural language interpretation."},
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{opacity: 0, y: 12}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.4 + i * 0.1}}
                    className="p-4 rounded-2xl bg-surface/60 border border-border/40"
                  >
                    <step.icon size={16} className="text-[var(--color-primary)] mb-2" />
                    <p className="text-xs font-bold text-foreground">{step.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{step.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -16}}
              className="space-y-6"
            >
              {/* Meta info */}
              {result.meta && (
                <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
                  {result.meta.llmProvider && (
                    <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full flex items-center gap-1">
                      <Sparkles size={9} /> LLM: {result.meta.llmProvider}
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full">
                    RAG: {result.meta.ragContext.chunksRetrieved}/{result.meta.ragContext.totalChunks} chunks
                  </span>
                  <span className="px-2.5 py-1 bg-surface border border-border/60 rounded-full">
                    Retrieval: {result.meta.ragContext.retrievalTimeMs}ms
                  </span>
                  {result.meta.cached && (
                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
                      Cached
                    </span>
                  )}
                </div>
              )}

              {/* Main reading */}
              <AstrologyReading
                interpretation={result.interpretation}
                chart={result.chart}
                ruleBasedInterpretations={result.ruleBasedInterpretations}
                birthData={{date: birthDate, time: birthTime, place: birthPlace}}
                onFollowUp={handleFollowUp}
                loading={followUpLoading}
              />

              {/* Reset */}
              <div className="flex justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-surface-raised border border-border/60 rounded-xl text-sm font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-2"
                >
                  <RotateCcw size={14} /> New Reading
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Free badge */}
        <motion.div
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.5}}
          className="text-center mt-10"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Star size={11} /> 100% Free · Powered by RAG + LLM
          </span>
        </motion.div>
      </div>
    </div>
  );
}
