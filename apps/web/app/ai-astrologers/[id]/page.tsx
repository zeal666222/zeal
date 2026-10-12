"use client";

import {useParams, useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import {
  AlertCircle, ArrowLeft, Loader2, Sparkles, Star, Zap, Bot,
  MessageCircle, Clock, Globe, Shield, ChevronRight, Heart,
} from "lucide-react";
import Link from "next/link";

interface AIDetail {
  id: string;
  name: string;
  username: string;
  avatar: string;
  category: string;
  bio: string;
  rating: number;
  totalConsultations: number;
  isPaid: boolean;
  perMinuteRate: number;
  persona: string | null;
  gender: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  experience: number;
  sparks: number;
  model: string;
  voiceStyle: string | null;
  isActive: boolean;
}

const CATEGORY_THEMES: Record<string, {from: string; to: string; glow: string; accent: string; ring: string}> = {
  vedic_astrology: {from: "from-amber-500", to: "to-orange-600", glow: "bg-amber-500/10", accent: "text-amber-400", ring: "ring-amber-500/30"},
  western_astrology: {from: "from-blue-500", to: "to-indigo-600", glow: "bg-blue-500/10", accent: "text-blue-400", ring: "ring-blue-500/30"},
  chinese_astrology: {from: "from-red-500", to: "to-rose-600", glow: "bg-red-500/10", accent: "text-red-400", ring: "ring-red-500/30"},
  tarot: {from: "from-purple-500", to: "to-violet-600", glow: "bg-purple-500/10", accent: "text-purple-400", ring: "ring-purple-500/30"},
  numerology: {from: "from-cyan-500", to: "to-teal-600", glow: "bg-cyan-500/10", accent: "text-cyan-400", ring: "ring-cyan-500/30"},
  vaastu: {from: "from-emerald-500", to: "to-green-600", glow: "bg-emerald-500/10", accent: "text-emerald-400", ring: "ring-emerald-500/30"},
};

function getTheme(category: string) {
  return CATEGORY_THEMES[category.toLowerCase()] ?? {from: "from-[var(--color-primary)]", to: "to-[var(--color-primary-hover)]", glow: "bg-[var(--color-primary)]/10", accent: "text-[var(--color-primary)]", ring: "ring-white/20"};
}

export default function AIAstrologerDetailPage() {
  const params = useParams<{id: string}>();
  const router = useRouter();
  const [ai, setAi] = useState<AIDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    fetch(`/api/ai/consultants/${params.id}`, {cache: "no-store"})
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data: AIDetail) => { if (!cancelled) setAi(data); })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.id]);

  const handleStartChat = async () => {
    if (!ai) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({partnerId: ai.id}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as {error?: string})?.error || "Could not start chat");
      }
      const data = (await res.json()) as {conversationId?: string};
      if (data.conversationId) {
        router.push(`/chat/${data.conversationId}`);
      } else {
        throw new Error("No conversation returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen-app flex flex-col items-center justify-center gap-4">
        <motion.div animate={{rotate: 360}} transition={{duration: 2, repeat: Infinity, ease: "linear"}}>
          <Sparkles className="w-8 h-8 text-[var(--color-primary)]" />
        </motion.div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading consultant profile...</p>
      </div>
    );
  }

  if (!ai) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <motion.div initial={{scale: 0.8, opacity: 0}} animate={{scale: 1, opacity: 1}}>
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-rose-400 font-medium">{error || "AI consultant not found"}</p>
          <Link href="/ai-astrologers" className="text-[var(--color-primary)] hover:underline mt-3 inline-block text-sm">
            Browse all AI consultants
          </Link>
        </motion.div>
      </div>
    );
  }

  const theme = getTheme(ai.category);
  const isFree = !ai.isPaid || ai.perMinuteRate === 0;

  return (
    <div className="min-h-screen-app pb-16">
      {/* Hero banner */}
      <div className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.from} ${theme.to} opacity-[0.06]`} />
        <div className={`absolute -top-32 -right-32 w-[500px] h-[500px] ${theme.glow} blur-[160px] rounded-full pointer-events-none`} />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-purple-500/[0.05] blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <motion.div initial={{opacity: 0, x: -10}} animate={{opacity: 1, x: 0}}>
            <Link href="/ai-astrologers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft size={14} /> All AI Consultants
            </Link>
          </motion.div>

          {/* Profile header */}
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{type: "spring", stiffness: 200, damping: 22}}
            className="flex flex-col sm:flex-row items-start gap-6"
          >
            {/* Avatar */}
            <div className="relative">
              <motion.div
                whileHover={{scale: 1.05}}
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden ring-4 ${theme.ring} shadow-2xl`}
              >
                <img src={ai.avatar} alt={ai.name} className="w-full h-full object-cover" />
              </motion.div>
              <motion.span
                animate={{rotate: [0, 5, -5, 0]}}
                transition={{duration: 3, repeat: Infinity, repeatDelay: 2}}
                className={`absolute -top-2 -right-2 px-2 py-1 bg-gradient-to-r ${theme.from} ${theme.to} text-white text-[10px] font-black rounded-lg shadow-lg flex items-center gap-1`}
              >
                <Bot size={10} /> AI
              </motion.span>
              {ai.isActive && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-background">
                  <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">{ai.name}</h1>
                  <p className={`text-sm capitalize mt-1 ${theme.accent}`}>
                    {ai.category.toLowerCase().replace(/_/g, " ")}
                  </p>
                </div>
                {isFree ? (
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider rounded-full">
                    Free
                  </span>
                ) : (
                  <span className={`px-3 py-1 bg-gradient-to-r ${theme.from} ${theme.to} text-white text-xs font-bold rounded-full`}>
                    ₹{ai.perMinuteRate}/min
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-sm">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-foreground">{ai.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground text-xs">rating</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  <MessageCircle size={14} className="text-muted-foreground" />
                  <span className="font-bold text-foreground">{ai.totalConsultations.toLocaleString()}</span>
                  <span className="text-muted-foreground text-xs">sessions</span>
                </span>
                {ai.experience > 0 && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Clock size={14} className="text-muted-foreground" />
                    <span className="font-bold text-foreground">{ai.experience}yr</span>
                    <span className="text-muted-foreground text-xs">exp</span>
                  </span>
                )}
                {ai.sparks > 0 && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Heart size={14} className="text-rose-400" />
                    <span className="font-bold text-foreground">{ai.sparks.toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs">sparks</span>
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {ai.persona && (
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-surface-raised border border-border/50 rounded-full text-muted-foreground flex items-center gap-1">
                    <Sparkles size={9} /> {ai.persona}
                  </span>
                )}
                {ai.gender && (
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-surface-raised border border-border/50 rounded-full text-muted-foreground">
                    {ai.gender}
                  </span>
                )}
                {ai.model && (
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-surface-raised border border-border/50 rounded-full text-muted-foreground flex items-center gap-1">
                    <Shield size={9} /> {ai.model}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Bio */}
        {ai.bio && (
          <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.15}}
            className="bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6"
          >
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{ai.bio}</p>
          </motion.div>
        )}

        {/* Specialties */}
        {ai.specialties && ai.specialties.length > 0 && (
          <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.2}}
            className="bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6"
          >
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {ai.specialties.map((s) => (
                <span key={s} className="px-3 py-1.5 text-xs font-medium bg-surface-raised border border-border/50 rounded-full text-foreground">
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Languages */}
        {ai.languages && ai.languages.length > 0 && (
          <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.25}}
            className="bg-surface/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6"
          >
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Globe size={12} /> Languages
            </h2>
            <div className="flex flex-wrap gap-2">
              {ai.languages.map((l) => (
                <span key={l} className="px-3 py-1.5 text-xs font-medium bg-surface-raised border border-border/50 rounded-full text-foreground">
                  {l}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm">
            {error}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.3}}
        >
          <button
            onClick={handleStartChat}
            disabled={starting}
            className={`w-full py-4 bg-gradient-to-r ${theme.from} ${theme.to} text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base`}
          >
            {starting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Starting chat...</>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                {isFree ? "Start Free Chat" : `Start Chat · ₹${ai.perMinuteRate}/min`}
                <ChevronRight size={18} />
              </>
            )}
          </button>

          {isFree && (
            <p className="text-center text-xs text-emerald-400/70 mt-2 flex items-center justify-center gap-1">
              <Sparkles size={10} /> No charges — AI consultation is completely free
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
