"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useAiConsultants — AI consultant list with realtime updates
// Subscribes to consultant:ai:updates via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface AiConsultant {
  id: string;
  name: string;
  username: string;
  avatar: string;
  category: string;
  isPaid: boolean;
  perMinuteRate: number;
  rating: number;
  totalConsultations: number;
  bio: string;
  specialties: string[];
  languages: string[];
  isActive: boolean;
  isFeatured: boolean;
  persona: string | null;
  gender: string | null;
  experience: number;
  sparks: number;
  model: string;
  voiceStyle: string | null;
}

export function useAiConsultants(category?: string) {
  const [consultants, setConsultants] = useState<AiConsultant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const url = category
        ? `/api/ai/consultants?category=${encodeURIComponent(category)}`
        : "/api/ai/consultants";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: AiConsultant[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items) ? data.items : [];
      if (mountedRef.current) setConsultants(items);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const { isLive } = useChannel<BroadcastChange<AiConsultant>>({
    channel: channels.consultantAiUpdates(),
    event: "*",
    onMessage: (payload) => {
      if (!mountedRef.current) return;
      const type = payload?.type;
      const record = payload?.record;
      const old = payload?.old_record;

      if (type === "INSERT" && record) {
        if (!record.isActive) return;
        setConsultants((prev) => prev.some((c) => c.id === record.id) ? prev : [record, ...prev]);
      } else if (type === "UPDATE" && record) {
        setConsultants((prev) => {
          const exists = prev.some((c) => c.id === record.id);
          if (record.isActive && !exists) return [record, ...prev];
          if (!record.isActive && exists) return prev.filter((c) => c.id !== record.id);
          return prev.map((c) => (c.id === record.id ? record : c));
        });
      } else if (type === "DELETE" && old?.id) {
        setConsultants((prev) => prev.filter((c) => c.id !== old.id));
      }
    },
  });

  return { consultants, isLoading, error, refresh: load, isRealtime: isLive };
}
