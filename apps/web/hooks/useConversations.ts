"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface ConversationItem {
  sessionId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isOnline: boolean;
  isAI: boolean;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderId: string | null;
  unreadCount?: number;
  isTyping?: boolean;
  isPinned?: boolean;
}

interface MessageRow {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  content?: string;
  createdAt?: string;
}

const POLL_INTERVAL_MS = 15_000;

export function useConversations(
  userId: string,
  initial: ConversationItem[] = [],
) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initial);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setConversations((prev) => {
          const incoming = data.items as ConversationItem[];
          return mergeConversations(prev, incoming);
        });
      }
    } catch (err) {
      console.warn("[useConversations] refresh:", err instanceof Error ? err.message : err);
    }
  }, []);

  // Poll the worker for AI conversation updates every 15s.
  // The Supabase realtime channel only covers human rooms — AI rooms live in
  // the Cloudflare worker's D1 and need explicit polling.
  useEffect(() => {
    if (!userId) return;
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, refresh]);

  // Refresh when the tab becomes visible again (user switches back).
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [refresh]);

  // Supabase realtime — covers human conversation message updates.
  useChannel<BroadcastChange<MessageRow>>({
    channel: userId ? channels.userInbox(userId) : null,
    event: "*",
    onMessage: (payload) => {
      const record = payload?.record;
      if (!record?.conversationId || !record.content) return;

      setConversations((prev) => {
        const exists = prev.some((c) => c.sessionId === record.conversationId);
        if (!exists) {
          void refresh();
          return prev;
        }
        return prev.map((c) =>
          c.sessionId === record.conversationId
            ? {
                ...c,
                lastMessage: record.content ?? c.lastMessage,
                lastMessageTime: record.createdAt ?? c.lastMessageTime,
                lastMessageSenderId: record.senderId ?? c.lastMessageSenderId,
              }
            : c,
        );
      });
    },
  });

  const markRead = useCallback((sessionId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.sessionId === sessionId ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  return { conversations, setConversations, refresh, markRead };
}

function mergeConversations(
  existing: ConversationItem[],
  incoming: ConversationItem[],
): ConversationItem[] {
  const map = new Map<string, ConversationItem>();
  for (const c of existing) map.set(c.sessionId, c);
  for (const c of incoming) {
    const prev = map.get(c.sessionId);
    if (prev) {
      map.set(c.sessionId, {
        ...c,
        unreadCount: prev.unreadCount ?? c.unreadCount ?? 0,
        isPinned: prev.isPinned ?? c.isPinned ?? false,
        isTyping: prev.isTyping ?? false,
      });
    } else {
      map.set(c.sessionId, c);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return tb - ta;
  });
}
