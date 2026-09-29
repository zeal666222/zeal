"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// PerMinuteBilling — DEPRECATED shim
// ─────────────────────────────────────────────────────────────────────────────
// Kept for backward compatibility. New code should use BillingPanel directly.
// ═══════════════════════════════════════════════════════════════════════════════

import { BillingPanel } from "@/components/session/BillingPanel";

interface LegacyProps {
  ratePerMinute: number;
  onStart: () => void;
  onEnd: () => void;
  isActive: boolean;
  sessionId?: string;
}

export function PerMinuteBilling({
  ratePerMinute, onStart, onEnd, isActive, sessionId,
}: LegacyProps) {
  if (!isActive || !sessionId) {
    return (
      <div className="p-4 rounded-2xl bg-surface border border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Per-minute billing
          </span>
          <span className="text-sm font-black font-mono text-foreground">
            ₹{ratePerMinute}/min
          </span>
        </div>
        <button
          onClick={onStart}
          className="mt-3 w-full py-2.5 rounded-xl
                     bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                     text-white text-sm font-black transition-all active:scale-95"
        >
          Start Session
        </button>
      </div>
    );
  }
  return (
    <BillingPanel
      sessionId={sessionId}
      rate={ratePerMinute}
      onEnd={onEnd}
    />
  );
}
