"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// BillingPanel — server-authoritative timer, cost, low-balance UX
// ─────────────────────────────────────────────────────────────────────────────
// The local 1s timer is a *display*. On every heartbeat (30s), the panel
// snaps to the server's elapsedSeconds. If they differ by > 5s, we silently
// correct.
//
// Low-balance transitions:
//   green  → > 3 min remaining
//   amber  → 1–3 min remaining (pulsing warning)
//   red    → < 1 min remaining (auto-terminate imminent)
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ChevronDown, ChevronUp, Clock, IndianRupee,
  Loader2, Radio, Square, Wallet,
} from "lucide-react";
import {
  HEARTBEAT_INTERVAL_SECONDS,
  type HeartbeatResult,
} from "@/lib/billing/types";

interface Props {
  sessionId: string;
  rate: number;
  onEnd: () => void;
  onTerminated?: (reason: string) => void;
}

type Tier = "healthy" | "amber" | "red" | "free";

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TIER_STYLE: Record<Tier, { border: string; bg: string; text: string; dot: string }> = {
  healthy: {
    border: "border-border",
    bg: "bg-surface",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.06]",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  red: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/[0.08]",
    text: "text-rose-400",
    dot: "bg-rose-500",
  },
  free: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.05]",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
};

export function BillingPanel({ sessionId, rate, onEnd, onTerminated }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cost, setCost] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [terminateReason, setTerminateReason] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [ready, setReady] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest callbacks live in refs so the heartbeat closure stays stable and the
  // 30s interval is never torn down/restarted on a parent re-render (typing
  // would otherwise fire a heartbeat storm and invite 429s).
  const onEndRef = useRef(onEnd);
  const onTerminatedRef = useRef(onTerminated);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onTerminatedRef.current = onTerminated; }, [onTerminated]);

  // Reset all display state when the session changes.
  useEffect(() => {
    setElapsedSeconds(0);
    setCost(0);
    setRemaining(0);
    setTerminateReason(null);
    setError(null);
    setReady(false);
  }, [sessionId]);

  // Local 1s timer
  useEffect(() => {
    tickRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const heartbeat = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as HeartbeatResult;
      if (typeof data.elapsedSeconds === "number") {
        // Snap local timer if it drifted
        setElapsedSeconds((local) => {
          if (Math.abs(local - data.elapsedSeconds!) > 5) return data.elapsedSeconds!;
          return local;
        });
      }
      if (typeof data.cost === "number") setCost(data.cost);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      setError(null);
      setReady(true);
      if (data.terminate && data.reason) {
        setTerminateReason(data.reason);
        onTerminatedRef.current?.(data.reason);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection issue");
    }
  }, [sessionId]);

  useEffect(() => {
    void heartbeat();
    hbRef.current = setInterval(
      () => { void heartbeat(); },
      HEARTBEAT_INTERVAL_SECONDS * 1000,
    );
    return () => { if (hbRef.current) clearInterval(hbRef.current); };
  }, [heartbeat]);

  const handleEnd = useCallback(async () => {
    setEnding(true);
    try {
      const res = await fetch("/api/billing/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "End failed");
      }
      onEndRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setEnding(false);
    }
  }, [sessionId]);

  const tier: Tier = rate === 0
    ? "free"
    : !ready
      ? "healthy"
      : remaining / Math.max(1, rate) <= 1
        ? "red"
        : remaining / Math.max(1, rate) <= 3
          ? "amber"
          : "healthy";

  const style = TIER_STYLE[tier];
  const minutesRemaining = rate > 0 ? Math.floor(remaining / rate) : Infinity;

  return (
    <div className={`flex-none border-b transition-colors ${style.border} ${style.bg}`}>
      <div className="px-3 md:px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs" role="status" aria-live="polite">
            <span className={`flex items-center gap-1 font-mono font-black ${style.text}`}>
              <Clock size={12} /> {fmtTime(elapsedSeconds)}
            </span>
            <span className="flex items-center gap-1 text-foreground font-mono font-black">
              <IndianRupee size={12} /> {cost.toFixed(2)}
            </span>
            {rate > 0 && (ready ? (
              <>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Wallet size={12} />
                  <span className="font-mono">{remaining.toFixed(0)}</span>
                </span>
                <span className={`flex items-center gap-1 font-black ${style.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                  {Number.isFinite(minutesRemaining)
                    ? `${minutesRemaining}m left`
                    : "∞"}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground font-black">
                <Loader2 size={11} className="animate-spin" /> Syncing…
              </span>
            ))}
            {rate === 0 && (
              <span className="flex items-center gap-1 text-emerald-400 font-black">
                <Radio size={10} className="animate-pulse" /> Free session
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-surface-raised transition-colors"
              aria-label="Toggle breakdown"
              aria-expanded={showBreakdown}
            >
              {showBreakdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button
              onClick={() => void handleEnd()}
              disabled={ending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-rose-500/10 hover:bg-rose-500/20
                         border border-rose-500/20
                         text-rose-400 text-xs font-black
                         transition-all disabled:opacity-50 active:scale-95"
            >
              {ending ? (
                <><Loader2 size={11} className="animate-spin" /> Ending…</>
              ) : (
                <><Square size={11} fill="currentColor" /> End Session</>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-2.5 border-t border-border/60 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                <Stat label="Rate" value={`₹${rate}/min`} />
                <Stat label="Elapsed" value={fmtTime(elapsedSeconds)} />
                <Stat label="Cost so far" value={`₹${cost.toFixed(2)}`} />
                <Stat label="Balance left" value={`₹${remaining.toFixed(2)}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(terminateReason || error || (ready && (tier === "amber" || tier === "red"))) && (
          <div className={`mt-2 text-[11px] font-bold flex items-center gap-1.5 ${
            terminateReason || error || tier === "red"
              ? "text-rose-400"
              : "text-amber-400"
          }`}>
            <AlertTriangle size={11} />
            {terminateReason
              ?? error
              ?? (Number.isFinite(minutesRemaining)
                ? `Low balance — ${minutesRemaining} minute(s) remaining.`
                : "Low balance")}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-widest text-muted-foreground font-black">{label}</p>
      <p className="text-foreground font-mono font-black mt-0.5">{value}</p>
    </div>
  );
}
