"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useConsultants — Human consultant list with realtime updates
// Subscribes to consultants:live via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface Consultant {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  category: string;
  isVerified: boolean;
  isOnline: boolean;
  perMinuteRate: number;
  rating: number;
  totalConsultations: number;
  languages: string[];
  specialties: string[];
  faith: string;
  subdomain: string | null;
}

interface ConsultantRow {
  id?: string;
  status?: string;
  isActive?: boolean;
}

export function useConsultants(category?: string) {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const url = category
        ? `/api/explore/consultants?category=${encodeURIComponent(category)}`
        : "/api/explore/consultants";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: Consultant[] = Array.isArray(data) ? data
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

  useChannel<BroadcastChange<ConsultantRow>>({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: () => {
      // Any change → refetch (simplest correct behavior for list view)
      void load();
    },
  });

  return { consultants, isLoading, error, refresh: load };
}
