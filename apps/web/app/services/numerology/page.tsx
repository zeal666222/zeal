"use client";

import {useState, useMemo} from "react";
import {motion, AnimatePresence} from "framer-motion";
import {Hash, Loader2, Sparkles, Star, Calculator, RefreshCw, TrendingUp, Heart, Briefcase} from "lucide-react";

function computeNumerology(name: string, dob: string) {
  const lifePath = dob.split("-").join("").split("").reduce((a, c) => a + parseInt(c, 10), 0);
  const reduce = (n: number): number => n > 9 && n !== 11 && n !== 22 && n !== 33 ? reduce(n.toString().split("").reduce((a, c) => a + parseInt(c, 10), 0)) : n;
  const lifePathNum = reduce(lifePath);
  const nameNum = reduce(name.toUpperCase().split("").filter((c) => /[A-Z]/.test(c)).reduce((a, c) => a + ((c.charCodeAt(0) - 65) % 9) + 1, 0));
  return {lifePath: lifePathNum, nameNumber: nameNum};
}

const NUMBER_MEANINGS: Record<number, {title: string; trait: string; color: string; icon: string}> = {
  1: {title: "The Leader", trait: "Independent, ambitious, pioneering", color: "from-red-500 to-orange-500", icon: "👑"},
  2: {title: "The Diplomat", trait: "Cooperative, sensitive, balanced", color: "from-blue-400 to-cyan-500", icon: "🤝"},
  3: {title: "The Creative", trait: "Expressive, artistic, optimistic", color: "from-yellow-400 to-amber-500", icon: "🎨"},
  4: {title: "The Builder", trait: "Practical, disciplined, loyal", color: "from-green-500 to-emerald-600", icon: "🏗️"},
  5: {title: "The Adventurer", trait: "Freedom-loving, versatile, dynamic", color: "from-purple-500 to-violet-600", icon: "🌍"},
  6: {title: "The Nurturer", trait: "Responsible, loving, protective", color: "from-pink-500 to-rose-500", icon: "💝"},
  7: {title: "The Seeker", trait: "Analytical, introspective, wise", color: "from-indigo-500 to-blue-600", icon: "🔮"},
  8: {title: "The Powerhouse", trait: "Ambitious, authoritative, successful", color: "from-amber-600 to-yellow-700", icon: "💎"},
  9: {title: "The Humanitarian", trait: "Compassionate, generous, idealistic", color: "from-teal-500 to-cyan-600", icon: "🌟"},
  11: {title: "Master Intuitive", trait: "Spiritually aware, inspiring", color: "from-violet-500 to-purple-600", icon: "✨"},
  22: {title: "Master Builder", trait: "Visionary, practical mastery", color: "from-emerald-500 to-green-700", icon: "🏛️"},
  33: {title: "Master Teacher", trait: "Selfless service, spiritual guidance", color: "from-rose-500 to-pink-600", icon: "🕊️"},
};

export default function NumerologyPage() {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const nums = useMemo(() => {
    if (!fullName || !dob) return null;
    return computeNumerology(fullName, dob);
  }, [fullName, dob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResult(false);
    try {
      const res = await fetch("/api/ai?task=numerology", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({fullName, dob}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as {error?: string})?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {analysis?: string};
      setAnalysis(data.analysis ?? "Computation complete.");
      setShowResult(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const lifePathInfo = nums ? NUMBER_MEANINGS[nums.lifePath] ?? null : null;
  const nameNumInfo = nums ? NUMBER_MEANINGS[nums.nameNumber] ?? null : null;

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-amber-500/[0.06] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-cyan-500/[0.05] blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
          <motion.div initial={{opacity: 0, y: 16}} animate={{opacity: 1, y: 0}} transition={{type: "spring", stiffness: 200, damping: 20}}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Hash size={12} /> Karmic Frequency Analysis
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
              Destiny Numerology
            </h1>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
              Calculate your life path number and karmic frequency cycles.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="form"
              initial={{opacity: 0, y: 16}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -16}}
            >
              <form
                onSubmit={handleSubmit}
                className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10 space-y-6"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.03] blur-3xl rounded-full pointer-events-none" />

                <div className="relative space-y-6">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                      placeholder="Enter your full birth name"
                      className="w-full px-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl outline-none text-foreground focus:border-amber-500/50 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Birth Date</label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDob(e.target.value)}
                      className="w-full px-4 py-3.5 bg-background/80 border border-border/60 rounded-2xl outline-none text-foreground focus:border-amber-500/50 transition-colors text-sm"
                    />
                  </div>

                  {/* Live preview of numbers */}
                  {nums && lifePathInfo && (
                    <motion.div
                      initial={{opacity: 0, height: 0}}
                      animate={{opacity: 1, height: "auto"}}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Life Path</p>
                        <p className="text-2xl font-black text-amber-400 mt-1">{nums.lifePath}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lifePathInfo.title} {lifePathInfo.icon}</p>
                      </div>
                      {nameNumInfo && (
                        <div className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Destiny</p>
                          <p className="text-2xl font-black text-cyan-400 mt-1">{nums.nameNumber}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{nameNumInfo.title} {nameNumInfo.icon}</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {error && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold hover:shadow-2xl hover:shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 size={18} className="animate-spin" /> Computing cycles...</>
                    ) : (
                      <><Calculator size={18} /> Compute Profile</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -16}}
              transition={{type: "spring", stiffness: 180, damping: 22}}
              className="space-y-6"
            >
              {/* Number visualization */}
              {nums && lifePathInfo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.div
                    initial={{opacity: 0, x: -20}}
                    animate={{opacity: 1, x: 0}}
                    transition={{delay: 0.1}}
                    className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6"
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${lifePathInfo.color} opacity-[0.08] blur-2xl rounded-full pointer-events-none`} />
                    <div className="relative text-center">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Life Path Number</p>
                      <motion.p
                        initial={{scale: 0}}
                        animate={{scale: 1}}
                        transition={{delay: 0.2, type: "spring", stiffness: 200}}
                        className={`text-6xl font-black mt-2 bg-gradient-to-r ${lifePathInfo.color} bg-clip-text text-transparent`}
                      >
                        {nums.lifePath}
                      </motion.p>
                      <p className="text-lg font-bold text-foreground mt-2">{lifePathInfo.icon} {lifePathInfo.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{lifePathInfo.trait}</p>
                    </div>
                  </motion.div>

                  {nameNumInfo && (
                    <motion.div
                      initial={{opacity: 0, x: 20}}
                      animate={{opacity: 1, x: 0}}
                      transition={{delay: 0.2}}
                      className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6"
                    >
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${nameNumInfo.color} opacity-[0.08] blur-2xl rounded-full pointer-events-none`} />
                      <div className="relative text-center">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Destiny Number</p>
                        <motion.p
                          initial={{scale: 0}}
                          animate={{scale: 1}}
                          transition={{delay: 0.3, type: "spring", stiffness: 200}}
                          className={`text-6xl font-black mt-2 bg-gradient-to-r ${nameNumInfo.color} bg-clip-text text-transparent`}
                        >
                          {nums.nameNumber}
                        </motion.p>
                        <p className="text-lg font-bold text-foreground mt-2">{nameNumInfo.icon} {nameNumInfo.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{nameNumInfo.trait}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* AI Analysis */}
              <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.3}}
                className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 p-6 sm:p-10"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.04] blur-3xl rounded-full pointer-events-none" />
                <div className="relative">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-foreground mb-4">
                    <Sparkles className="text-amber-400" /> {fullName}&apos;s Numerology Profile
                  </h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-[15px]">
                    {analysis}
                  </p>
                  <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Sparkles size={9} className="text-amber-400" /> AI analysis</span>
                      <span>·</span>
                      <span>Cached 24h</span>
                    </div>
                    <button
                      onClick={() => { setAnalysis(""); setShowResult(false); setFullName(""); setDob(""); }}
                      className="px-4 py-2 bg-surface-raised border border-border/60 rounded-xl text-xs font-medium hover:bg-surface-overlay transition-colors text-foreground flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} /> New Calculation
                    </button>
                  </div>
                </div>
              </motion.div>
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
            <Star size={11} /> 100% Free · No sign-up required
          </span>
        </motion.div>
      </div>
    </div>
  );
}
