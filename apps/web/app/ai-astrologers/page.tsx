"use client";

import {useState, useMemo} from "react";
import Link from "next/link";
import Image from "next/image";
import {motion, AnimatePresence} from "framer-motion";
import {Loader2, Sparkles, Wifi, Bot, Search, SlidersHorizontal, Zap, Star, MessageCircle, MapPin, Sun, Moon, Heart, Brain, Hash, Hand, Compass, Sparkle} from "lucide-react";
import {useAiConsultants, type AiConsultant} from "@/hooks/useAiConsultants";

const CATEGORY_META: Record<string, {from: string; to: string; ring: string; icon: typeof Sun; label: string; pill: string; pillBorder: string}> = {
  ASTROLOGER: {from: "from-amber-500", to: "to-orange-600", ring: "ring-amber-500/30", icon: Sun, label: "Astrologer", pill: "bg-amber-500/10 text-amber-400", pillBorder: "border-amber-500/20"},
  TAROT: {from: "from-purple-500", to: "to-violet-600", ring: "ring-purple-500/30", icon: Moon, label: "Tarot Reader", pill: "bg-purple-500/10 text-purple-400", pillBorder: "border-purple-500/20"},
  PSYCHOLOGIST: {from: "from-rose-500", to: "to-pink-600", ring: "ring-rose-500/30", icon: Brain, label: "Psychologist", pill: "bg-rose-500/10 text-rose-400", pillBorder: "border-rose-500/20"},
  HEALER: {from: "from-emerald-500", to: "to-green-600", ring: "ring-emerald-500/30", icon: Heart, label: "Healer", pill: "bg-emerald-500/10 text-emerald-400", pillBorder: "border-emerald-500/20"},
  NUMEROLOGIST: {from: "from-cyan-500", to: "to-teal-600", ring: "ring-cyan-500/30", icon: Hash, label: "Numerologist", pill: "bg-cyan-500/10 text-cyan-400", pillBorder: "border-cyan-500/20"},
  PALMIST: {from: "from-fuchsia-500", to: "to-pink-600", ring: "ring-fuchsia-500/30", icon: Hand, label: "Palmist", pill: "bg-fuchsia-500/10 text-fuchsia-400", pillBorder: "border-fuchsia-500/20"},
  VASTU: {from: "from-teal-500", to: "to-cyan-600", ring: "ring-teal-500/30", icon: Compass, label: "Vastu Expert", pill: "bg-teal-500/10 text-teal-400", pillBorder: "border-teal-500/20"},
};
const DEFAULT_META = {from: "from-[var(--color-primary)]", to: "to-[var(--color-primary-hover)]", ring: "ring-[var(--color-primary)]/30", icon: Sparkle, label: "Consultant", pill: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]", pillBorder: "border-[var(--color-primary)]/20"};

function getCategoryMeta(category: string) {
  return CATEGORY_META[category] ?? DEFAULT_META;
}

function AiConsultantCard({consultant, index}: {consultant: AiConsultant; index: number}) {
  const meta = getCategoryMeta(consultant.category);
  const CatIcon = meta.icon;
  const isFree = !consultant.isPaid || consultant.perMinuteRate === 0;

  return (
    <motion.div
      initial={{opacity: 0, y: 20, scale: 0.96}}
      animate={{opacity: 1, y: 0, scale: 1}}
      transition={{
        delay: Math.min(index * 0.05, 0.4),
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      whileHover={{y: -6, scale: 1.02}}
      whileTap={{scale: 0.98}}
      className="group relative"
    >
      <Link href={`/ai-astrologers/${consultant.id}`} className="block">
        <div className="relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-xl border border-border/60 transition-all duration-300 group-hover:border-[var(--color-primary)]/40 group-hover:shadow-2xl group-hover:shadow-[var(--color-primary)]/10">
          {/* Gradient glow on hover */}
          <div className={`absolute inset-0 bg-gradient-to-br ${meta.from} ${meta.to} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />

          {/* Top category strip with icon + label */}
          <div className={`relative flex items-center justify-between px-4 py-2 bg-gradient-to-r ${meta.from} ${meta.to} bg-opacity-10`}>
            <div className="flex items-center gap-1.5">
              <CatIcon size={12} className="text-white/90" />
              <span className="text-[10px] font-black uppercase tracking-wider text-white/90">{meta.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {consultant.location && (
                <span className="flex items-center gap-0.5 text-[9px] text-white/70">
                  <MapPin size={8} /> {consultant.location}{consultant.country ? `, ${consultant.country}` : ''}
                </span>
              )}
              {isFree && (
                <span className="px-1.5 py-0.5 bg-white/20 text-white text-[9px] font-black uppercase tracking-wider rounded-full">
                  Free
                </span>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="relative flex items-start gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ${meta.ring} transition-all duration-300 group-hover:ring-4`}>
                  <Image
                    src={consultant.avatar}
                    alt={consultant.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                {/* AI Badge */}
                <motion.span
                  animate={{rotate: [0, 5, -5, 0]}}
                  transition={{duration: 3, repeat: Infinity, repeatDelay: 2}}
                  className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-gradient-to-r ${meta.from} ${meta.to} text-white text-[8px] font-black rounded-md shadow-lg flex items-center gap-0.5`}
                >
                  <Bot size={7} /> AI
                </motion.span>
                {/* Online pulse */}
                {consultant.isActive && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface">
                    <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground truncate text-[15px]">
                  {consultant.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-0.5 text-xs">
                    <Star size={10} className="text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold text-foreground">{consultant.rating.toFixed(1)}</span>
                  </span>
                  <span className="text-[10px] text-[var(--color-subtle-foreground)]">
                    {consultant.totalConsultations.toLocaleString()} sessions
                  </span>
                  {consultant.experience && (
                    <span className="text-[10px] text-[var(--color-subtle-foreground)]">
                      {consultant.experience}yr
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Specialties — prominent colored pills */}
            {consultant.specialties && consultant.specialties.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {consultant.specialties.slice(0, 4).map((s) => (
                  <span key={s} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${meta.pill} ${meta.pillBorder}`}>
                    {s}
                  </span>
                ))}
                {consultant.specialties.length > 4 && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${meta.pill} ${meta.pillBorder}`}>
                    +{consultant.specialties.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageCircle size={11} />
                <span>{isFree ? "Start free chat" : `₹${consultant.perMinuteRate}/min`}</span>
              </div>
              <motion.div
                className={`flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity`}
              >
                <Zap size={11} />
                <span>Go</span>
              </motion.div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function AIAstrologersPage() {
  const {consultants, isLoading, error, isRealtime} = useAiConsultants();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const cats = new Set(consultants.map((c) => c.category));
    return ["all", ...Array.from(cats).sort()];
  }, [consultants]);

  const categoryLabel = (cat: string) => {
    if (cat === "all") return "All";
    const meta = getCategoryMeta(cat);
    return meta.label + "s";
  };

  const filtered = useMemo(() => {
    let items = consultants;
    if (categoryFilter !== "all") {
      items = items.filter((c) => c.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.specialties.some((s) => s.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [consultants, categoryFilter, search]);

  const freeCount = useMemo(() => consultants.filter((c) => !c.isPaid || c.perMinuteRate === 0).length, [consultants]);

  if (isLoading) {
    return (
      <div className="min-h-screen-app flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{rotate: 360}}
          transition={{duration: 2, repeat: Infinity, ease: "linear"}}
        >
          <Sparkles className="w-8 h-8 text-[var(--color-primary)]" />
        </motion.div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading AI consultants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <motion.div initial={{scale: 0.8, opacity: 0}} animate={{scale: 1, opacity: 1}}>
          <p className="text-rose-400 font-medium">Failed to load AI consultants</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero with animated blobs */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-[var(--color-primary)]/[0.08] blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-purple-500/[0.06] blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
          <motion.div
            initial={{opacity: 0, y: 16}}
            animate={{opacity: 1, y: 0}}
            transition={{type: "spring", stiffness: 200, damping: 20}}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em]">
                <Bot size={11} /> AI-Powered Consultations
              </div>
              {isRealtime && (
                <motion.span
                  initial={{opacity: 0, scale: 0.8}}
                  animate={{opacity: 1, scale: 1}}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold"
                >
                  <Wifi size={10} /> Live
                </motion.span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
              AI Astrologers
            </h1>
            <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-xl">
              Instant guidance from {consultants.length} AI consultants trained in classical astrology.{" "}
              {freeCount > 0 && (
                <span className="text-emerald-400 font-medium">{freeCount} available free</span>
              )}
            </p>
          </motion.div>

          {/* Search + Filter bar */}
          <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.15}}
            className="mt-6 flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, specialty, or category..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface/80 backdrop-blur border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[var(--color-primary)]/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <SlidersHorizontal size={13} className="text-muted-foreground flex-shrink-0" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    categoryFilter === cat
                      ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
                      : "bg-surface/60 text-muted-foreground border border-border/40 hover:text-foreground hover:border-border"
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              className="text-center py-20"
            >
              <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {search || categoryFilter !== "all" ? "No consultants match your filters" : "No AI consultants available yet"}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.map((c, idx) => (
                <AiConsultantCard key={c.id} consultant={c} index={idx} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats footer */}
        {consultants.length > 0 && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            transition={{delay: 0.6}}
            className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/60 border border-border/40">
              <Bot size={10} /> {consultants.length} AI consultants
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400">
              <Zap size={10} /> {freeCount} free
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/60 border border-border/40">
              <Star size={10} className="text-yellow-500" />{" "}
              {(consultants.reduce((a, c) => a + c.rating, 0) / consultants.length).toFixed(1)} avg rating
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/60 border border-border/40">
              <MessageCircle size={10} />{" "}
              {consultants.reduce((a, c) => a + c.totalConsultations, 0).toLocaleString()} total sessions
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
