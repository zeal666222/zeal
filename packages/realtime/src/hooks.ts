"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — React Hooks
// ═══════════════════════════════════════════════════════════════════════════════

import {useEffect, useRef, useState} from "react";
import {
  getConnectionState,
  getConnectionQuality,
  onConnectionStateChange,
  onConnectionQualityChange,
  subscribe,
  subscribePresence,
  type ConnectionState,
  type ConnectionQualityStats,
  type PresenceHandle,
} from "./client";

// ─── useConnection ────────────────────────────────────────────────────────────
export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() => getConnectionState());
  useEffect(() => onConnectionStateChange(setState), []);
  return state;
}

// ─── useConnectionQuality ─────────────────────────────────────────────────────
export function useConnectionQuality(): ConnectionQualityStats {
  const [stats, setStats] = useState<ConnectionQualityStats>(() => getConnectionQuality());
  useEffect(() => onConnectionQualityChange(setStats), []);
  return stats;
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

// ─── useMultiChannel ──────────────────────────────────────────────────────────
export interface MultiChannelSubscription {
  channel: string;
  event?: string;
}

export function useMultiChannel<T = unknown>(
  subscriptions: MultiChannelSubscription[],
  onMessage: (payload: T, channel: string, event: string) => void,
  enabled = true,
): { isLive: boolean; activeCount: number } {
  const [isLive, setIsLive] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) {
      setIsLive(false);
      setActiveCount(0);
      return;
    }

    const unsubs: Array<() => void> = [];
    for (const sub of subscriptions) {
      const event = sub.event ?? "*";
      const unsub = subscribe<T>(sub.channel, event, (payload) => {
        handlerRef.current(payload, sub.channel, event);
      });
      unsubs.push(unsub);
    }

    setIsLive(true);
    setActiveCount(subscriptions.length);

    return () => {
      for (const unsub of unsubs) unsub();
      setIsLive(false);
      setActiveCount(0);
    };
  }, [enabled, subscriptions]);

  return { isLive, activeCount };
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
