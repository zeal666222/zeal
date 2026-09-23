"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — Shared Supabase Realtime Client
// ─────────────────────────────────────────────────────────────────────────────
// Supabase Realtime compares the `event` filter with strict string equality.
// It has no "*" wildcard on the client-side `.on("broadcast", { event })`.
//
// Zeal's `useChannel` hook (in ./hooks.ts) defaults `event` to "*" and every
// call site relies on that default. To make wildcard subscriptions work:
//
//   1. We register ONE `.on("broadcast", { event: <known> }, dispatch)` per
//      known event name (from KNOWN_EVENTS below).
//   2. On receipt, `dispatch` fans out to listeners registered under the exact
//      event name AND to listeners registered under "*".
//   3. A per-channel `subscribePromise` ensures the channel subscribes once.
//
// Nothing here is React-specific — this module can be imported from any
// "use client" boundary.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface BroadcastChange<T = unknown> {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: T;
  old_record?: T | null;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type AnyHandler = (payload: unknown) => void;

interface Listener {
  readonly id: string;
  readonly handler: AnyHandler;
}

interface ChannelEntry {
  readonly channel: RealtimeChannel;
  readonly listeners: Map<string, Map<string, Listener>>;
  subscribePromise?: Promise<void>;
  status: "pending" | "subscribed" | "error";
}

// ─── Known events emitted by DB triggers + serverPublish() ───────────────────

const KNOWN_EVENTS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "incoming_request",
  "booking_created",
  "booking_updated",
  "sparks:updated",
  "rating:updated",
  "notification",
  "status_updated",
  "status_changed",
] as const;

type KnownEvent = (typeof KNOWN_EVENTS)[number];

// ─── Module state ─────────────────────────────────────────────────────────────

let client: SupabaseClient | null = null;
const channels = new Map<string, ChannelEntry>();
const stateListeners = new Set<(s: ConnectionState) => void>();
const seenEventKeys = new Set<string>();

const MAX_SEEN = 500;
const TRIM_TO = 250;

let currentState: ConnectionState = "disconnected";
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const MAX_ATTEMPTS = 10;

let listenerCounter = 0;
const nextListenerId = (): string =>
  `l-${++listenerCounter}-${Date.now().toString(36)}`;

// ─── Connection state ─────────────────────────────────────────────────────────

function setState(next: ConnectionState): void {
  if (next === currentState) return;
  currentState = next;
  for (const fn of stateListeners) {
    try {
      fn(next);
    } catch (err) {
      console.warn("[realtime] state listener threw:", err);
    }
  }
}

export function onConnectionStateChange(
  fn: (s: ConnectionState) => void,
): () => void {
  stateListeners.add(fn);
  fn(currentState);
  return () => {
    stateListeners.delete(fn);
  };
}

export function getConnectionState(): ConnectionState {
  return currentState;
}

// ─── Client factory ───────────────────────────────────────────────────────────

export function getRealtimeClient(): SupabaseClient | null {
  if (client) return client;

  // Reuse the shared browser client created by @zeal/database if present.
  if (typeof window !== "undefined") {
    const shared = (
      globalThis as { __ZEAL_SUPABASE_BROWSER__?: SupabaseClient }
    ).__ZEAL_SUPABASE_BROWSER__;
    if (shared) {
      client = shared;
      setState("connecting");
      return client;
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[realtime] NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing — realtime disabled",
      );
    }
    return null;
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
      timeout: 20_000,
    },
  });

  if (typeof window !== "undefined") {
    (
      globalThis as { __ZEAL_SUPABASE_BROWSER__?: SupabaseClient }
    ).__ZEAL_SUPABASE_BROWSER__ = client;
  }

  setState("connecting");
  return client;
}

// ─── Reconnect with exponential backoff + jitter ──────────────────────────────

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (reconnectAttempt >= MAX_ATTEMPTS) {
    setState("disconnected");
    return;
  }
  reconnectAttempt++;
  const base = Math.min(
    BASE_BACKOFF_MS * 2 ** (reconnectAttempt - 1),
    MAX_BACKOFF_MS,
  );
  const jitter = base * 0.3 * (Math.random() * 2 - 1);
  const delay = Math.max(100, Math.round(base + jitter));

  setState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!client) return;
    for (const entry of channels.values()) {
      try {
        entry.channel.subscribe();
      } catch {
        /* ignore — subscribe is best-effort */
      }
    }
  }, delay);
}

// ─── Channel management ───────────────────────────────────────────────────────

function getOrCreateChannel(topic: string): ChannelEntry | null {
  const sb = getRealtimeClient();
  if (!sb) return null;

  const existing = channels.get(topic);
  if (existing) return existing;

  const channel = sb.channel(topic, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: "" },
    },
  });

  const entry: ChannelEntry = {
    channel,
    listeners: new Map(),
    status: "pending",
  };
  channels.set(topic, entry);
  return entry;
}

function makeDispatcher(
  entry: ChannelEntry,
  topic: string,
  eventName: KnownEvent,
): (message: unknown) => void {
  return (message: unknown) => {
    const payload = (message as { payload?: unknown } | null)?.payload;

    // Dedup by (event, payload.id). The same row can legitimately arrive as
    // INSERT and UPDATE — the event name disambiguates them.
    const id =
      typeof payload === "object" && payload !== null
        ? (payload as { id?: string }).id
        : undefined;

    if (typeof id === "string") {
      const key = `${eventName}:${id}`;
      if (seenEventKeys.has(key)) return;
      seenEventKeys.add(key);
      if (seenEventKeys.size > MAX_SEEN) {
        const arr = Array.from(seenEventKeys);
        seenEventKeys.clear();
        for (const k of arr.slice(-TRIM_TO)) seenEventKeys.add(k);
      }
    }

    // Exact-event listeners
    const exact = entry.listeners.get(eventName);
    if (exact) {
      for (const listener of exact.values()) {
        try {
          listener.handler(payload);
        } catch (err) {
          console.error(`[realtime] handler threw ${topic}:${eventName}`, err);
        }
      }
    }

    // Wildcard listeners
    const wildcard = entry.listeners.get("*");
    if (wildcard) {
      for (const listener of wildcard.values()) {
        try {
          listener.handler(payload);
        } catch (err) {
          console.error(`[realtime] handler threw ${topic}:*`, err);
        }
      }
    }
  };
}

// ─── Public: subscribe ────────────────────────────────────────────────────────

export function subscribe<T = unknown>(
  topic: string,
  event: string,
  handler: (payload: T) => void,
): () => void {
  const entry = getOrCreateChannel(topic);
  if (!entry) return () => {};

  let eventMap = entry.listeners.get(event);
  if (!eventMap) {
    eventMap = new Map();
    entry.listeners.set(event, eventMap);
  }
  const listener: Listener = {
    id: nextListenerId(),
    handler: handler as AnyHandler,
  };
  eventMap.set(listener.id, listener);

  if (!entry.subscribePromise) {
    entry.subscribePromise = new Promise<void>((resolve) => {
      for (const name of KNOWN_EVENTS) {
        entry.channel.on(
          "broadcast",
          { event: name },
          makeDispatcher(entry, topic, name),
        );
      }
      entry.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          entry.status = "subscribed";
          reconnectAttempt = 0;
          setState("connected");
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          entry.status = "error";
          setState("reconnecting");
          scheduleReconnect();
        }
      });
    });
  }

  return () => {
    const e = channels.get(topic);
    if (!e) return;
    const map = e.listeners.get(event);
    if (map) {
      map.delete(listener.id);
      if (map.size === 0) e.listeners.delete(event);
    }
    if (e.listeners.size === 0) {
      try {
        e.channel.unsubscribe();
      } catch {
        /* ignore */
      }
      channels.delete(topic);
    }
  };
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export interface PresenceHandle<T> {
  unsubscribe: () => void;
  track: (state: T) => void;
  untrack: () => void;
}

export function subscribePresence<T extends Record<string, unknown>>(
  topic: string,
  key: string,
  onSync: (state: Record<string, T[]>) => void,
): PresenceHandle<T> {
  const sb = getRealtimeClient();
  if (!sb) {
    return { unsubscribe: () => {}, track: () => {}, untrack: () => {} };
  }

  const channel = sb.channel(`presence:${topic}`, {
    config: { presence: { key } },
  });
  let tracked = false;

  channel
    .on("presence", { event: "sync" }, () => {
      try {
        onSync(channel.presenceState() as Record<string, T[]>);
      } catch (err) {
        console.error("[realtime] presence sync threw:", err);
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && !tracked) {
        tracked = true;
        try {
          channel.track({ online_at: new Date().toISOString() });
        } catch {
          /* ignore */
        }
      }
    });

  return {
    track: (state: T) => {
      try {
        channel.track(state);
      } catch {
        /* ignore */
      }
    },
    untrack: () => {
      try {
        channel.untrack();
      } catch {
        /* ignore */
      }
    },
    unsubscribe: () => {
      try {
        channel.untrack();
      } catch {
        /* ignore */
      }
      try {
        sb.removeChannel(channel);
      } catch {
        /* ignore */
      }
    },
  };
}

// ─── One-shot publish ─────────────────────────────────────────────────────────

export async function publish<T = unknown>(
  topic: string,
  event: string,
  payload: T,
): Promise<boolean> {
  const sb = getRealtimeClient();
  if (!sb) return false;

  const channel = sb.channel(topic);
  await channel.subscribe();
  try {
    const result = await channel.send({
      type: "broadcast",
      event,
      payload,
    });
    return result === "ok";
  } catch {
    return false;
  } finally {
    try {
      await sb.removeChannel(channel);
    } catch {
      /* ignore */
    }
  }
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function disconnectAll(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  for (const entry of channels.values()) {
    try {
      entry.channel.unsubscribe();
    } catch {
      /* ignore */
    }
  }
  channels.clear();
  seenEventKeys.clear();
  setState("disconnected");
}
