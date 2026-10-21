// ChatRoom — one Durable Object per AI conversation: the realtime side of the
// transcript, with sockets that hibernate so an idle room costs nothing.
//
// The room never accepts client-authored messages. Only the worker, after it
// has persisted a turn to D1, calls /publish; sockets receive that fan-out.
// That keeps the DO from becoming a second source of truth and removes the
// classic "any socket can spoof a message" hole outright.
import type { Env } from "./env";
import { verifyRoomTicket } from "./auth";

const TAG = "room";

export class ChatRoom {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/ws" && req.method === "GET") {
      return this.handleUpgrade(url);
    }
    if (url.pathname === "/publish" && req.method === "POST") {
      return this.handlePublish(req);
    }
    if (url.pathname === "/peers" && req.method === "GET") {
      return Response.json({ peers: this.state.getWebSockets(TAG).length });
    }
    return new Response("not found", { status: 404 });
  }

  private async handleUpgrade(url: URL): Promise<Response> {
    const conversationId = this.state.id.name;
    const ticket = url.searchParams.get("ticket") ?? "";
    const verified = await verifyRoomTicket(this.env, ticket);
    if (!verified || verified.conversationId !== conversationId) {
      return new Response("unauthorized", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [TAG]);
    try {
      server.send(JSON.stringify({ type: "hello", conversationId, peers: this.state.getWebSockets(TAG).length }));
    } catch { /* hibernated immediately */ }
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Fan a persisted message out to every socket in this room. */
  private async handlePublish(req: Request): Promise<Response> {
    const payload = await req.text();
    let sent = 0;
    for (const ws of this.state.getWebSockets(TAG)) {
      try {
        ws.send(payload);
        sent++;
      } catch { /* dead socket — hibernation reaps it */ }
    }
    return Response.json({ ok: true, peers: sent });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message === "string" && message.includes("ping")) {
      try { ws.send(JSON.stringify({ type: "pong", serverTs: Date.now() })); } catch { /* ignore */ }
    }
  }

  webSocketError(_ws: WebSocket, _error: unknown): void { /* hibernation closes on error */ }

  webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void { /* no-op */ }
}
