"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useAdminRealtime — Live admin stats + verification queue
// Subscribes to admin:broadcast via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface AdminStats {
  users: number;
  consultants: number;
  bookings: number;
  revenueToday: number;
  revenueMonth: number;
  liveSessions: number;
  pendingVerifications: number;
}

export interface PendingConsultant {
  id: string;
  category: string;
  bio: string | null;
  perMinuteRate: number;
  createdAt: string;
  user: { id: string; name: string | null; email: string; username: string; avatar: string | null };
}

export function useAdminRealtime(userId: string | null) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingConsultant[]>([]);
  const [isLive, setIsLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/verification", { cache: "no-store" }),
      ]);
      if (s.ok) setStats(await s.json());
      if (v.ok) {
        const data = (await v.json()) as { consultants?: PendingConsultant[] };
        setPending(data.consultants ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, [userId, refresh]);

  // Bookings channel — refresh stats
  useChannel<BroadcastChange>({
    channel: channels.adminBookings(),
    event: "*",
    onMessage: () => { void refresh(); },
  });

  // Verification channel — refresh queue
  useChannel<BroadcastChange>({
    channel: channels.adminVerification(),
    event: "*",
    onMessage: () => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/verification", { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { consultants?: PendingConsultant[] };
            setPending(data.consultants ?? []);
          }
        } catch { /* ignore */ }
      })();
      setIsLive(true);
    },
  });

  return { stats, pending, isLive, refresh };
}
