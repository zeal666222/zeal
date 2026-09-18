// apps/admin/hooks/useChat.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  createdAt: string;
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

export function useChat({ conversationId, currentUserId, pageSize = 50 }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

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

    fetch(`/api/consultant/chat/${conversationId}/messages?limit=${pageSize}`, { cache: "no-store" })
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
  }, [conversationId, pageSize]);

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

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return;

      const tempId = `tmp-${Date.now()}`;
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
        const res = await fetch(`/api/consultant/chat/${conversationId}/messages`, {
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

  return { messages, isLoading, isSending, error, send };
}
