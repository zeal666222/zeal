"use client";
import {useCallback, useState} from "react";
import {useChannel, channels} from "@zeal/realtime";
import type { BroadcastChange, ConversationItem } from "@/types/chat";

export type { ConversationItem };

interface Row { id?: string; conversationId?: string; senderId?: string | null; content?: string; createdAt?: string; }

export function useConversations(userId: string, initial: ConversationItem[] = []) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initial);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/consultant/chat/conversations", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.items)) setConversations(d.items);
    } catch {}
  }, []);
  useChannel<BroadcastChange<Row>>({
    channel: userId ? channels.userInbox(userId) : null,
    event: "*",
    onMessage: (p) => {
      const r = p?.record;
      if (!r?.conversationId || !r.content) return;
      setConversations((prev) => {
        const exists = prev.some((c) => c.sessionId === r.conversationId);
        if (!exists) { void refresh(); return prev; }
        const updated = prev.map((c) => c.sessionId === r.conversationId ? {
          ...c, lastMessage: r.content ?? c.lastMessage,
          lastMessageTime: r.createdAt ?? c.lastMessageTime,
          lastMessageSenderId: r.senderId ?? c.lastMessageSenderId,
        } : c);
        return updated.sort((a, b) =>
          (b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0) -
          (a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0));
      });
    },
  });
  return { conversations, setConversations, refresh };
}
