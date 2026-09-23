// ZEAL_PHASE1_V1
"use client";
// ZEAL_FIX_CARD_NORMALIZE

import Link from "next/link";
import { useState, memo, useCallback } from "react";
import { motion } from "framer-motion";
import type { ConsultantProfile } from "@zeal/types";
import { Badge, Button, cn } from "@zeal/ui";
import { useAppStoreShallow } from "@/lib/store/appStore";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, Sparkles, Star, Zap } from "lucide-react";

interface ConsultantCardProps {
  consultant: ConsultantProfile;
  variant?: "horizontal" | "vertical" | "compact";
  onChat?: (consultantId: string) => void;
  onBook?: (consultantId: string) => void;
  showActions?: boolean;
  priority?: boolean;
}

const ConsultantCard = memo(function ConsultantCard({
  consultant,
  variant = "vertical",
  onChat,
  onBook,
  showActions = true,
  priority = false,
}: ConsultantCardProps) {
  // ZEAL_FIX_CARD_NORMALIZE
  const _c = consultant as unknown as {
    avatar?: string | null;
    avatar_url?: string | null;
  };
  const _avatar = _c.avatar ?? _c.avatar_url ?? "";

  const router = useRouter();
  const { isAuthenticated } = useAppStoreShallow((state) => ({
    isAuthenticated: state.isAuthenticated,
  }));
  const [isLoading, setIsLoading] = useState(false);

  const isVertical = variant === "vertical";
  const isCompact = variant === "compact";
  const isAI = consultant.isAI === true;
  const isOnline = consultant.isOnline === true;

  const handleChat = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isAuthenticated) {
        router.push("/login?redirect=/explore");
        return;
      }

      // Offline human consultant: route to profile, never into chat.
      if (!isOnline && !isAI) {
        if (onChat) {
          onChat(consultant.id);
        } else {
          router.push(`/consultant/${consultant.id}`);
        }
        return;
      }

      setIsLoading(true);
      try {
        if (isAI) {
          router.push(`/ai-astrologers/${consultant.id}`);
        } else if (onChat) {
          await onChat(consultant.id);
        } else {
          router.push(`/consultant/${consultant.id}`);
        }
      } catch (err) {
        console.error("[ConsultantCard] chat failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, isOnline, isAI, onChat, consultant.id, router],
  );

  const handleBook = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isAI) {
        router.push(`/ai-astrologers/${consultant.id}`);
        return;
      }
      if (onBook) {
        onBook(consultant.id);
      } else {
        router.push(`/booking?consultantId=${consultant.id}`);
      }
    },
    [isAI, onBook, consultant.id, router],
  );

  const rating = consultant.rating || 4.5;
  const href = isAI
    ? `/ai-astrologers/${consultant.id}`
    : `/consultant/${consultant.id}`;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "glass-luxury glass-luxury-hover group relative overflow-hidden transition-all duration-300",
        isVertical ? "flex flex-col items-center text-center" : "flex items-start gap-4",
        isCompact ? "p-3" : "p-5",
        !isOnline && !isAI && "opacity-90",
      )}
    >
      {/* Holographic gradient border on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0
                   group-hover:opacity-100 transition-opacity duration-500
                   bg-gradient-to-br from-[var(--color-luxury-gold)]/10
                   via-transparent to-[#9D7DC5]/15"
      />

      {/* Online / offline indicator */}
      <span
        aria-hidden
        className={cn(
          "absolute top-3 right-3 z-10 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950/80",
          isAI || isOnline
            ? "bg-emerald-500 animate-pulse"
            : "bg-slate-500",
        )}
      />

      {/* AI badge */}
      {isAI && (
        <span className="absolute top-3 left-3 z-10 px-1.5 py-0.5 rounded-full
                         bg-gradient-to-r from-[#9D7DC5] to-[#533AFD]
                         text-white text-[8px] font-black tracking-wider
                         flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> AI
        </span>
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div
          className={cn(
            "relative rounded-full ring-2 ring-[var(--color-luxury-gold)]/30 p-1",
            isCompact ? "w-12 h-12" : "w-20 h-20",
          )}
        >
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/20 blur-md"
          />
          <img
            src={
              _avatar ||
              "https://ui-avatars.com/api/?name=U&background=9D7DC5&color=fff"
            }
            alt={consultant.name}
            className="relative w-full h-full rounded-full object-cover"
            loading={priority ? "eager" : "lazy"}
          />
        </div>

        {consultant.isVerified && !isAI && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                           bg-[var(--color-luxury-gold)] text-slate-950 text-[10px]
                           font-black flex items-center justify-center
                           border-2 border-slate-950">
            ✓
          </span>
        )}
      </div>

      <div className={cn("relative z-10 flex-1 min-w-0", isVertical ? "mt-3 w-full" : "mt-0")}>
        <Link href={href} className="block">
          <h3 className="font-bold text-white hover:text-[var(--color-luxury-gold)] transition-colors truncate">
            {consultant.name}
          </h3>
          <p className="text-xs text-slate-400 truncate">
            @{consultant.username}
          </p>
        </Link>

        <div className="flex items-center justify-center gap-2 mt-2 text-xs flex-wrap">
          <span className="inline-flex items-center gap-0.5 text-amber-400">
            <Star className="w-3 h-3 fill-amber-400" />
            {rating.toFixed(1)}
          </span>
          {typeof consultant.sparks === "number" && consultant.sparks > 0 && (
            <span className="inline-flex items-center gap-0.5 text-orange-400">
              <span aria-hidden>🔥</span>
              {consultant.sparks > 999
                ? `${(consultant.sparks / 1000).toFixed(1)}k`
                : consultant.sparks}
            </span>
          )}
          <span className="text-[var(--color-luxury-gold)] font-mono font-bold">
            {consultant.perMinuteRate === 0
              ? "Free"
              : `₹${consultant.perMinuteRate}/min`}
          </span>
        </div>

        {!isCompact &&
          consultant.specialties &&
          consultant.specialties.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mt-2">
              {consultant.specialties.slice(0, 2).map((s) => (
                <Badge key={s} variant="outline" className="text-[9px] px-1.5 py-0">
                  {s}
                </Badge>
              ))}
            </div>
          )}

        {!isCompact && !isAI && !isOnline && (
          <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest font-bold">
            Offline · View profile
          </p>
        )}

        {showActions && (
          <div className={cn("flex gap-2 mt-4", isVertical ? "flex-col w-full" : "flex-row")}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleChat}
              disabled={isLoading}
              className={cn(
                "flex-1 text-xs py-2 rounded-xl",
                isVertical && "w-full",
              )}
            >
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {isAI ? "Start chat" : isOnline ? "Chat now" : "View profile"}
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBook}
              className={cn(
                "flex-1 text-xs py-2 rounded-xl",
                isVertical && "w-full",
              )}
            >
              <Clock className="w-3 h-3 mr-1" />
              {isAI ? "View" : "Book"}
            </Button>
          </div>
        )}

        {isCompact && !showActions && (
          <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
        )}
      </div>
    </motion.div>
  );
});

export { ConsultantCard };
