"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useChat — Conversation messages with realtime + optimistic sends
// Liveness sources (merged, deduped by message id):
//   1. room:{id}:messages broadcast channel (@zeal/realtime)
//   2. AI SSE stream events (userMessageId / delta / filler / done+message)
//   3. Background poll (guaranteed fallback if broadcasts are unavailable)
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

/** Result of auto_start_chat_billing, surfaced by send()/sendToAI(). */
export interface BillingInfo {
  success: boolean;
  sessionId?: string;
  rate?: number;
  isAI?: boolean;
  free?: boolean;
  reused?: boolean;
  error?: string;
  required?: number;
  available?: number;
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
  /** Background poll interval in ms. 0 disables polling. */
  pollMs?: number;
}

export function useChat({
  conversationId,
  currentUserId,
  pageSize = 50,
  pollMs = 15_000,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const seenIds = useRef<Set<string>>(new Set());

  const mergeIncoming = useCallback((incoming: ChatMessage) => {
    if (seenIds.current.has(incoming.id)) return;
    seenIds.current.add(incoming.id);
    setMessages((prev) => {
      const cleaned = prev.filter(
        (m) => !(m._optimistic && m.content === incoming.content && m.senderId === incoming.senderId),
      );
      return [...cleaned, incoming].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, []);

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

        // ─── IndexedDB write-through ─────────────────────────────────────
        // Persist every server-originated load so cold-open is instant.
        void (async () => {
          try {
            const { cacheConversation } = await import("@/lib/chat/offline-store");
            await cacheConversation(
              conversationId,
              list as never,
              { partnerId: "", partnerName: "", partnerAvatar: null, isAI: false },
            );
          } catch { /* cache failure is non-fatal */ }
        })();
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [conversationId, pageSize, reloadKey]);

  // ─── Realtime broadcast ───────────────────────────────────────────────────
  useChannel<BroadcastChange<MessageRow>>({
    channel: conversationId ? channels.roomMessages(conversationId) : null,
    event: "*",
    onMessage: (payload) => {
      if (payload?.type !== "INSERT") return;
      const record = payload.record;
      if (!record?.id || !record.content) return;
      mergeIncoming({
        id: record.id,
        conversationId: record.conversationId ?? conversationId ?? "",
        senderId: record.senderId ?? null,
        content: record.content,
        type: record.type ?? "text",
        createdAt: record.createdAt ?? new Date().toISOString(),
      });
    },
  });

  // ─── Background poll fallback ─────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || pollMs <= 0) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/chat/${conversationId}/messages?limit=${pageSize}`, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as { messages?: ChatMessage[] };
        for (const m of data.messages ?? []) {
          if (!cancelled && m.id && !seenIds.current.has(m.id)) mergeIncoming(m);
        }
      } catch { /* transient — retry on next tick */ }
    };
    const id = setInterval(() => { void tick(); }, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [conversationId, pageSize, pollMs, mergeIncoming]);

  // ─── send (user-to-user) ──────────────────────────────────────────────────
  const send = useCallback(
    async (content: string): Promise<{ billing?: BillingInfo } | undefined> => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return undefined;

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
        if (res.status === 402) {
          // Blocked by the billing gate: the message was NOT persisted. Drop the
          // optimistic bubble and hand the wallet-gate info back to the caller.
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return {
            billing: (body.billing as BillingInfo) ?? {
              success: false,
              error: "insufficient_balance",
              required: Number(body.required ?? 0),
              available: Number(body.available ?? 0),
            },
          };
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }
        const { message, billing } = (await res.json()) as {
          message: ChatMessage;
          billing?: BillingInfo;
        };
        if (message?.id) {
          seenIds.current.add(message.id);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...message, _optimistic: false } : m)));
        }
        return { billing };
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
  interface SendToAIHandlers {
    onDelta: (acc: string) => void;
    onFiller?: (filler: string) => void;
    onBilling?: (billing: BillingInfo) => void;
  }

  const sendToAI = useCallback(
    async (consultantId: string, content: string, handlers: SendToAIHandlers | ((acc: string) => void)) => {
      const onDelta = typeof handlers === "function" ? handlers : handlers.onDelta;
      const onFiller = typeof handlers === "function" ? undefined : handlers.onFiller;
      const onBilling = typeof handlers === "function" ? undefined : handlers.onBilling;

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
          const body = await res.json().catch(() => ({})) as {
            error?: string; code?: string; required?: number; available?: number;
          };
          if (body?.code === "insufficient_balance" && onBilling) {
            onBilling({
              success: false,
              error: "insufficient_balance",
              required: body.required,
              available: body.available,
            });
          }
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let finalMessage: ChatMessage | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                delta?: string;
                filler?: string;
                userMessageId?: string;
                billing?: BillingInfo;
                done?: boolean;
                message?: ChatMessage | null;
                fullText?: string;
              };
              if (parsed.userMessageId) {
                // Replace the optimistic bubble's temp id with the real one.
                seenIds.current.add(parsed.userMessageId);
                setMessages((prev) => prev.map((m) =>
                  m.id === tempId ? { ...m, id: parsed.userMessageId!, _optimistic: false } : m,
                ));
              }
              if (parsed.billing && onBilling) onBilling(parsed.billing);
              if (parsed.filler && !acc) onFiller?.(parsed.filler);
              if (parsed.delta) { acc += parsed.delta; onDelta(acc); }
              if (parsed.done) {
                if (parsed.message) finalMessage = parsed.message;
              }
            } catch { /* malformed chunk — skip */ }
          }
        }

        // Guarantee the assistant reply appears without a refresh.
        if (finalMessage?.id) {
          mergeIncoming(finalMessage);
        } else if (acc) {
          // Streamed text but no persisted row returned — refetch shortly.
          setTimeout(() => setReloadKey((k) => k + 1), 500);
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(err instanceof Error ? err.message : "AI chat failed");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId, mergeIncoming],
  );

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  return { messages, isLoading, isSending, error, send, sendToAI, retry };
}
