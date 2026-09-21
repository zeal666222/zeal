"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// BillingPanel — live timer + cost + terminate warning
// Drives server-authoritative heartbeat every 30s. Client never sends amounts.
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock, IndianRupee, AlertTriangle, Square, Loader2, Wallet,
} from "lucide-react";
import { HEARTBEAT_INTERVAL_SECONDS } from "@/lib/billing/types";

interface Props {
  sessionId: string;
  rate: number;
  onEnd: () => void;
  onTerminated?: (reason: string) => void;
}

interface HeartbeatState {
  elapsedSeconds: number;
  minutesBilled: number;
  cost: number;
  remaining: number;
  terminate: boolean;
  reason?: string;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BillingPanel({ sessionId, rate, onEnd, onTerminated }: Props) {
  const [state, setState] = useState<HeartbeatState>({
    elapsedSeconds: 0, minutesBilled: 0, cost: 0, remaining: 0, terminate: false,
  });
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hbRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth 1-second local counter
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setState((s) => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 }));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
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
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as HeartbeatState;
      setState(data);
      setError(null);
      if (data.terminate && data.reason) onTerminated?.(data.reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection issue.");
    }
  }, [sessionId, onTerminated]);

  useEffect(() => {
    void heartbeat();
    hbRef.current = setInterval(() => { void heartbeat(); }, HEARTBEAT_INTERVAL_SECONDS * 1000);
    return () => {
      if (hbRef.current) clearInterval(hbRef.current);
    };
  }, [heartbeat]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      const res = await fetch("/api/billing/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "End failed");
      }
      onEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end session.");
      setEnding(false);
    }
  };

  const minutesRemaining = rate > 0 ? Math.floor(state.remaining / rate) : 999;
  const isWarning = minutesRemaining <= 2 && rate > 0;

  return (
    <div className={`flex-none px-3 md:px-4 py-2 border-b ${
      isWarning ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-900/60 border-white/10"
    }`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400 font-mono font-bold">
            <Clock size={12} /> {fmtTime(state.elapsedSeconds)}
          </span>
          <span className="flex items-center gap-1 text-purple-400 font-mono font-bold">
            <IndianRupee size={12} /> {state.cost.toFixed(2)}
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <Wallet size={12} />
            <span className="font-mono">{state.remaining.toFixed(0)}</span>
          </span>
          {rate > 0 && (
            <span className="text-slate-500">
              {minutesRemaining > 99 ? "∞" : `${minutesRemaining}m left`}
            </span>
          )}
          {rate === 0 && <span className="text-emerald-400">Free</span>}
        </div>

        <button
          onClick={handleEnd}
          disabled={ending}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold transition-all disabled:opacity-50"
        >
          {ending ? (
            <><Loader2 size={11} className="animate-spin" /> Ending…</>
          ) : (
            <><Square size={11} fill="currentColor" /> End Session</>
          )}
        </button>
      </div>

      {(isWarning || error) && (
        <div className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${
          isWarning ? "text-amber-400" : "text-rose-400"
        }`}>
          <AlertTriangle size={10} />
          {error ?? `Low balance — ${minutesRemaining} minute(s) remaining.`}
        </div>
      )}
    </div>
  );
}
