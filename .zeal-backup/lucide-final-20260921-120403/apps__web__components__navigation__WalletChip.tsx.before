"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// WalletChip — realtime balance with animated delta badge
// ─────────────────────────────────────────────────────────────────────────────
// Subscribes to channels.userWallet(uid). On change, flashes the border and
// shows a floating +/-N badge. The initial balance prop only resets the chip
// when it genuinely changes — realtime updates are not clobbered by parent
// re-renders.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { IndianRupee, TrendingUp, TrendingDown } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { cn } from "@zeal/ui";

interface Props {
  userId: string | null;
  initialBalance: number;
  className?: string;
}

interface WalletRow { balance?: number; }

export function WalletChip({ userId, initialBalance, className }: Props) {
  const [balance, setBalance] = useState(initialBalance);
  const [delta, setDelta] = useState<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const prevInitRef = useRef(initialBalance);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only reset from prop when the prop genuinely changed
  useEffect(() => {
    if (prevInitRef.current !== initialBalance) {
      prevInitRef.current = initialBalance;
      setBalance(initialBalance);
    }
  }, [initialBalance]);

  useChannel<BroadcastChange<WalletRow>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: (payload) => {
      const next = payload?.record?.balance;
      if (typeof next !== "number") return;

      setBalance((prev) => {
        const diff = next - prev;
        if (diff !== 0) {
          setDelta(diff);
          setFlash(diff > 0 ? "up" : "down");
          if (deltaTimer.current) clearTimeout(deltaTimer.current);
          deltaTimer.current = setTimeout(() => setDelta(null), 2600);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(null), 1400);
        }
        return next;
      });
    },
  });

  useEffect(
    () => () => {
      if (deltaTimer.current) clearTimeout(deltaTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const Icon =
    flash === "up" ? TrendingUp : flash === "down" ? TrendingDown : IndianRupee;

  return (
    <Link
      href="/wallet"
      className={cn(
        "relative inline-flex items-center gap-1.5 pl-3 pr-3.5 h-9 rounded-full",
        "text-[var(--color-foreground)] font-bold text-sm tabular-nums",
        "bg-[var(--color-surface-raised)] border transition-all duration-300",
        "hover:scale-[1.03] active:scale-[0.97]",
        flash === "up" &&
          "border-emerald-500/40 shadow-[0_0_20px_-4px_rgb(16_185_129/0.5)]",
        flash === "down" &&
          "border-rose-500/40 shadow-[0_0_20px_-4px_rgb(244_63_94/0.5)]",
        !flash && "border-[var(--color-border)]",
        className,
      )}
      aria-label={`Wallet balance ₹${balance.toFixed(2)}`}
    >
      <motion.span
        animate={flash ? { scale: [1, 1.25, 1] } : undefined}
        transition={{ duration: 0.35 }}
        className={cn(
          "inline-flex items-center justify-center",
          flash === "up" && "text-emerald-500",
          flash === "down" && "text-rose-500",
          !flash && "text-[var(--color-primary)]",
        )}
      >
        <Icon size={13} />
      </motion.span>

      <span className="font-mono">
        {balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </span>

      <AnimatePresence>
        {delta !== null && (
          <motion.span
            key={delta}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.85 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className={cn(
              "absolute -top-1 right-0 px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono",
              delta > 0
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40"
                : "bg-rose-500 text-white shadow-md shadow-rose-500/40",
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(0)}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
