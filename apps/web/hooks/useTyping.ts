"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useTyping — Presence-based typing indicator
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { usePresence, channels } from "@zeal/realtime";

interface TypingState extends Record<string, unknown> {
  typing?: boolean;
  online_at?: string;
}

export function useTyping(conversationId: string | null, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const timeoutRef = useRef<number | null>(null);

  const topic = conversationId ? channels.roomTyping(conversationId) : null;

  const { track, untrack } = usePresence<TypingState>(
    topic,
    currentUserId,
    (state) => {
      const next = new Set<string>();
      for (const [key, entries] of Object.entries(state)) {
        if (key === currentUserId) continue;
        if (entries.some((e) => e.typing)) next.add(key);
      }
      setTypingUsers(next);
    },
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!topic) return;
      if (isTyping) {
        track({ typing: true });
      } else {
        track({ typing: false });
      }
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (isTyping) {
        timeoutRef.current = window.setTimeout(() => {
          track({ typing: false });
        }, 2500);
      }
    },
    [topic, track],
  );

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    untrack();
  }, [untrack]);

  return { typingUsers, setTyping };
}
