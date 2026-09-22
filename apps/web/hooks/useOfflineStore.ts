"use client";
import { useEffect, useState } from "react";
import { getCacheStats } from "@/lib/chat/offline-store";

export function useOfflineStore() {
  const [stats, setStats] = useState<{
    conversations: number;
    totalMessages: number;
    approxBytes: number;
  } | null>(null);

  useEffect(() => {
    void getCacheStats().then(setStats);
  }, []);

  return stats;
}
