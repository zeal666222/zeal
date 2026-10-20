import type { Env } from "./env";
import { authenticateToken, isAdmin, extractBearer, authorizeIngest, mintTicket, authSnapshot } from "./auth";
import { AdminBus } from "./admin-bus";

export { AdminBus };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Ingest-Secret",
};

function busStub(env: Env) {
  const id = env.ADMIN_BUS.idFromName("admin");
  return env.ADMIN_BUS.get(id);
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // Health (public, booleans only — never leak secrets)
    if (url.pathname === "/api/health" && req.method === "GET") {
      return handleHealth(env);
    }

    // WebSocket upgrade — verify the operator's JWT + admin role once, then
    // hand a short-lived HMAC ticket to the Durable Object which owns the
    // hibernating socket.
    if (url.pathname === "/ws/admin" && req.method === "GET") {
      const token = url.searchParams.get("token") ?? extractBearer(req);
      if (!token) return json({ error: "Unauthorized" }, 401);
      const principal = await authenticateToken(env, token);
      if (!isAdmin(principal)) return json({ error: "Forbidden — admin role required" }, 403);
      const ticket = await mintTicket(env, principal);
      const res = await busStub(env).fetch(`https://bus/ws?ticket=${encodeURIComponent(ticket)}`);
      return res;
    }

    // Ingest — validated against Supabase (service-role key), then forwarded.
    if (url.pathname === "/ingest" && req.method === "POST") {
      if (!(await authorizeIngest(req, env))) return json({ error: "Forbidden" }, 403);
      const body = await req.text();
      const res = await busStub(env).fetch("https://bus/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      return new Response(await res.text(), { status: res.status, headers: CORS });
    }

    // Snapshot — role-gated live metrics for initial paint.
    if (url.pathname === "/metrics" && req.method === "GET") {
      const token = url.searchParams.get("token") ?? extractBearer(req);
      if (!token) return json({ error: "Unauthorized" }, 401);
      const principal = await authenticateToken(env, token);
      if (!isAdmin(principal)) return json({ error: "Forbidden" }, 403);
      const res = await busStub(env).fetch("https://bus/snapshot");
      return new Response(await res.text(), { status: res.status, headers: { ...CORS, "Cache-Control": "no-store" } });
    }

    // Recent timeseries — role-gated sparkline history across reloads.
    if (url.pathname === "/timeseries" && req.method === "GET") {
      const token = url.searchParams.get("token") ?? extractBearer(req);
      if (!token) return json({ error: "Unauthorized" }, 401);
      const principal = await authenticateToken(env, token);
      if (!isAdmin(principal)) return json({ error: "Forbidden" }, 403);
      const rows = await env.DB
        .prepare("SELECT bucket_ts, bookings, payments, revenue, withdrawals, chats, operators FROM metric_timeseries ORDER BY bucket_ts DESC LIMIT 120")
        .all();
      return json({ points: rows.results ?? [] }, 200, { "Cache-Control": "no-store" });
    }

    return json({ error: "Not found" }, 404);
  },

  // Cron (*/1 in wrangler) folds the current minute into D1 and refreshes
  // live rates for connected operators.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(busStub(env).fetch("https://bus/tick", { method: "POST" }));
  },
};

async function handleHealth(env: Env): Promise<Response> {
  const checks: Record<string, string> = {};
  try { await env.DB.prepare("SELECT 1").first(); checks.d1 = "ok"; }
  catch (e) { checks.d1 = `fail: ${e instanceof Error ? e.message : "unknown"}`; }

  let operators = 0;
  try {
    const res = await busStub(env).fetch("https://bus/snapshot");
    const j = await res.json() as { operators?: number };
    operators = j.operators ?? 0;
  } catch { /* bus cold */ }

  return json(
    {
      status: checks.d1 === "ok" ? "ok" : "degraded",
      service: "zeal-admin-realtime",
      ts: new Date().toISOString(),
      checks,
      config: {
        ingestAuth: "supabase-service-role",
        wsTicketSecret: Boolean(env.WS_TICKET_SECRET),
        supabaseAuth: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
      },
      operators,
      auth: authSnapshot(),
    },
    checks.d1 === "ok" ? 200 : 503,
  );
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}
