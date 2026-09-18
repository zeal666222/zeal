"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — React Hooks
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import {
  getConnectionState,
  onConnectionStateChange,
  subscribe,
  subscribePresence,
  type ConnectionState,
} from "./client";

// ─── useConnection ────────────────────────────────────────────────────────────
export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() => getConnectionState());
  useEffect(() => onConnectionStateChange(setState), []);
  return state;
}

// ─── useChannel ───────────────────────────────────────────────────────────────
export interface UseChannelOptions<T> {
  channel: string | null;
  event: string;
  onMessage: (payload: T) => void;
  enabled?: boolean;
}

export interface UseChannelResult {
  isLive: boolean;
}

export function useChannel<T = unknown>(opts: UseChannelOptions<T>): UseChannelResult {
  const { channel, event, onMessage, enabled = true } = opts;
  const [isLive, setIsLive] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!channel || !enabled) return;
    const unsub = subscribe<T>(channel, event, (p) => handlerRef.current(p));
    setIsLive(true);
    return () => {
      unsub();
      setIsLive(false);
    };
  }, [channel, event, enabled]);

  return { isLive };
}

// ─── usePresence ──────────────────────────────────────────────────────────────
export function usePresence<T = unknown>(
  topic: string | null,
  key: string,
  onSync: (state: Record<string, T[]>) => void,
): void {
  const handlerRef = useRef(onSync);
  handlerRef.current = onSync;

  useEffect(() => {
    if (!topic) return;
    const unsub = subscribePresence<T>(topic, key, (s) => handlerRef.current(s));
    return unsub;
  }, [topic, key]);
}

// ─── usePresenceTracker ───────────────────────────────────────────────────────
export function usePresenceTracker<T extends Record<string, unknown>>(
  topic: string | null,
  key: string,
): { track: (s: T) => void; untrack: () => void } {
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof subscribePresence> | null>(null);

  useEffect(() => {
    if (!topic) return;
    const unsub = subscribePresence(topic, key, () => setReady(true));
    channelRef.current = unsub;
    return () => { unsub(); setReady(false); };
  }, [topic, key]);

  return {
    track: () => {},
    untrack: () => {},
  };
}
