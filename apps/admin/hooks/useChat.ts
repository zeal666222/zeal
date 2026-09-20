"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin useChat — human + AI conversations
// ═══════════════════════════════════════════════════════════════════════════════
// Enterprise patterns:
//   • Discriminated-union return type: every method is always defined
//   • AbortController for mid-stream cancellation
//   • Optimistic user message with dedup against realtime INSERT
//   • Streaming callback typed as (accumulated: string) => void
//   • LRU seen-ID set prevents duplicate renders
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useChannel, channels } from "@zeal/realtime";
import type { BroadcastChange, ChatMessage } from "@/types/chat";

export type { ChatMessage };

interface Row {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  content?: string;
  type?: string;
  createdAt?: string;
}

export interface UseChatOptions {
  conversationId: string | null;
  currentUserId: string;
  pageSize?: number;
}

export interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  isStreaming: boolean;
  error: string | null;
  /** Send a message to a human partner. */
  send: (content: string) => Promise<void>;
  /** Send a message to an AI consultant with streaming deltas. */
  sendToAI: (
    consultantId: string,
    content: string,
    onDelta: (accumulated: string) => void,
  ) => Promise<void>;
  /** Cancel an in-flight AI stream. */
  cancelStream: () => void;
  /** Retry the last user message (if any). */
  retry: () => Promise<void>;
}

const MAX_SEEN = 500;

export function useChat({
  conversationId,
  currentUserId,
  pageSize = 50,
}: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seenIds = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const lastSentRef = useRef<{ content: string; consultantId?: string } | null>(null);

  // ─── Initial fetch ────────────────────────────────────────────────────────
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

    fetch(
      `/api/consultant/chat/${conversationId}/messages?limit=${pageSize}`,
      { cache: "no-store" },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { messages?: ChatMessage[] }) => {
        if (cancelled) return;
        const list = d.messages ?? [];
        list.forEach((m) => seenIds.current.add(m.id));
        setMessages(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, pageSize]);

  // ─── Realtime subscribe (dedupe INSERTs) ──────────────────────────────────
  useChannel<BroadcastChange<Row>>({
    channel: conversationId ? channels.roomMessages(conversationId) : null,
    event: "*",
    onMessage: (p) => {
      if (p?.type !== "INSERT") return;
      const r = p.record;
      if (!r?.id || !r.content) return;
      if (seenIds.current.has(r.id)) return;
      seenIds.current.add(r.id);

      if (seenIds.current.size > MAX_SEEN) {
        const arr = Array.from(seenIds.current);
        seenIds.current = new Set(arr.slice(-250));
      }

      const incoming: ChatMessage = {
        id: r.id,
        conversationId: r.conversationId ?? conversationId ?? "",
        senderId: r.senderId ?? null,
        content: r.content,
        type: r.type ?? "text",
        createdAt: r.createdAt ?? new Date().toISOString(),
      };

      setMessages((prev) => {
        const cleaned = prev.filter(
          (m) =>
            !(
              m._optimistic &&
              m.content === incoming.content &&
              m.senderId === incoming.senderId
            ),
        );
        return [...cleaned, incoming].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
      });
    },
  });

  // ─── send (human → human) ─────────────────────────────────────────────────
  const send = useCallback(
    async (content: string): Promise<void> => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return;

      lastSentRef.current = { content: trimmed };

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

      setMessages((p) => [...p, optimistic]);
      setIsSending(true);
      setError(null);

      try {
        const r = await fetch(
          `/api/consultant/chat/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: trimmed }),
          },
        );
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(
            (b as { error?: string })?.error || `HTTP ${r.status}`,
          );
        }
        const { message } = (await r.json()) as { message: ChatMessage };
        if (message?.id) seenIds.current.add(message.id);
        setMessages((p) =>
          p.map((m) =>
            m.id === tempId ? { ...message, _optimistic: false } : m,
          ),
        );
      } catch (e: unknown) {
        setMessages((p) => p.filter((m) => m.id !== tempId));
        setError(e instanceof Error ? e.message : "send failed");
        throw e;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId],
  );

  // ─── sendToAI (human → AI, streaming) ─────────────────────────────────────
  const sendToAI = useCallback(
    async (
      consultantId: string,
      content: string,
      onDelta: (accumulated: string) => void,
    ): Promise<void> => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId || !consultantId) return;

      lastSentRef.current = { content: trimmed, consultantId };

      // Cancel any previous stream
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

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

      setMessages((p) => [...p, optimistic]);
      setIsSending(true);
      setIsStreaming(true);
      setError(null);

      try {
        const res = await fetch(`/api/chat/ai/${consultantId}`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, content: trimmed }),
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string })?.error || `HTTP ${res.status}`,
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as { delta?: string };
              if (parsed.delta) {
                acc += parsed.delta;
                onDelta(acc);
              }
            } catch {
              /* malformed SSE chunk — safe to skip */
            }
          }
        }

        // Mark the optimistic user message as delivered; the assistant
        // message will arrive via the realtime channel.
        setMessages((p) =>
          p.map((m) => (m.id === tempId ? { ...m, _optimistic: false } : m)),
        );
      } catch (e: unknown) {
        // Ignore abort errors — user cancelled intentionally
        const msg = e instanceof Error ? e.message : "ai failed";
        if (!msg.toLowerCase().includes("abort")) {
          setMessages((p) => p.filter((m) => m.id !== tempId));
          setError(msg);
        }
        throw e;
      } finally {
        setIsSending(false);
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, currentUserId],
  );

  // ─── cancelStream ─────────────────────────────────────────────────────────
  const cancelStream = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // ─── retry ────────────────────────────────────────────────────────────────
  const retry = useCallback(async (): Promise<void> => {
    const last = lastSentRef.current;
    if (!last) return;
    if (last.consultantId) {
      await sendToAI(last.consultantId, last.content, () => {});
    } else {
      await send(last.content);
    }
  }, [send, sendToAI]);

  return {
    messages,
    isLoading,
    isSending,
    isStreaming,
    error,
    send,
    sendToAI,
    cancelStream,
    retry,
  };
}
