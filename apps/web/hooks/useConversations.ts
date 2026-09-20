"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useConversations — Real-time inbox list
// Subscribes to user:{id}:inbox via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import {useCallback, useState} from "react";
import {useChannel, channels, type BroadcastChange} from "@zeal/realtime";

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
}

interface MessageRow {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  content?: string;
  createdAt?: string;
}

export function useConversations(
  userId: string,
  initial: ConversationItem[] = [],
) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) setConversations(data.items);
    } catch { /* ignore */ }
  }, []);

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
        const updated = prev.map((c) =>
          c.sessionId === record.conversationId
            ? {
                ...c,
                lastMessage: record.content ?? c.lastMessage,
                lastMessageTime: record.createdAt ?? c.lastMessageTime,
                lastMessageSenderId: record.senderId ?? c.lastMessageSenderId,
              }
            : c,
        );
        return updated.sort((a, b) => {
          const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return tb - ta;
        });
      });
    },
  });

  return { conversations, setConversations, refresh };
}
