"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export interface RecommendationService {
  slug: string;
  name: string;
  icon: string;
  description: string;
}

interface Props {
  service: RecommendationService;
  reason?: string;
  index?: number;
}

export function ServiceRecommendationCard({
  service,
  reason,
  index = 0,
}: Props) {
  const router = useRouter();

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: "spring", stiffness: 200, damping: 22 }}
      onClick={() => router.push(`/services/${service.slug}`)}
      className="glass-luxury rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden text-left hover:border-[var(--color-luxury-gold)]/40 transition-all group"
    >
      <span
        aria-hidden
        className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-[8px] font-black flex items-center gap-0.5"
      >
        <Sparkles className="w-2 h-2" /> FREE
      </span>

      <div className="relative shrink-0">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/20 blur-md"
        />
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary-hover)]/20 border border-[var(--color-luxury-gold)]/30 flex items-center justify-center text-2xl">
          {service.icon}
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-16">
        <p className="font-bold text-foreground text-sm truncate group-hover:text-[var(--color-luxury-gold)] transition-colors">
          {service.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
          {service.description}
        </p>

        {reason && (
          <p className="text-[10px] text-muted-foreground mt-2 italic leading-snug line-clamp-2">
            {reason}
          </p>
        )}

        <div className="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-black text-center group-hover:opacity-95 active:scale-[0.98] transition-all">
          Try now →
        </div>
      </div>
    </motion.button>
  );
}
