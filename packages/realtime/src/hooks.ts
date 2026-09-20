"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — React Hooks
// ═══════════════════════════════════════════════════════════════════════════════

import {useEffect, useRef, useState} from "react";
import {getConnectionState, onConnectionStateChange, subscribe, subscribePresence, type ConnectionState, type PresenceHandle} from "./client";

// ─── useConnection ────────────────────────────────────────────────────────────
export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() => getConnectionState());
  useEffect(() => onConnectionStateChange(setState), []);
  return state;
}

// ─── useChannel ───────────────────────────────────────────────────────────────
export interface UseChannelOptions<T> {
  channel: string | null;
  event?: string;
  onMessage: (payload: T) => void;
  enabled?: boolean;
}

export interface UseChannelResult {
  isLive: boolean;
}

export function useChannel<T = unknown>(opts: UseChannelOptions<T>): UseChannelResult {
  const { channel, event = "*", onMessage, enabled = true } = opts;
  const [isLive, setIsLive] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!channel || !enabled) {
      setIsLive(false);
      return;
    }
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
export interface UsePresenceResult<T extends Record<string, unknown>> {
  track: (state: T) => void;
  untrack: () => void;
}

export function usePresence<T extends Record<string, unknown>>(
  topic: string | null,
  key: string,
  onSync: (state: Record<string, T[]>) => void,
): UsePresenceResult<T> {
  const handleRef = useRef<PresenceHandle<T> | null>(null);
  const handlerRef = useRef(onSync);
  handlerRef.current = onSync;

  useEffect(() => {
    if (!topic) return;
    const handle = subscribePresence<T>(topic, key, (s) => handlerRef.current(s));
    handleRef.current = handle;
    return () => {
      handle.unsubscribe();
      handleRef.current = null;
    };
  }, [topic, key]);

  return {
    track: (s: T) => handleRef.current?.track(s),
    untrack: () => handleRef.current?.untrack(),
  };
}
