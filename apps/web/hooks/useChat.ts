"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useChat — Conversation messages with realtime + optimistic sends
// Subscribes to room:{id}:messages via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import {useCallback, useEffect, useRef, useState} from "react";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";

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

interface MessageRow {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  content?: string;
  type?: string;
  createdAt?: string;
}

interface UseChatOptions {
  conversationId: string | null;
  currentUserId: string;
  pageSize?: number;
}

export function useChat({
  conversationId,
  currentUserId,
  pageSize = 50,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const seenIds = useRef<Set<string>>(new Set());

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

    fetch(`/api/chat/${conversationId}/messages?limit=${pageSize}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { messages?: ChatMessage[] }) => {
        if (cancelled) return;
        const list = data.messages ?? [];
        list.forEach((m) => seenIds.current.add(m.id));
        setMessages(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [conversationId, pageSize, reloadKey]);

  // ─── Realtime ─────────────────────────────────────────────────────────────
  useChannel<BroadcastChange<MessageRow>>({
    channel: conversationId ? channels.roomMessages(conversationId) : null,
    event: "*",
    onMessage: (payload) => {
      if (payload?.type !== "INSERT") return;
      const record = payload.record;
      if (!record?.id || !record.content) return;
      if (seenIds.current.has(record.id)) return;
      seenIds.current.add(record.id);

      const incoming: ChatMessage = {
        id: record.id,
        conversationId: record.conversationId ?? conversationId ?? "",
        senderId: record.senderId ?? null,
        content: record.content,
        type: record.type ?? "text",
        createdAt: record.createdAt ?? new Date().toISOString(),
      };

      setMessages((prev) => {
        const cleaned = prev.filter(
          (m) => !(m._optimistic && m.content === incoming.content && m.senderId === incoming.senderId),
        );
        return [...cleaned, incoming].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    },
  });

  // ─── send (user-to-user) ──────────────────────────────────────────────────
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
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }
        const { message } = (await res.json()) as { message: ChatMessage };
        if (message?.id) seenIds.current.add(message.id);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...message, _optimistic: false } : m)));
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(err instanceof Error ? err.message : "Failed to send");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId],
  );

  // ─── sendToAI (streaming) ─────────────────────────────────────────────────
  const sendToAI = useCallback(
    async (consultantId: string, content: string, onDelta: (acc: string) => void) => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId || !consultantId) return;

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
        const res = await fetch(`/api/chat/ai/${consultantId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, content: trimmed }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) { acc += delta; onDelta(acc); }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(err instanceof Error ? err.message : "AI chat failed");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId],
  );

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  return { messages, isLoading, isSending, error, send, sendToAI, retry };
}
