"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {useChannel, channels} from "@zeal/realtime";
import type { BroadcastChange, ChatMessage } from "@/types/chat";

export type { ChatMessage };

interface Row { id?: string; conversationId?: string; senderId?: string | null; content?: string; type?: string; createdAt?: string; }
interface Opts { conversationId: string | null; currentUserId: string; pageSize?: number; }

export function useChat({ conversationId, currentUserId, pageSize = 50 }: Opts) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId) { setMessages([]); setIsLoading(false); return; }
    let cancel = false;
    setIsLoading(true); setError(null); seen.current = new Set();
    fetch(`/api/consultant/chat/${conversationId}/messages?limit=${pageSize}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: { messages?: ChatMessage[] }) => {
        if (cancel) return;
        const list = d.messages ?? [];
        list.forEach((m) => seen.current.add(m.id));
        setMessages(list);
      })
      .catch((e: unknown) => { if (!cancel) setError(e instanceof Error ? e.message : "Failed"); })
      .finally(() => { if (!cancel) setIsLoading(false); });
    return () => { cancel = true; };
  }, [conversationId, pageSize]);

  useChannel<BroadcastChange<Row>>({
    channel: conversationId ? channels.roomMessages(conversationId) : null,
    event: "*",
    onMessage: (p) => {
      if (p?.type !== "INSERT") return;
      const r = p.record;
      if (!r?.id || !r.content || seen.current.has(r.id)) return;
      seen.current.add(r.id);
      const inc: ChatMessage = {
        id: r.id, conversationId: r.conversationId ?? conversationId ?? "",
        senderId: r.senderId ?? null, content: r.content, type: r.type ?? "text",
        createdAt: r.createdAt ?? new Date().toISOString(),
      };
      setMessages((prev) => {
        const cleaned = prev.filter((m) => !(m._optimistic && m.content === inc.content && m.senderId === inc.senderId));
        return [...cleaned, inc].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    },
  });

  const send = useCallback(async (content: string) => {
    const t = content.trim();
    if (!t || !conversationId) return;
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const opt: ChatMessage = { id: tmpId, conversationId, senderId: currentUserId, content: t, type: "text", createdAt: new Date().toISOString(), _optimistic: true };
    setMessages((p) => [...p, opt]); setIsSending(true); setError(null);
    try {
      const r = await fetch(`/api/consultant/chat/${conversationId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: t }),
      });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as { error?: string })?.error || `HTTP ${r.status}`); }
      const { message } = (await r.json()) as { message: ChatMessage };
      if (message?.id) seen.current.add(message.id);
      setMessages((p) => p.map((m) => (m.id === tmpId ? { ...message, _optimistic: false } : m)));
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== tmpId));
      setError(e instanceof Error ? e.message : "Send failed");
      throw e;
    } finally { setIsSending(false); }
  }, [conversationId, currentUserId]);

  return { messages, isLoading, isSending, error, send };
}
