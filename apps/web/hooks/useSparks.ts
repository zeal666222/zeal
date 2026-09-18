"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useSparks — Real-time spark counter (aggregate social proof)
// Subscribes to consultant:{uid}:sparks via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface SparksRow {
  sparkScore?: number;
  sparks?: number;
}

export function useSparks(userId: string | null, initialSparks = 0) {
  const [sparks, setSparks] = useState(initialSparks);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const deltaTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    setSparks(initialSparks);
  }, [userId, initialSparks]);

  useChannel<BroadcastChange<SparksRow>>({
    channel: userId ? channels.consultantSparks(userId) : null,
    event: "*",
    onMessage: (payload) => {
      const row = payload?.record;
      const next = row?.sparkScore ?? row?.sparks;
      if (typeof next !== "number") return;
      setSparks((prev) => {
        const delta = next - prev;
        if (delta !== 0) {
          setLastDelta(delta);
          if (deltaTimerRef.current) window.clearTimeout(deltaTimerRef.current);
          deltaTimerRef.current = window.setTimeout(() => setLastDelta(null), 4000);
        }
        return next;
      });
    },
  });

  useEffect(() => () => {
    if (deltaTimerRef.current) window.clearTimeout(deltaTimerRef.current);
  }, []);

  return { sparks, lastDelta, setSparks };
}
