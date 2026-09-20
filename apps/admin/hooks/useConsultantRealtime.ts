"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useConsultantRealtime — admin-side realtime for a specific consultant
// ═══════════════════════════════════════════════════════════════════════════════

import {useCallback, useEffect, useState} from "react";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";
import type { PulseStats } from "@/components/shared/PulseGrid";

interface IncomingAlert {
  id: string;
  type: "chat" | "call" | "booking";
  message: string;
  redirectUrl?: string;
  createdAt: string;
}

interface StatsPayload {
  totalBookings?: number;
  totalEarnings?: number;
  rating?: number;
  sparkScore?: number;
  liveSessions?: number;
  pendingBookings?: number;
}

interface SparksRow { sparkScore?: number; sparks?: number }
interface WalletRow { balance?: number }

export function useConsultantRealtime(consultantId: string | null) {
  const [pulse, setPulse] = useState<PulseStats | null>(null);
  const [alerts, setAlerts] = useState<IncomingAlert[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!consultantId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/consultants/${consultantId}/stats`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as StatsPayload;
        if (cancelled) return;
        setPulse({
          sessions: d.totalBookings ?? 0,
          earnings: d.totalEarnings ?? 0,
          rating: d.rating ?? 0,
          sparkScore: d.sparkScore ?? 0,
          liveSessions: d.liveSessions ?? 0,
          pendingBookings: d.pendingBookings ?? 0,
        });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [consultantId]);

  // Sparks channel
  useChannel<BroadcastChange<SparksRow>>({
    channel: consultantId ? channels.consultantSparks(consultantId) : null,
    event: "*",
    onMessage: (payload) => {
      const next = payload?.record?.sparkScore ?? payload?.record?.sparks;
      if (typeof next === "number") {
        setPulse((p) => (p ? { ...p, sparkScore: next } : p));
      }
    },
  });

  // Incoming channel
  useChannel<IncomingAlert>({
    channel: consultantId ? channels.consultantIncoming(consultantId) : null,
    event: "*",
    onMessage: (payload) => {
      const req = payload as IncomingAlert | null;
      if (req?.id) {
        setAlerts((prev) => [req, ...prev].slice(0, 10));
        setIsLive(true);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate?.([100, 50, 100]); } catch { /* ignore */ }
        }
      }
    },
  });

  // Wallet channel (earnings)
  useChannel<BroadcastChange<WalletRow>>({
    channel: consultantId ? channels.userWallet(consultantId) : null,
    event: "*",
    onMessage: (payload) => {
      const next = payload?.record?.balance;
      if (typeof next === "number") {
        setPulse((p) => (p ? { ...p, earnings: next } : p));
      }
    },
  });

  const refresh = useCallback(async () => {
    if (!consultantId) return;
    try {
      const r = await fetch(`/api/admin/consultants/${consultantId}/stats`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as StatsPayload;
      setPulse({
        sessions: d.totalBookings ?? 0,
        earnings: d.totalEarnings ?? 0,
        rating: d.rating ?? 0,
        sparkScore: d.sparkScore ?? 0,
        liveSessions: d.liveSessions ?? 0,
        pendingBookings: d.pendingBookings ?? 0,
      });
    } catch { /* ignore */ }
  }, [consultantId]);

  return { pulse, alerts, isLive, refresh };
}
