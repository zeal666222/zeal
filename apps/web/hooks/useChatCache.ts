"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// useChatCache — IndexedDB write-through cache for chat
// ═══════════════════════════════════════════════════════════════════════════════
// • Cold-open read: returns cached messages instantly (before network)
// • Write-through: persists every message change, compressed
// • SSR-safe: no-ops on the server
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import {
  cacheConversation,
  getCachedMessages,
  clearConversationCache,
  type CachedMessage,
} from "@/lib/chat/offline-store";

interface UseChatCacheOptions {
  conversationId: string | null;
  messages: CachedMessage[];
  meta: {
    partnerId: string;
    partnerName: string;
    partnerAvatar: string | null;
    isAI: boolean;
  };
  /** Set to true once the network response has arrived. */
  networkLoaded: boolean;
}

export function useChatCache({
  conversationId,
  messages,
  meta,
  networkLoaded,
}: UseChatCacheOptions) {
  const [cached, setCached] = useState<CachedMessage[] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const attemptedRef = useRef(false);

  // Cold-open: read from IndexedDB on mount, before network
  useEffect(() => {
    if (!conversationId || attemptedRef.current) return;
    attemptedRef.current = true;

    void (async () => {
      const local = await getCachedMessages(conversationId);
      if (local && local.length > 0) {
        setCached(local);
      }
      setHydrated(true);
    })();
  }, [conversationId]);

  // Write-through: persist every change after the network has loaded
  useEffect(() => {
    if (!conversationId || !networkLoaded || messages.length === 0) return;
    void cacheConversation(conversationId, messages, meta);
  }, [conversationId, messages, meta, networkLoaded]);

  const clear = async () => {
    if (conversationId) await clearConversationCache(conversationId);
    setCached(null);
  };

  return {
    /** Messages from local cache (available before network). */
    cachedMessages: cached,
    /** True once we've attempted the cache read. */
    hydrated,
    /** Clear the local cache for this conversation. */
    clear,
  };
}
