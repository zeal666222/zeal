"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — Singleton Supabase Realtime Client
// ─────────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   • One client instance per browser tab (never duplicate connections)
//   • One channel per topic (multiplex subscriptions on the same channel)
//   • Connection state with exponential-backoff reconnect + jitter
//   • Listener registry (no leaked listeners after unmount)
//   • Deduplication of inbound events by channel + event + payload id
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createClient,
  type SupabaseClient,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

interface Listener<T = unknown> {
  id: string;
  handler: (payload: T) => void;
}

interface ChannelEntry {
  channel: RealtimeChannel;
  listeners: Map<string, Map<string, Listener>>;   // event → (listenerId → listener)
  subscribePromise?: Promise<void>;
  status: "pending" | "subscribed" | "error";
}

// ─── Module state ─────────────────────────────────────────────────────────────
let client: SupabaseClient | null = null;
const channels = new Map<string, ChannelEntry>();
const stateListeners = new Set<(s: ConnectionState) => void>();
const seenEventIds = new Set<string>();
const MAX_SEEN = 500;
const TRIM_TO = 250;

let currentState: ConnectionState = "disconnected";
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const JITTER_FACTOR = 0.3;
const MAX_ATTEMPTS = 10;

let listenerCounter = 0;
const nextListenerId = () => `l-${++listenerCounter}-${Date.now()}`;

// ─── State emitters ───────────────────────────────────────────────────────────
function setState(next: ConnectionState) {
  if (next === currentState) return;
  currentState = next;
  for (const fn of stateListeners) {
    try { fn(next); } catch (e) { console.warn("[realtime] state listener error", e); }
  }
}

export function onConnectionStateChange(fn: (s: ConnectionState) => void): () => void {
  stateListeners.add(fn);
  fn(currentState);
  return () => { stateListeners.delete(fn); };
}

export function getConnectionState(): ConnectionState { return currentState; }

// ─── Client factory ───────────────────────────────────────────────────────────
export function getRealtimeClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[realtime] Missing Supabase env — realtime disabled");
    return null;
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 }, timeout: 20_000 },
    global: { headers: { "x-application-name": "zeal-realtime" } },
  });
  setState("connecting");
  return client;
}

// ─── Reconnect with exponential backoff + jitter ──────────────────────────────
function scheduleReconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempt >= MAX_ATTEMPTS) {
    console.warn("[realtime] Max reconnect attempts reached");
    setState("disconnected");
    return;
  }
  reconnectAttempt++;
  const base = Math.min(BASE_BACKOFF_MS * Math.pow(2, reconnectAttempt - 1), MAX_BACKOFF_MS);
  const jitter = base * JITTER_FACTOR * (Math.random() * 2 - 1);
  const delay = Math.max(100, Math.round(base + jitter));

  setState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!client) return;
    for (const entry of channels.values()) {
      try { entry.channel.subscribe(); } catch (e) { console.warn("[realtime] resubscribe failed", e); }
    }
  }, delay);
}

// ─── Channel acquisition ──────────────────────────────────────────────────────
function getOrCreateChannel(topic: string): ChannelEntry | null {
  const sb = getRealtimeClient();
  if (!sb) return null;

  const existing = channels.get(topic);
  if (existing) return existing;

  const channel = sb.channel(topic, {
    config: { broadcast: { self: false, ack: false }, presence: { key: "" } },
  });
  const entry: ChannelEntry = {
    channel,
    listeners: new Map(),
    status: "pending",
  };
  channels.set(topic, entry);
  return entry;
}

// ─── Public: Broadcast subscription ───────────────────────────────────────────
export function subscribe<T = unknown>(
  topic: string,
  event: string,
  handler: (payload: T) => void,
): () => void {
  const entry = getOrCreateChannel(topic);
  if (!entry) return () => {};

  // Register listener
  let eventMap = entry.listeners.get(event);
  if (!eventMap) {
    eventMap = new Map();
    entry.listeners.set(event, eventMap);

    // One physical .on per (channel, event) — dispatches to all listeners
    entry.channel.on("broadcast", { event }, (message) => {
      const payload = (message as { payload?: unknown })?.payload;
      // Dedupe by id if present
      const id = (payload as { id?: string } | null)?.id;
      if (id) {
        if (seenEventIds.has(id)) return;
        seenEventIds.add(id);
        if (seenEventIds.size > MAX_SEEN) {
          const arr = Array.from(seenEventIds);
          seenEventIds.clear();
          for (const k of arr.slice(-TRIM_TO)) seenEventIds.add(k);
        }
      }
      const listeners = entry!.listeners.get(event);
      if (!listeners) return;
      for (const l of listeners.values()) {
        try { l.handler(payload); } catch (e) { console.error(`[realtime] handler error ${topic}:${event}`, e); }
      }
    });
  }
  const listener: Listener<T> = { id: nextListenerId(), handler };
  eventMap.set(listener.id, listener as Listener);

  // Subscribe once
  if (!entry.subscribePromise) {
    entry.subscribePromise = new Promise<void>((resolve) => {
      entry!.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          entry!.status = "subscribed";
          reconnectAttempt = 0;
          setState("connected");
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          entry!.status = "error";
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
      try { e.channel.unsubscribe(); } catch { /* ignore */ }
      channels.delete(topic);
    }
  };
}

// ─── Public: Presence ─────────────────────────────────────────────────────────
export function subscribePresence<T = unknown>(
  topic: string,
  key: string,
  onSync: (state: Record<string, T[]>) => void,
): () => void {
  const sb = getRealtimeClient();
  if (!sb) return () => {};

  const presenceTopic = `${topic}#presence`;
  const channel = sb.channel(presenceTopic, { config: { presence: { key } } });
  let tracked = false;

  channel
    .on("presence", { event: "sync" }, () => {
      try { onSync(channel.presenceState() as Record<string, T[]>); }
      catch (e) { console.error("[realtime] presence sync error", e); }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && !tracked) {
        tracked = true;
        try { channel.track({ online_at: new Date().toISOString() }); }
        catch (e) { console.warn("[realtime] track failed", e); }
      }
    });

  return () => {
    try { channel.untrack(); } catch { /* ignore */ }
    try { sb.removeChannel(channel); } catch { /* ignore */ }
  };
}

// ─── Public: Publish (client-side) ────────────────────────────────────────────
export async function publish<T = unknown>(topic: string, event: string, payload: T): Promise<boolean> {
  const sb = getRealtimeClient();
  if (!sb) return false;
  const ch = sb.channel(topic);
  await ch.subscribe();
  try {
    const res = await ch.send({ type: "broadcast", event, payload });
    return res === "ok";
  } catch (e) {
    console.warn("[realtime] publish failed", e);
    return false;
  } finally {
    try { await sb.removeChannel(ch); } catch { /* ignore */ }
  }
}

// ─── Public: Teardown ─────────────────────────────────────────────────────────
export function disconnectAll() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  for (const [topic, entry] of channels.entries()) {
    try { entry.channel.unsubscribe(); } catch (e) { console.warn(`[realtime] unsub ${topic} failed`, e); }
  }
  channels.clear();
  seenEventIds.clear();
  setState("disconnected");
}
