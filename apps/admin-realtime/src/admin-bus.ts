// AdminBus — a Durable Object singleton that is the Cloudflare realtime backbone
// for the admin / super-admin panels.
//
//   * Ingests business events (POST /ingest, authenticated by shared secret).
//   * Fans them out to every connected operator over hibernating WebSockets.
//   * Derives live rates (last 60s / 5m / 1h) from an in-memory ring.
//   * Persists the event feed + per-minute timeseries into D1 so a reload or a
//     cold isolate repaints real history instantly (this is the "realtime db").
//
// It is a PRESENCE + LIVE-EVENT bus, not a second source of truth. Supabase
// remains authoritative for users, bookings, wallets and money paths.

import type { Env, Principal } from "./env";
import { verifyTicket } from "./auth";

export interface BusEvent {
  kind: string;
  label: string;
  actor: string | null;
  amount: number | null;
  meta: Record<string, unknown> | null;
  ts: number;
}

const TAG = "ops";
const RING_MAX = 500;
const WINDOW_MAX_MS = 60 * 60 * 1000; // derive rates over the last hour

function counterFor(kind: string): keyof Counters | null {
  const k = kind.toLowerCase();
  if (k.startsWith("booking")) return "bookings";
  if (k.startsWith("payment")) return "payments";
  if (k.startsWith("withdrawal") || k.startsWith("payout")) return "withdrawals";
  if (k.startsWith("chat")) return "chats";
  return null;
}

interface Counters { bookings: number; payments: number; withdrawals: number; chats: number; }
const ZERO: Counters = { bookings: 0, payments: 0, withdrawals: 0, chats: 0 };

export class AdminBus {
  state: DurableObjectState;
  env: Env;
  private ring: BusEvent[] = [];
  private primed = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Load recent events from D1 once so the feed survives isolate eviction.
  private async ensurePrimed() {
    if (this.primed) return;
    this.primed = true;
    try {
      const { results } = await this.env.DB
        .prepare("SELECT kind, label, actor, amount, meta, ts FROM admin_events ORDER BY ts DESC LIMIT 100")
        .all<{ kind: string; label: string; actor: string | null; amount: number | null; meta: string | null; ts: number }>();
      this.ring = (results ?? [])
        .map((r) => ({
          kind: r.kind, label: r.label, actor: r.actor ?? null,
          amount: r.amount ?? null, meta: r.meta ? JSON.parse(r.meta) : null, ts: r.ts,
        }))
        .sort((a, b) => b.ts - a.ts);
    } catch (e) {
      console.warn("[bus] prime failed:", e instanceof Error ? e.message : e);
    }
  }

  async fetch(req: Request): Promise<Response> {
    await this.ensurePrimed();
    const url = new URL(req.url);

    if (url.pathname === "/ws" && req.method === "GET") {
      return this.handleUpgrade(url);
    }
    if (url.pathname === "/ingest" && req.method === "POST") {
      return this.handleIngest(req);
    }
    if (url.pathname === "/snapshot" && req.method === "GET") {
      return Response.json(this.snapshot());
    }
    if (url.pathname === "/tick" && req.method === "POST") {
      return this.handleTick();
    }
    return new Response("not found", { status: 404 });
  }

  private async handleUpgrade(url: URL): Promise<Response> {
    const ticket = url.searchParams.get("ticket") ?? "";
    const principal = await verifyTicket(this.env, ticket);
    if (!principal) return new Response("unauthorized", { status: 401 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [TAG]);
    // Paint instantly on connect.
    try { server.send(JSON.stringify({ type: "hello", ...this.snapshot() })); } catch { /* socket may already be hibernated */ }
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleIngest(req: Request): Promise<Response> {
    let body: Partial<BusEvent> & { kind?: string };
    try { body = await req.json(); } catch {
      return new Response("invalid json", { status: 400 });
    }
    const kind = String(body.kind ?? "unknown").slice(0, 64);
    if (!kind) return new Response("kind required", { status: 400 });

    const event: BusEvent = {
      kind,
      label: String(body.label ?? kind).slice(0, 200),
      actor: body.actor ? String(body.actor).slice(0, 64) : null,
      amount: typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : null,
      meta: body.meta && typeof body.meta === "object" ? body.meta : null,
      ts: Date.now(),
    };

    this.ring.unshift(event);
    if (this.ring.length > RING_MAX) this.ring.length = RING_MAX;

    const payload = JSON.stringify({ type: "event", event });
    for (const ws of this.state.getWebSockets(TAG)) {
      try { ws.send(payload); } catch { /* drop dead sockets; hibernation reaps them */ }
    }

    // Fire-and-persist — never let a D1 hiccup block the fan-out we just did.
    this.state.waitUntil(this.persistEvent(event));

    return Response.json({ ok: true, operators: this.state.getWebSockets(TAG).length });
  }

  private async handleTick(): Promise<Response> {
    const now = Date.now();
    // Prune the ring to the rate window.
    this.ring = this.ring.filter((e) => now - e.ts <= WINDOW_MAX_MS);

    const bucketTs = Math.floor(now / 60_000) * 60_000;
    const inMinute = this.ring.filter((e) => e.ts >= bucketTs);
    const counters: Counters = { ...ZERO };
    let revenue = 0;
    for (const e of inMinute) {
      const key = counterFor(e.kind);
      if (key) counters[key]++;
      if (e.kind.toLowerCase().startsWith("payment") && e.amount) revenue += e.amount;
    }

    const snapshot = this.snapshot();
    const payload = JSON.stringify({ type: "tick", rates: snapshot.rates, operators: snapshot.operators });
    for (const ws of this.state.getWebSockets(TAG)) {
      try { ws.send(payload); } catch { /* ignore */ }
    }

    try {
      await this.env.DB
        .prepare(
          `INSERT INTO metric_timeseries (bucket_ts, bookings, payments, revenue, withdrawals, chats, operators)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(bucket_ts) DO UPDATE SET
             bookings=excluded.bookings, payments=excluded.payments, revenue=excluded.revenue,
             withdrawals=excluded.withdrawals, chats=excluded.chats, operators=excluded.operators`,
        )
        .bind(bucketTs, counters.bookings, counters.payments, revenue, counters.withdrawals, counters.chats, snapshot.operators)
        .run();
      // Keep the timeseries bounded to the last ~7 days.
      await this.env.DB.prepare("DELETE FROM metric_timeseries WHERE bucket_ts < ?1")
        .bind(now - 7 * 24 * 60 * 60 * 1000).run();
    } catch (e) {
      console.warn("[bus] tick persist failed:", e instanceof Error ? e.message : e);
    }

    return Response.json({ ok: true, bucketTs });
  }

  private async persistEvent(event: BusEvent): Promise<void> {
    try {
      await this.env.DB
        .prepare("INSERT INTO admin_events (id, kind, label, actor, amount, meta, ts) VALUES (?1,?2,?3,?4,?5,?6,?7)")
        .bind(
          crypto.randomUUID(), event.kind, event.label, event.actor, event.amount,
          event.meta ? JSON.stringify(event.meta) : null, event.ts,
        ).run();
      await this.env.DB.prepare("DELETE FROM admin_events WHERE ts < ?1")
        .bind(Date.now() - 24 * 60 * 60 * 1000).run();
    } catch (e) {
      console.warn("[bus] persist failed:", e instanceof Error ? e.message : e);
    }
  }

  private rates(): { last60s: Counters; last5m: Counters; last1h: Counters; eventsPerMin: number } {
    const now = Date.now();
    const agg = (windowMs: number): Counters => {
      const out: Counters = { ...ZERO };
      let n = 0;
      for (const e of this.ring) {
        if (now - e.ts > windowMs) break; // ring is newest-first
        n++;
        const key = counterFor(e.kind);
        if (key) out[key]++;
      }
      return out;
    };
    const last60s = agg(60_000);
    const last5m = agg(5 * 60_000);
    const last1h = agg(WINDOW_MAX_MS);
    const eventsLastMin = last60s.bookings + last60s.payments + last60s.withdrawals + last60s.chats;
    return { last60s, last5m, last1h, eventsPerMin: eventsLastMin };
  }

  private snapshot() {
    return {
      operators: this.state.getWebSockets(TAG).length,
      rates: this.rates(),
      feed: this.ring.slice(0, 50),
      serverTs: Date.now(),
    };
  }

  // ── Hibernation callbacks ──────────────────────────────────────────────────
  webSocketMessage(ws: WebSocket, _message: string | ArrayBuffer): void {
    // We only accept pings; ignore everything else. Hibernation wakes us for it.
    try {
      if (typeof _message === "string" && _message.includes("ping")) {
        ws.send(JSON.stringify({ type: "pong", serverTs: Date.now() }));
      }
    } catch { /* ignore */ }
  }

  webSocketError(_ws: WebSocket, _error: unknown): void { /* hibernation closes on error */ }

  webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void { /* no-op */ }
}

export type { Principal };
