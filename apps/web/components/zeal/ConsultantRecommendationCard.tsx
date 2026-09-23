// ZEAL_PHASE2_V1
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ConsultantRecommendationCard — compact card rendered inline in ZealChat
// ─────────────────────────────────────────────────────────────────────────────
// Receives a consultant row from the concierge task + optional "reason".
// Calls onChat(id) → wired to startChatFlow by ZealChat parent.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion";
import { Radio, Sparkles, Star } from "lucide-react";

export interface RecommendationConsultant {
  id: string;
  userId?: string;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  category?: string | null;
  perMinuteRate?: number | null;
  rating?: number | null;
  sparkScore?: number | null;
  specialties?: string[] | null;
  is_online?: boolean;
  isAI?: boolean;
  isPaid?: boolean;
}

interface Props {
  consultant: RecommendationConsultant;
  reason?: string;
  index?: number;
  onChat: (id: string) => void;
}

export function ConsultantRecommendationCard({
  consultant,
  reason,
  index = 0,
  onChat,
}: Props) {
  const name =
    consultant.name || consultant.username || "Guide";
  const avatar = consultant.avatar_url ?? consultant.avatar ?? "";
  const rate = consultant.perMinuteRate ?? 0;
  const rating = consultant.rating ?? 0;
  const sparks = consultant.sparkScore ?? 0;
  const isOnline = consultant.is_online || consultant.isAI;
  const isFree = consultant.isAI && !consultant.isPaid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: "spring", stiffness: 200, damping: 22 }}
      className="glass-luxury rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
    >
      <span
        aria-hidden
        className={`absolute top-3 right-3 w-2 h-2 rounded-full ring-2 ring-slate-950/80 ${
          isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
        }`}
      />

      <div className="relative shrink-0">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/20 blur-md"
        />
        <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-[var(--color-luxury-gold)]/30">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white font-black text-sm">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {consultant.isAI && (
          <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-[7px] font-black flex items-center gap-0.5">
            <Sparkles className="w-2 h-2" /> AI
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm truncate">{name}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 truncate">
          {(consultant.category ?? "consultant").toString().toLowerCase().replace(/_/g, " ")}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
          {rating > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <Star size={10} className="fill-amber-400" />
              {rating.toFixed(1)}
            </span>
          )}
          {sparks > 0 && (
            <span className="text-orange-400">🔥 {sparks.toLocaleString()}</span>
          )}
          <span className="text-[var(--color-luxury-gold)] font-mono font-bold">
            {isFree ? "Free" : `₹${rate}/min`}
          </span>
          {isOnline && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Radio size={9} className="animate-pulse" /> Live
            </span>
          )}
        </div>

        {reason && (
          <p className="text-[11px] text-slate-400 mt-2 italic leading-snug line-clamp-2">
            {reason}
          </p>
        )}

        <button
          type="button"
          onClick={() => onChat(consultant.id)}
          className="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-black hover:opacity-95 active:scale-[0.98] transition-all"
        >
          Chat now →
        </button>
      </div>
    </motion.div>
  );
}
