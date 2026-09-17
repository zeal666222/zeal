"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "./useRealtime";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface Conversation {
  id: string;
  otherUser: { id: string; name: string | null; username: string; avatar: string | null } | null;
  lastMessageAt: string;
  lastMessageText: string | null;
}

export function useConversations(enabled: boolean) {
  const qc = useQueryClient();

  const query = useQuery<{ items: Conversation[] }>({
    queryKey: ["chat", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    enabled,
    staleTime: 15_000,
  });

  useRealtime("chat:global", "conversation:updated", () => {
    qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
  });

  return query;
}

export function useChat(conversationId: string | null) {
  const qc = useQueryClient();

  const messagesQuery = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["chat", conversationId, "messages"],
    queryFn: async () => {
      if (!conversationId) return { messages: [] };
      const res = await fetch("/api/chat/" + conversationId + "/messages");
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!conversationId,
    staleTime: 5_000,
  });

  useRealtime<{ id?: string }>(
    conversationId ? "chat:" + conversationId : null,
    "message:new",
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["chat", conversationId, "messages"] });
    }, [qc, conversationId]),
  );

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error("No conversation");
      const res = await fetch("/api/chat/" + conversationId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", conversationId, "messages"] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });

  return {
    messages: messagesQuery.data?.messages ?? [],
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    send: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
  };
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      if (!res.ok) throw new Error("Failed to start conversation");
      return res.json() as Promise<{ conversation: { id: string } }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useUnreadChatCount(): number {
  // Placeholder for future unread-count endpoint; always 0 until implemented
  useEffect(() => { /* no-op */ }, []);
  return 0;
}

