// apps/web/hooks/useChat.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Real-Time Chat Hook
// Uses Supabase Realtime Broadcast (6ms vs 46ms postgres_changes)
// ═══════════════════════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@zeal/database";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  _optimistic?: boolean;
}

interface UseChatOptions {
  conversationId: string | null;
  currentUserId: string;
  pageSize?: number;
}

interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  retry: () => void;
}

export function useChat({
  conversationId,
  currentUserId,
  pageSize = 50,
}: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const seenIds = useRef<Set<string>>(new Set());
  const supabaseRef = useRef<ReturnType<typeof getBrowserClient> | null>(null);

  if (!supabaseRef.current && typeof window !== "undefined") {
    try {
      supabaseRef.current = getBrowserClient();
    } catch {
      // env missing — hook will no-op gracefully
    }
  }

  // Initial fetch
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    seenIds.current = new Set();

    fetch(`/api/chat/${conversationId}/messages?limit=${pageSize}`, {
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { messages?: ChatMessage[] }) => {
        if (cancelled) return;
        const list = data.messages ?? [];
        list.forEach((m) => seenIds.current.add(m.id));
        setMessages(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load messages");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, pageSize, reloadKey]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const channel = supabase
      .channel(`room:${conversationId}:messages`, {
        config: { private: false, broadcast: { self: false } },
      })
      .on("broadcast", { event: "*" }, (payload: any) => {
        const record = (payload as { payload?: { record?: ChatMessage } })
          .payload?.record;
        if (!record || !record.id) return;
        if (seenIds.current.has(record.id)) return;
        seenIds.current.add(record.id);

        setMessages((prev) =>
          [...prev, record].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Send with optimistic update
  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return;

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        conversationId,
        senderId: currentUserId,
        content: trimmed,
        type: "text",
        createdAt: new Date().toISOString(),
        _optimistic: true,
      };

      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);
      setError(null);

      try {
        const res = await fetch(`/api/chat/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || `HTTP ${res.status}`);
        }

        const { message } = (await res.json()) as { message: ChatMessage };
        if (message?.id) seenIds.current.add(message.id);

        // RACE FIX: remove any existing message with same real ID
        // (broadcast may have arrived before POST response)
        setMessages((prev) => {
          const withoutReal = prev.filter((m) => m.id !== message.id);
          return withoutReal.map((m) => (m.id === tempId ? message : m));
        });

      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        const msg = err instanceof Error ? err.message : "Failed to send";
        setError(msg);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId]
  );

  const retry = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { messages, isLoading, isSending, error, send, retry };
}
