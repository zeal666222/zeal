"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// LuxuryConsultantCard — premium bubble card with 3D tilt
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { useCallback, useId, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Flame, MessageCircle, Radio, Sparkles, Star, Zap } from "lucide-react";
import type { ConsultantProfile } from "@zeal/types";
import { cn } from "@zeal/ui";

export interface LuxuryConsultantInput extends ConsultantProfile {
  lastSeenAt?: string | null;
  isPaid?: boolean;
}

interface Props {
  consultant: LuxuryConsultantInput;
  onChat?: (consultantId: string) => void;
  onBook?: (consultantId: string) => void;
  variant?: "default" | "compact";
  priority?: boolean;
}

type PresenceTone = "online" | "away" | "offline";
interface Presence { tone: PresenceTone; label: string }

const PRESENCE_WINDOW_AWAY_MS = 10 * 60 * 1000;

function derivePresence(c: LuxuryConsultantInput): Presence {
  if (c.isAI) return { tone: "online", label: "AI" };
  if (c.isOnline) return { tone: "online", label: "Online" };
  if (c.lastSeenAt) {
    const last = new Date(c.lastSeenAt).getTime();
    if (Number.isFinite(last) && Date.now() - last < PRESENCE_WINDOW_AWAY_MS) {
      return { tone: "away", label: "Away" };
    }
  }
  return { tone: "offline", label: "Offline" };
}

const PRESENCE_STYLE: Record<PresenceTone, { pill: string; dot: string }> = {
  online: {
    pill: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400 animate-pulse",
  },
  away: {
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  offline: {
    pill: "bg-surface-raised text-muted-foreground border border-border",
    dot: "bg-slate-500",
  },
};

export function LuxuryConsultantCard({
  consultant, onChat, onBook, variant = "default", priority = false,
}: Props) {
  const isCompact = variant === "compact";
  const headingId = useId();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawX, [-0.5, 0.5], [3, -3]), {
    stiffness: 260, damping: 20,
  });
  const rotateY = useSpring(useTransform(rawY, [-0.5, 0.5], [-3, 3]), {
    stiffness: 260, damping: 20,
  });

  const presence = useMemo(() => derivePresence(consultant), [consultant]);
  const style = PRESENCE_STYLE[presence.tone];

  const chatEnabled = Boolean(consultant.isAI || consultant.isOnline);
  const href = consultant.isAI
    ? `/ai-astrologers/${consultant.id}`
    : `/consultant/${consultant.id}`;

  const displayName = consultant.name || consultant.username || "Guide";
  const initial = displayName.charAt(0).toUpperCase();

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      rawY.set((e.clientX - rect.left) / rect.width - 0.5);
      rawX.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [rawX, rawY],
  );

  const handleLeave = useCallback(() => { rawX.set(0); rawY.set(0); }, [rawX, rawY]);

  const handleChat = useCallback(() => {
    if (!chatEnabled) return;
    onChat?.(consultant.id);
  }, [chatEnabled, consultant.id, onChat]);

  const handleBook = useCallback(() => { onBook?.(consultant.id); }, [consultant.id, onBook]);

  const rateLabel = consultant.perMinuteRate > 0 ? `₹${consultant.perMinuteRate}/min` : "Free";

  return (
    <motion.article
      aria-labelledby={headingId}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        "glass-luxury glass-luxury-hover",
        isCompact ? "p-4" : "p-5",
      )}
    >
      {/* Ambient hover gradient */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0
                   transition-opacity duration-500 group-hover:opacity-100
                   bg-gradient-to-br from-[var(--color-luxury-gold)]/[0.10]
                   via-transparent to-[var(--color-primary)]/[0.14]"
      />

      {/* Bubble blob */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full
                   bg-[var(--color-primary)]/[0.12] blur-[50px]"
        animate={{ scale: [1, 1.2, 1], x: [0, 6, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Presence pill */}
      <span
        aria-label={`Presence: ${presence.label}`}
        className={cn(
          "absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
          "text-[9px] font-black uppercase tracking-widest",
          style.pill,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
        {presence.label}
      </span>

      {consultant.isAI && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full
                         bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                         px-2 py-0.5 text-[9px] font-black tracking-wider text-white">
          <Zap size={10} aria-hidden /> AI
        </span>
      )}

      <div className="relative z-[1] flex flex-col items-center text-center">
        {/* Avatar with gradient ring */}
        <Link href={href} className="relative inline-block" aria-label={`View ${displayName}'s profile`}>
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/25
                       blur-xl transition-all group-hover:bg-[var(--color-luxury-gold)]/40"
          />
          <span className="relative block rounded-full p-[2px]
                           bg-gradient-to-br from-[var(--color-luxury-gold)]
                           via-transparent to-[var(--color-primary)]">
            <span className="block rounded-full bg-[var(--color-surface)] p-[2px]">
              {consultant.avatar ? (
                <img
                  src={consultant.avatar}
                  alt=""
                  loading={priority ? "eager" : "lazy"}
                  decoding="async"
                  className={cn(
                    "rounded-full object-cover",
                    isCompact ? "h-14 w-14" : "h-20 w-20",
                  )}
                />
              ) : (
                <span className={cn(
                  "flex items-center justify-center rounded-full",
                  "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]",
                  "font-black text-white",
                  isCompact ? "h-14 w-14 text-xl" : "h-20 w-20 text-2xl",
                )}>
                  {initial}
                </span>
              )}
            </span>
          </span>
        </Link>

        <Link href={href} className="mt-3 max-w-full">
          <h3
            id={headingId}
            className="truncate text-base font-bold text-foreground
                       transition-colors group-hover:text-[var(--color-luxury-gold)]"
          >
            {displayName}
          </h3>
          {consultant.username && (
            <p className="truncate text-[11px] text-muted-foreground font-mono">
              @{consultant.username}
            </p>
          )}
        </Link>

        {/* Metrics */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Star size={11} className="fill-amber-400" aria-hidden />
            {(consultant.rating || 0).toFixed(1)}
          </span>
          {typeof consultant.sparks === "number" && consultant.sparks > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Flame size={11} aria-hidden />
              {consultant.sparks.toLocaleString("en-IN")}
            </span>
          )}
          <span className="font-mono font-bold text-[var(--color-luxury-gold)]">
            {rateLabel}
          </span>
        </div>

        {/* Specialty chips */}
        {!isCompact && consultant.specialties && consultant.specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {consultant.specialties.slice(0, 2).map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-surface-raised
                           px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex w-full gap-2">
          <button
            type="button"
            onClick={handleChat}
            disabled={!chatEnabled}
            aria-label={
              consultant.isAI ? `Chat with ${displayName}`
                : consultant.isOnline ? `Start chat with ${displayName}`
                : `${displayName} is offline`
            }
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black",
              "transition-all",
              chatEnabled
                ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white hover:opacity-95 active:scale-[0.98]"
                : "cursor-not-allowed bg-surface-raised text-muted-foreground",
            )}
          >
            {consultant.isAI ? (
              <><Zap size={12} aria-hidden /> Chat</>
            ) : consultant.isOnline ? (
              <><MessageCircle size={12} aria-hidden /> Chat now</>
            ) : (
              <><Radio size={12} aria-hidden /> Offline</>
            )}
          </button>
          {!consultant.isAI && (
            <button
              type="button"
              onClick={handleBook}
              aria-label={`Book a session with ${displayName}`}
              className="rounded-xl border border-border bg-surface-raised
                         px-3 py-2.5 text-xs font-black text-foreground
                         transition-all hover:border-[var(--color-luxury-gold)]/40
                         hover:bg-surface-overlay"
            >
              Book
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
