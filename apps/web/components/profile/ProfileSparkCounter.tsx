"use client";
// Realtime spark counter with animated delta display
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface ProfileSparkCounterProps {
  userId: string;
  initialSparks: number;
}

export function ProfileSparkCounter({ userId, initialSparks }: ProfileSparkCounterProps) {
  const [sparks, setSparks] = useState(initialSparks);
  const [delta, setDelta] = useState<number | null>(null);

  // trg_broadcast_user_sparks wraps the trigger payload in `record` (the shape
  // safe_broadcast has always emitted), so reading the top level found nothing.
  useChannel<BroadcastChange<{ sparks?: number; delta?: number }>>({
    channel: channels.userSparks(userId),
    onMessage: (payload) => {
      const rec = payload?.record;
      if (typeof rec?.sparks === "number") setSparks(rec.sparks);
      if (typeof rec?.delta === "number" && rec.delta !== 0) {
        setDelta(rec.delta);
        setTimeout(() => setDelta(null), 3000);
      }
    },
  });

  const formatted = sparks >= 1000 ? `${(sparks / 1000).toFixed(1)}k` : sparks.toLocaleString("en-IN");

  return (
    <div className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-400/25">
      <Flame size={16} className="text-orange-400 animate-pulse" />
      <span className="text-lg font-black font-mono tabular-nums text-orange-400">
        {formatted}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">
        Sparks
      </span>
      <AnimatePresence>
        {delta !== null && (
          <motion.span
            key={delta}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: -12, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.6 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute -top-2 right-0 text-sm font-black text-emerald-400 whitespace-nowrap"
          >
            +{delta}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
