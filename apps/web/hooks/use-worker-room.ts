"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useWorkerRoom — live transcript for an AI room, over the Cloudflare
// Durable Object socket.
//
// One socket per room, ticket minted through /api/chat/[id]/ws-ticket on every
// (re)connect because the ticket is short-lived by design. The room only ever
// broadcasts turns the worker already persisted, so this is a delivery channel,
// not a second source of truth — reconnecting costs nothing and duplicate
// events are deduped by message id upstream.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";

export interface RoomEvent {
  type: string;
  message?: unknown;
  conversationId?: string;
}

interface UseWorkerRoomOptions {
  conversationId: string | null;
  enabled: boolean;
  onMessage: (message: unknown) => void;
}

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

export function useWorkerRoom({ conversationId, enabled, onMessage }: UseWorkerRoomOptions) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!conversationId) return () => {};

    let disposed = false;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const scheduleReconnect = () => {
      if (disposed) return;
      setConnected(false);
      const delay = Math.min(500 * 2 ** attempt++, MAX_BACKOFF_MS);
      retryTimer = setTimeout(open, delay);
    };

    const open = async () => {
      if (disposed) return;
      let ticket;
      try {
        const res = await fetch(`/api/chat/${conversationId}/ws-ticket`, { cache: "no-store" });
        if (!res.ok) throw new Error(`ticket HTTP ${res.status}`);
        ticket = (await res.json()) as { url?: string };
      } catch {
        scheduleReconnect();
        return;
      }
      if (disposed || !ticket.url) return;

      socket = new WebSocket(ticket.url);
      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setConnected(true);
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ ping: 1 }));
        }, PING_MS);
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          const parsed = JSON.parse(event.data) as RoomEvent;
          if (parsed.type === "message" && parsed.message) onMessageRef.current(parsed.message);
        } catch { /* keepalive or malformed frame */ }
      };
      socket.onclose = scheduleReconnect;
      socket.onerror = () => {
        try { socket?.close(); } catch { /* already gone */ }
      };
    };

    void open();

    return () => {
      disposed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        try { socket.close(); } catch { /* already closed */ }
      }
      setConnected(false);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      setConnected(false);
      return;
    }
    return connect();
  }, [conversationId, enabled, connect]);

  return { connected };
}
