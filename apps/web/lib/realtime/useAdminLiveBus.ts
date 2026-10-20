"use client";

// useAdminLiveBus — browser client for the Cloudflare admin-realtime bus.
//
// Opens ONE authenticated WebSocket to zeal-admin-realtime and keeps it alive
// with reconnect + backoff. Supabase Realtime remains the app's other realtime
// path; this socket adds sub-minute live cadence + operator presence for the
// dashboards. When NEXT_PUBLIC_ADMIN_BUS_URL is unset (env not provisioned yet)
// the socket is simply never opened and status stays "disabled" — no throw, no
// noise, dashboards keep working off Supabase.

import { useCallback, useEffect, useRef, useState } from "react";
import { getRealtimeClient } from "@zeal/realtime";

export type LiveBusStatus = "disabled" | "connecting" | "live" | "reconnecting" | "unauthorized";

export interface LiveBusEvent {
  kind: string;
  label: string;
  actor: string | null;
  amount: number | null;
  ts: number;
}

export interface LiveBusRates {
  last60s: { bookings: number; payments: number; withdrawals: number; chats: number };
  eventsPerMin: number;
}

const EMPTY_RATES: LiveBusRates = {
  last60s: { bookings: 0, payments: 0, withdrawals: 0, chats: 0 },
  eventsPerMin: 0,
};

function wsUrl(base: string, token: string): string | null {
  try {
    const u = new URL(base);
    u.protocol = u.protocol === "http:" ? "ws:" : "wss:";
    u.pathname = "/ws/admin";
    u.search = `?token=${encodeURIComponent(token)}`;
    return u.toString();
  } catch {
    return null;
  }
}

export function useAdminLiveBus(enabled = true) {
  const base = process.env.NEXT_PUBLIC_ADMIN_BUS_URL ?? "";
  const [status, setStatus] = useState<LiveBusStatus>(!enabled || !base ? "disabled" : "connecting");
  const [operators, setOperators] = useState(0);
  const [rates, setRates] = useState<LiveBusRates>(EMPTY_RATES);
  const [feed, setFeed] = useState<LiveBusEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  const connect = useCallback(async () => {
    if (!enabled || !base) return;
    const sb = getRealtimeClient();
    if (!sb) { setStatus("reconnecting"); return; }
    let token: string | null = null;
    try {
      const { data } = await sb.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      token = null;
    }
    if (!token) { setStatus("unauthorized"); return; }
    const url = wsUrl(base, token);
    if (!url) { setStatus("disabled"); return; }

    setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus("live");
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "hello" || msg.type === "tick") {
          if (typeof msg.operators === "number") setOperators(msg.operators);
          if (msg.rates) {
            setRates({
              last60s: msg.rates.last60s ?? EMPTY_RATES.last60s,
              eventsPerMin: msg.rates.eventsPerMin ?? 0,
            });
          }
          if (Array.isArray(msg.feed)) setFeed(msg.feed.slice(0, 30));
        } else if (msg.type === "event" && msg.event) {
          const e = msg.event as LiveBusEvent;
          setFeed((prev) => [e, ...prev].slice(0, 30));
        }
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onerror = () => { /* onclose handles reconnect */ };
    ws.onclose = (close) => {
      if (!aliveRef.current) return;
      if (close.code === 4001 || close.code === 1008) { setStatus("unauthorized"); return; }
      scheduleReconnect();
    };
  }, [enabled, base]);

  const scheduleReconnect = () => {
    if (!aliveRef.current || reconnectRef.current) return;
    setStatus("reconnecting");
    attemptRef.current += 1;
    const delay = Math.min(500 * 2 ** (attemptRef.current - 1), 15_000);
    reconnectRef.current = setTimeout(() => {
      reconnectRef.current = null;
      void connect();
    }, delay);
  };

  useEffect(() => {
    if (!enabled || !base) { setStatus("disabled"); return; }
    aliveRef.current = true;
    void connect();
    return () => {
      aliveRef.current = false;
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      try { wsRef.current?.close(); } catch { /* ignore */ }
      wsRef.current = null;
    };
  }, [enabled, base, connect]);

  return { status, operators, rates, feed };
}
