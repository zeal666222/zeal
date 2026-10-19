"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {usePresence, channels} from "@zeal/realtime";
interface S extends Record<string, unknown> { typing?: boolean; online_at?: string; }
export function useTyping(conversationId: string | null, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);
  const topic = conversationId ? channels.roomTyping(conversationId) : null;
  const { track, untrack } = usePresence<S>(topic, currentUserId, (state) => {
    const next = new Set<string>();
    for (const [key, entries] of Object.entries(state)) {
      if (key === currentUserId) continue;
      if (entries.some((e) => e.typing)) next.add(key);
    }
    setTypingUsers(next);
  });
  const setTyping = useCallback((isTyping: boolean) => {
    if (!topic) return;
    track({ typing: isTyping });
    if (timer.current) window.clearTimeout(timer.current);
    if (isTyping) timer.current = window.setTimeout(() => track({ typing: false }), 2500);
  }, [topic, track]);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); untrack(); }, [untrack]);
  return { typingUsers, setTyping };
}
