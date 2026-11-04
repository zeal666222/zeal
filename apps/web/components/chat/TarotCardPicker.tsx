"use client";
// TarotCardPicker — animated card reveal in chat.
// Cards start face-down; user taps to flip. After all flips, a shimmer
// confirms the reading is complete. The AI's text interpretation streams
// in below as a normal message bubble.

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@zeal/ui";

export interface TarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: string;
  symbol: string;
  keywords: string[];
  upright: string;
  reversed: string;
  guidance: string;
  isReversed: boolean;
  position: string;
}

interface TarotCardPickerProps {
  spreadName: string;
  cards: TarotCard[];
  onAllRevealed?: () => void;
}

const CARD_BACK_GRADIENT = "from-indigo-900 via-purple-900 to-indigo-950";
const CARD_FRONT_GRADIENT = "from-amber-50 to-orange-50";

function CardFace({ card, revealed, index, onReveal }: {
  card: TarotCard;
  revealed: boolean;
  index: number;
  onReveal: (idx: number) => void;
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 30, rotateY: 180 }}
      animate={{ opacity: 1, y: 0, rotateY: revealed ? 0 : 180 }}
      transition={{
        delay: index * 0.12,
        type: "spring",
        stiffness: 260,
        damping: 24,
      }}
      onClick={() => !revealed && onReveal(index)}
      className={cn(
        "relative w-20 h-32 md:w-24 md:h-36 rounded-xl cursor-pointer",
        "transform-gpu transition-shadow duration-300",
        revealed
          ? "shadow-lg shadow-amber-500/20"
          : "shadow-md shadow-purple-500/10 hover:shadow-lg hover:shadow-purple-500/20",
      )}
      style={{ perspective: 1000 }}
      disabled={revealed}
      aria-label={revealed ? `${card.name} — ${card.position}` : `Tap to reveal card ${index + 1}`}
    >
      <motion.div
        animate={{ rotateY: revealed ? 0 : 180 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="absolute inset-0 rounded-xl"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Back face */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl bg-gradient-to-br flex items-center justify-center",
            CARD_BACK_GRADIENT,
            "border border-purple-400/30",
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute inset-2 rounded-lg border border-amber-400/20" />
          <motion.span
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="text-3xl md:text-4xl"
          >
            ✦
          </motion.span>
          <span className="absolute bottom-2 text-[9px] font-bold text-amber-200/40 uppercase tracking-widest">
            Tap to reveal
          </span>
        </div>

        {/* Front face */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl bg-gradient-to-br flex flex-col items-center justify-center p-2",
            CARD_FRONT_GRADIENT,
            "border border-amber-400/40",
          )}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700/60 mb-0.5">
            {card.position}
          </span>
          <span className={cn("text-2xl md:text-3xl mb-1", card.isReversed && "rotate-180")}>
            {card.symbol}
          </span>
          <span className="text-[10px] md:text-xs font-bold text-center text-amber-900 leading-tight">
            {card.name}
          </span>
          {card.isReversed && (
            <span className="text-[8px] font-bold text-red-500/70 mt-0.5 uppercase">
              Reversed
            </span>
          )}
          <span className="text-[8px] text-amber-700/50 mt-0.5 capitalize">
            {card.arcana === "major" ? "Major Arcana" : card.suit}
          </span>
        </div>
      </motion.div>
    </motion.button>
  );
}

function RevealedCardDetail({ card, index }: { card: TarotCard; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index, type: "spring", stiffness: 300, damping: 25 }}
      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/5 border border-amber-500/10"
    >
      <span className={cn("text-lg shrink-0 mt-0.5", card.isReversed && "rotate-180")}>
        {card.symbol}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-amber-100">{card.position}:</span>
          <span className="text-xs font-semibold text-amber-200/80">{card.name}</span>
          {card.isReversed && (
            <span className="text-[9px] font-bold text-red-400/70 px-1 py-0.5 rounded bg-red-500/10 uppercase">
              Reversed
            </span>
          )}
        </div>
        <p className="text-[11px] text-amber-100/60 mt-0.5 leading-relaxed">
          {card.isReversed ? card.reversed : card.upright}
        </p>
      </div>
    </motion.div>
  );
}

export function TarotCardPicker({ spreadName, cards, onAllRevealed }: TarotCardPickerProps) {
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const allRevealed = revealedIndices.size === cards.length;

  const handleReveal = useCallback((idx: number) => {
    setRevealedIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === cards.length) {
        setTimeout(() => onAllRevealed?.(), 400);
      }
      return next;
    });
  }, [cards.length, onAllRevealed]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col gap-3 py-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <motion.span
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="text-base"
        >
          🔮
        </motion.span>
        <span className="text-xs font-bold text-amber-200/80 uppercase tracking-wider">
          {spreadName}
        </span>
        {!allRevealed && (
          <span className="text-[10px] text-amber-100/40 ml-auto">
            {revealedIndices.size}/{cards.length} revealed
          </span>
        )}
      </div>

      {/* Cards row */}
      <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap px-1">
        {cards.map((card, i) => (
          <CardFace
            key={card.id}
            card={card}
            revealed={revealedIndices.has(i)}
            index={i}
            onReveal={handleReveal}
          />
        ))}
      </div>

      {/* Revealed details */}
      <AnimatePresence>
        {allRevealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-1 pt-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
              <span className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">
                Your Reading
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
            </div>
            {cards.map((card, i) => (
              <RevealedCardDetail key={card.id} card={card} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* All revealed shimmer */}
      <AnimatePresence>
        {allRevealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-300/80 uppercase tracking-wider">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                ✦
              </motion.span>
              Cards revealed — reading in progress
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              >
                ✦
              </motion.span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
