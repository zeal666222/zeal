"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// useRealtimeQuery — React Query + Supabase Realtime bridge
// ─────────────────────────────────────────────────────────────────────────────
// Generic hook that:
//   • Fetches via React Query (caching, dedup, background refetch)
//   • Subscribes to a Supabase Realtime channel
//   • On broadcast: either patches cache (updater) or invalidates (default)
//
// Reference: supabase-realtime-query, @zuiio/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useChannel, type BroadcastChange } from "@zeal/realtime";
import { useCallback } from "react";

interface Options<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  channel: string | null;
  event?: string;
  /** Optional in-place cache patch. If omitted, invalidates queryKey on message. */
  updater?: (old: T | undefined, payload: BroadcastChange<unknown>) => T | undefined;
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

export function useRealtimeQuery<T>({
  queryKey,
  queryFn,
  channel,
  event = "*",
  updater,
  enabled = true,
  staleTime = 30_000,
  refetchInterval = false,
}: Options<T>): UseQueryResult<T, Error> & { isLive: boolean } {
  const qc = useQueryClient();

  const query = useQuery<T, Error>({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const handleMessage = useCallback(
    (payload: BroadcastChange<unknown>) => {
      if (updater) {
        qc.setQueryData<T | undefined>(queryKey, (old) => updater(old, payload));
      } else {
        void qc.invalidateQueries({ queryKey });
      }
    },
    [qc, queryKey, updater],
  );

  const { isLive } = useChannel<BroadcastChange<unknown>>({
    channel: channel && enabled ? channel : null,
    event,
    onMessage: handleMessage,
  });

  return Object.assign(query, { isLive });
}
