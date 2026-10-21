import type { Env } from "./env";
import { validateJWT, extractBearer, authSnapshot, mintRoomTicket } from "./auth";
import { loadPersona, seekerContextFor } from "./persona-loader";
import { tryAcquire, release, stats as gateStats } from "./chat-concurrency";
import { handleAIChat, type CallAIResult, type AIMessage } from "./ai-chat-handler";
import { snapshot as snapshotAiMetrics } from "./ai-metrics";
import { callAI } from "./ai-engine";
import { uploadToR2, deleteFromR2, listR2 } from "./storage";
import { ChatGate } from "./chat-gate";
import { ChatRoom } from "./chat-room";
import {
  getOrCreateConversation,
  isAiConversationId,
  listConversations,
  loadConversation,
  readMessages,
  requireParticipant,
  isoOf,
} from "./conversation-store";
import { describeProfile, readSeekerProfile, saveSeekerProfile, type SeekerPatch } from "./seeker-profile";

export { ChatGate, ChatRoom };

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check — includes D1 + R2 connectivity
    if (url.pathname === "/api/health" && req.method === "GET") {
      return handleHealth(req, env, corsHeaders);
    }

    // Consultant diagnostic — verifies PersonaEngine loads for every consultant
    if (url.pathname === "/api/consultants/diagnostic" && req.method === "GET") {
      return handleConsultantsDiagnostic(env, corsHeaders);
    }

    // Provider chain probe (requires service-role key header, gated)
    if (url.pathname === "/api/providers/probe" && req.method === "POST") {
      return handleProvidersProbe(req, env, corsHeaders);
    }

    // File upload → R2
    if (url.pathname === "/api/upload" && req.method === "POST") {
      return handleUpload(req, env, corsHeaders);
    }

    // List user uploads
    if (url.pathname === "/api/uploads" && req.method === "GET") {
      return handleListUploads(req, env, corsHeaders);
    }

    // Delete upload
    const deleteMatch = url.pathname.match(/^\/api\/uploads\/(.+)$/);
    if (deleteMatch && req.method === "DELETE") {
      return handleDeleteUpload(req, env, decodeURIComponent(deleteMatch[1]), corsHeaders);
    }

    // AI Chat SSE endpoint
    const chatMatch = url.pathname.match(/^\/api\/chat\/ai\/([a-z0-9-]+)$/);
    if (chatMatch && req.method === "POST") {
      return handleChatRequest(req, env, ctx, chatMatch[1], corsHeaders);
    }

    // ── Conversations (D1 owns AI rooms end to end) ──
    if (url.pathname === "/api/conversations" && req.method === "POST") {
      return handleCreateConversation(req, env, corsHeaders);
    }
    if (url.pathname === "/api/conversations" && req.method === "GET") {
      return handleListConversations(req, env, corsHeaders);
    }

    // ── Seeker birth profile (the intake form's answers) ──
    if (url.pathname === "/api/profile/birth" && (req.method === "GET" || req.method === "PUT")) {
      return handleBirthProfile(req, env, corsHeaders);
    }

    const conversationMatch = url.pathname.match(/^\/api\/conversations\/([A-Za-z0-9_-]+)(\/[a-z-]+)?$/);
    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      const sub = conversationMatch[2];
      if (!isAiConversationId(conversationId)) {
        return Response.json({ error: "Not an AI conversation" }, { status: 404, headers: corsHeaders });
      }
      if (!sub && req.method === "GET") {
        return handleGetConversation(req, env, conversationId, corsHeaders);
      }
      if (sub === "/messages" && req.method === "GET") {
        return handleGetMessages(req, env, conversationId, corsHeaders);
      }
      if (sub === "/ws-ticket" && req.method === "GET") {
        return handleWsTicket(req, env, conversationId, corsHeaders);
      }
      if (sub === "/ws") {
        // The socket lives on the Durable Object; hand the request straight to
        // it. The ticket in the query string is what authenticates the upgrade.
        return forwardToRoom(env, conversationId, req);
      }
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
};

async function requireUserId(req: Request, env: Env): Promise<string | null> {
  const token = extractBearer(req);
  if (!token) return null;
  const jwt = await validateJWT(env, token);
  return jwt?.sub ?? null;
}

async function handleChatRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  consultantId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // 1. Auth — the token's `sub` is the only identity a turn can speak for.
  const userId = await requireUserId(req, env);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  // 2. Parse body. Birth details are deliberately NOT accepted here: an
  //    `astro` object in the request used to be injected into the system
  //    prompt verbatim, which is how one seeker's chart reached another's.
  let body: { conversationId?: string; content?: string; opener?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const { content, opener } = body;
  // A normal turn needs user content; an opener turn is generated proactively.
  if (!opener && !content) {
    return Response.json({ error: "content required" }, { status: 400, headers: corsHeaders });
  }
  if (content && content.length > 4000) {
    return Response.json({ error: "Message too long (max 4000 chars)" }, { status: 400, headers: corsHeaders });
  }

  // 3. Room: the caller's id if it is genuinely theirs, else this seeker's
  //    standing room with this consultant, created on first use.
  let conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (conversationId && !isAiConversationId(conversationId)) {
    return Response.json({ error: "Not an AI conversation" }, { status: 404, headers: corsHeaders });
  }
  if (conversationId && !(await requireParticipant(env, conversationId, userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
  }
  if (!conversationId) {
    conversationId = (await getOrCreateConversation(env, userId, consultantId)).conversationId;
  }

  // 4. Concurrency
  const acquire = await tryAcquire(env, userId);
  if (!acquire.allowed) {
    return Response.json({ error: acquire.error ?? "Too many concurrent chats" }, { status: 429, headers: corsHeaders });
  }
  const leaseId = acquire.leaseId;

  try {
    // 5. Persona, grounded in this seeker's stored intake — never in the body.
    const seekerRow = await readSeekerProfile(env, userId);
    const persona = await loadPersona(env, consultantId, seekerContextFor(seekerRow));
    if (!persona) {
      return Response.json({ error: "Consultant not found" }, { status: 404, headers: corsHeaders });
    }

    // 6. Paid AI consultants are refused rather than billed. Money lives in
    //    Supabase's ledger and its billing RPC takes a Supabase conversation
    //    uuid; an AI room has no such row by design, so there is nothing safe
    //    to debit against. Refusing loudly beats charging the wrong thing —
    //    and every AI consultant is free today.
    if (persona.isPaid || persona.perMinuteRate > 0) {
      return Response.json(
        { error: "This AI consultant is paid and is not available on the free chat path yet." },
        { status: 409, headers: corsHeaders },
      );
    }

    // 7. Build callAI function bound to env
    const callAIFn = async (opts: { messages: AIMessage[]; stream?: boolean; temperature?: number; maxTokens?: number }): Promise<CallAIResult> => {
      const result = await callAI(env, {
        messages: opts.messages,
        stream: opts.stream,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
      return { response: result.response, provider: result.provider, attempts: result.attempts };
    };

    // 8. Handle chat (SSE stream)
    const { stream } = await handleAIChat({
      env,
      conversationId,
      consultantId,
      userId,
      content: content ?? "",
      persona,
      callAI: callAIFn,
      opener: opener === true,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[chat-worker] error:", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "AI chat is momentarily unavailable — please try again." },
      { status: 500, headers: corsHeaders },
    );
  } finally {
    // Release concurrency after stream completes. Use ctx.waitUntil so the
    // worker runtime keeps the isolate alive long enough for the release to
    // reach the Durable Object — the old detached setTimeout was cancelled
    // when the isolate froze, leaking slots and producing false 429s.
    if (leaseId) {
      ctx.waitUntil(release(env, leaseId));
    }
  }
}

// ─── Health (D1 + R2 + Supabase connectivity) ────────────────────────────────

let healthCache: { at: number; body: unknown; status: number } | null = null;
const HEALTH_TTL_MS = 5_000;

async function handleHealth(
  _req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) {
    return Response.json(healthCache.body, {
      status: healthCache.status,
      headers: { ...corsHeaders, "X-Health-Cache": "hit" },
    });
  }
  const checks: Record<string, string> = {};

  try {
    await env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch (e) {
    checks.d1 = `fail: ${e instanceof Error ? e.message : "unknown"}`;
  }

  try {
    await env.BUCKET.list({ limit: 1 });
    checks.r2 = "ok";
  } catch (e) {
    checks.r2 = `fail: ${e instanceof Error ? e.message : "unknown"}`;
  }

  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    checks.supabase = res.ok ? "ok" : `fail: ${res.status}`;
  } catch (e) {
    checks.supabase = `fail: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // AI chat reads, writes and streams entirely from D1/R2/Workers AI, so only
  // those decide `ok`. Supabase still gates paid-consultant billing and login,
  // but an outage there must not make the free AI chat look broken.
  const critical = ["d1", "r2"];
  const allOk = critical.every((k) => checks[k] === "ok") && Boolean(env.AI);
  const body = {
    status: allOk ? "ok" : "degraded",
    service: "zeal-chat",
    ts: new Date().toISOString(),
    checks,
    advisory: { supabase: checks.supabase },
    providers: {
      // Booleans only — never leak key material. A missing key causes the
      // engine to emit `provider:skip missing-api-key` and rotate to the
      // next slot in FALLBACK_CHAIN; hardcoded stays as last-resort.
      cloudflare: Boolean(env.AI),
      cloudflareAi: Boolean(env.CF_AI_TOKEN && env.CF_ACCOUNT_ID),
      groq: Boolean(env.GROQ_API_KEY),
      zhipu: Boolean(env.ZHIPU_API_KEY),
      keylessFallbacks: ["pollinations", "ovh", "kilo", "llm7", "duckduckgo", "freegpt"],
      lastResort: "hardcoded",
    },
    realtime: env.CHAT_ROOM ? "configured" : "missing-binding",
    auth: authSnapshot(),
    ai: snapshotAiMetrics(),
    gate: await gateStats(env),
  };
  const status = allOk ? 200 : 503;
  healthCache = { at: Date.now(), body, status };
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "X-Health-Cache": "miss" },
  });
}

// ─── Upload → R2 ─────────────────────────────────────────────────────────────

async function handleUpload(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  const jwt = await validateJWT(env, token);
  if (!jwt?.sub) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType || contentType === "application/json") {
    return Response.json({ error: "Send file as binary body with correct Content-Type" }, { status: 400, headers: corsHeaders });
  }

  const prefix = new URL(req.url).searchParams.get("prefix") ?? "uploads";

  try {
    const body = await req.arrayBuffer();
    const result = await uploadToR2(env, body, contentType, jwt.sub, prefix);
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
  }
}

// ─── List uploads ────────────────────────────────────────────────────────────

async function handleListUploads(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  const jwt = await validateJWT(env, token);
  if (!jwt?.sub) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }

  const prefix = new URL(req.url).searchParams.get("prefix") ?? `uploads/`;
  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "50", 10);

  const objects = await listR2(env, prefix, Math.min(limit, 200));
  return Response.json({ objects }, { headers: corsHeaders });
}

// ─── Delete upload ───────────────────────────────────────────────────────────

async function handleDeleteUpload(
  req: Request,
  env: Env,
  key: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  const jwt = await validateJWT(env, token);
  if (!jwt?.sub) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }

  if (!key || key.includes("..")) {
    return Response.json({ error: "Invalid key" }, { status: 400, headers: corsHeaders });
  }

  await deleteFromR2(env, key);
  return Response.json({ deleted: key }, { headers: corsHeaders });
}

// ─── Consultant diagnostic (public, metadata only) ──────────────────────────
// Memoized for 60s per isolate. Without this, 200+ concurrent VUs turn into
// 200 × 37 sequential D1 reads and saturate the free-tier DB — the single
// biggest p95 driver on the load harness.
let diagCache: { at: number; body: unknown } | null = null;
const DIAG_TTL_MS = 60_000;

async function handleConsultantsDiagnostic(
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (diagCache && Date.now() - diagCache.at < DIAG_TTL_MS) {
    return Response.json(diagCache.body, {
      headers: { ...corsHeaders, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", "X-Diag-Cache": "hit" },
    });
  }
  const { results } = await env.DB.prepare(
    `SELECT id FROM ai_consultant WHERE is_active = 1 ORDER BY id`
  ).all<{ id: string }>();

  const rows = results ?? [];
  const out: Array<Record<string, unknown>> = [];
  const failures: Array<{ id: string; error: string }> = [];

  // Parallelise persona loads — 37 sequential round-trips is the whole cost.
  await Promise.all(rows.map(async (r) => {
    try {
      const p = await loadPersona(env, r.id);
      if (!p) { failures.push({ id: r.id, error: "loader returned null" }); return; }
      out.push({
        id: p.id,
        name: p.name,
        category: p.category,
        prompt_length: p.systemPrompt.length,
        fewshot_count: (p.fewShots ?? []).length,
        has_specialties: p.specialties.length > 0,
        has_languages: p.languages.length > 0,
        is_paid: p.isPaid,
      });
    } catch (e) {
      failures.push({ id: r.id, error: e instanceof Error ? e.message : "unknown" });
    }
  }));

  const short = out.filter((c) => (c.prompt_length as number) < 800).map((c) => c.id);

  const body = {
    total: rows.length,
    loaded: out.length,
    failed: failures.length,
    failures,
    prompts_under_800_chars: short,
    avg_prompt_length: out.length ? Math.round(out.reduce((s, c) => s + (c.prompt_length as number), 0) / out.length) : 0,
    avg_fewshots: out.length ? Math.round(out.reduce((s, c) => s + (c.fewshot_count as number), 0) / out.length) : 0,
    sample: out.slice(0, 3),
  };
  diagCache = { at: Date.now(), body };
  return Response.json(body, {
    headers: { ...corsHeaders, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", "X-Diag-Cache": "miss" },
  });
}

// ─── Provider chain probe (service-role gated) ───────────────────────────────

async function handleProvidersProbe(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const key = req.headers.get("x-service-key");
  if (!key || key !== env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
  }

  let body: { consultantId?: string; message?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const consultantId = body.consultantId ?? "ai-astro-priya";
  const message = body.message ?? "Namaste, who are you?";

  const started = Date.now();
  try {
    const persona = await loadPersona(env, consultantId);
    if (!persona) {
      return Response.json({ error: `Consultant ${consultantId} not found` }, { status: 404, headers: corsHeaders });
    }
    const messages = [
      { role: "system" as const, content: persona.systemPrompt },
      { role: "user" as const, content: message },
    ];

    const result = await callAI(env, {
      messages,
      stream: true,
      temperature: 0.7,
      maxTokens: 200,
    });

    // Read a small slice of the stream to confirm tokens flow
    let sample = "";
    if (result.response.body) {
      const reader = result.response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      while (chunks < 30 && sample.length < 400) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks++;
        sample += decoder.decode(value, { stream: true });
      }
      try { await reader.cancel(); } catch { /* ok */ }
    }

    return Response.json(
      {
        ok: true,
        consultantId: persona.id,
        persona_name: persona.name,
        prompt_chars: persona.systemPrompt.length,
        fewshots: persona.fewShots.length,
        provider: result.provider,
        attempts: result.attempts,
        duration_ms: Date.now() - started,
        sample_tokens: sample.slice(0, 400),
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    return Response.json(
      {
        ok: false,
        consultantId,
        duration_ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502, headers: corsHeaders },
    );
  }
}

// ─── AI conversations ────────────────────────────────────────────────────────
//
// Everything an AI room needs — minting it, listing it, reading its transcript,
// the seeker's intake, and the realtime socket — is served from this worker and
// backed by D1. Supabase is not on any of these paths.

const CONSULTANT_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

async function handleCreateConversation(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userId = await requireUserId(req, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  let body: { consultantId?: string } = {};
  try { body = await req.json(); } catch { /* falls through to validation */ }
  const consultantId = typeof body.consultantId === "string" ? body.consultantId : "";
  if (!CONSULTANT_ID_RE.test(consultantId)) {
    return Response.json({ error: "consultantId required" }, { status: 400, headers: corsHeaders });
  }

  const live = await env.DB.prepare(
    `SELECT 1 AS ok FROM ai_consultant WHERE id = ? AND is_active = 1`
  ).bind(consultantId).first<{ ok: number }>();
  if (!live) return Response.json({ error: "Consultant not found" }, { status: 404, headers: corsHeaders });

  const { conversationId, reused } = await getOrCreateConversation(env, userId, consultantId);
  return Response.json({ conversationId, isAI: true, reused }, { headers: corsHeaders });
}

async function handleListConversations(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userId = await requireUserId(req, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const rows = await listConversations(env, userId);
  return Response.json(
    {
      conversations: rows.map((r) => ({
        conversationId: r.id,
        consultantId: r.ai_consultant_id,
        createdAt: r.created_at ? isoOf(r.created_at) : null,
        lastMessageAt: r.last_message_at ? isoOf(r.last_message_at) : null,
        lastMessageText: r.last_message_text,
        consultantName: r.consultant_name,
        consultantAvatar: r.consultant_avatar,
        consultantCategory: r.consultant_category,
      })),
    },
    { headers: corsHeaders },
  );
}

/** Room metadata the chat page needs: who the consultant is and what intake is missing. */
async function handleGetConversation(
  req: Request,
  env: Env,
  conversationId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userId = await requireUserId(req, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const room = await loadConversation(env, conversationId);
  if (!room || room.user_id !== userId) {
    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }

  const consultant = room.ai_consultant_id
    ? await env.DB.prepare(
        `SELECT id, name, avatar, category, per_minute_rate, is_paid FROM ai_consultant WHERE id = ?`,
      ).bind(room.ai_consultant_id).first<{
        id: string; name: string; avatar: string | null; category: string;
        per_minute_rate: number; is_paid: number;
      }>()
    : null;

  const state = describeProfile(await readSeekerProfile(env, userId));
  return Response.json(
    {
      conversationId: room.id,
      isAI: true,
      consultantId: consultant?.id ?? room.ai_consultant_id,
      consultant: consultant
        ? {
            id: consultant.id,
            name: consultant.name,
            avatar: consultant.avatar,
            category: consultant.category,
            rate: consultant.per_minute_rate ?? 0,
            isPaid: consultant.is_paid === 1,
          }
        : null,
      intake: {
        chartStale: state.chartStale,
        hasBirthData: state.hasBirthData,
        missing: state.missing,
      },
    },
    { headers: corsHeaders },
  );
}

async function handleGetMessages(
  req: Request,
  env: Env,
  conversationId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userId = await requireUserId(req, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  if (!(await requireParticipant(env, conversationId, userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
  }

  const raw = Number(new URL(req.url).searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 1), 200);
  const rows = await readMessages(env, conversationId, limit);

  return Response.json(
    {
      messages: rows.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        content: m.content,
        type: m.type,
        createdAt: isoOf(m.created_at),
      })),
    },
    { headers: corsHeaders },
  );
}

// ─── Seeker birth profile ────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function readPatch(body: Record<string, unknown>): SeekerPatch | { error: string } {
  const str = (v: unknown, max: number): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string") return "";
    const t = v.trim();
    return t.length <= max ? t : "";
  };
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const patch: SeekerPatch = {};
  const name = str(body.name, 80);
  if (name === "") return { error: "name too long" };
  if (name) patch.name = name;

  const dob = str(body.dob, 10);
  if (dob !== undefined && dob !== "" && !DATE_RE.test(dob)) return { error: "dob must be YYYY-MM-DD" };
  if (dob) patch.dob = dob;

  const tob = str(body.tob, 5);
  if (tob !== undefined && tob !== "" && !TIME_RE.test(tob)) return { error: "tob must be HH:MM" };
  if (tob) patch.tob = tob;

  const pob = str(body.pob, 120);
  if (pob === "") return { error: "pob too long" };
  if (pob) patch.pob = pob;

  const lat = num(body.latitude);
  if (lat !== undefined && (lat < -90 || lat > 90)) return { error: "latitude out of range" };
  if (lat !== undefined) patch.latitude = lat;

  const lng = num(body.longitude);
  if (lng !== undefined && (lng < -180 || lng > 180)) return { error: "longitude out of range" };
  if (lng !== undefined) patch.longitude = lng;

  const gender = str(body.gender, 20);
  if (gender !== undefined && gender !== "") patch.gender = gender;

  const concern = str(body.concern, 500);
  if (concern === "") return { error: "concern too long" };
  if (concern) patch.concern = concern;

  const chart = str(body.chartSummary, 20000);
  if (chart === "") return { error: "chartSummary too large" };
  if (chart) patch.chartSummary = chart;

  return patch;
}

async function handleBirthProfile(
  req: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userId = await requireUserId(req, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  if (req.method === "GET") {
    const state = describeProfile(await readSeekerProfile(env, userId));
    return Response.json(profilePayload(state), { headers: corsHeaders });
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }
  const patch = readPatch(body);
  if ("error" in patch) {
    return Response.json({ error: patch.error }, { status: 400, headers: corsHeaders });
  }

  const row = await saveSeekerProfile(env, userId, patch);
  return Response.json(profilePayload(describeProfile(row)), { headers: corsHeaders });
}

function profilePayload(state: ReturnType<typeof describeProfile>) {
  const p = state.profile;
  return {
    profile: p
      ? {
          name: p.name,
          dob: p.dob,
          tob: p.tob,
          pob: p.pob,
          latitude: p.latitude,
          longitude: p.longitude,
          gender: p.gender,
          concern: p.concern,
          hasChart: Boolean(p.chart_summary),
          updatedAt: p.updated_at ? isoOf(p.updated_at) : null,
        }
      : null,
    chartStale: state.chartStale,
    hasBirthData: state.hasBirthData,
    missing: state.missing,
  };
}

// ─── Realtime room ───────────────────────────────────────────────────────────
// A browser WebSocket cannot send an Authorization header, so the client asks
// for a short-lived ticket here and puts it in the upgrade URL's query string.

async function handleWsTicket(
  req: Request,
  env: Env,
  conversationId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userId = await requireUserId(req, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  if (!(await requireParticipant(env, conversationId, userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
  }
  const ticket = await mintRoomTicket(env, userId, conversationId);
  if (!ticket) {
    return Response.json({ error: "Realtime unavailable" }, { status: 503, headers: corsHeaders });
  }
  return Response.json({ ticket, expiresInSeconds: 30 }, { headers: corsHeaders });
}

async function forwardToRoom(env: Env, conversationId: string, req: Request): Promise<Response> {
  if (!env.CHAT_ROOM) {
    return Response.json({ error: "Realtime unavailable" }, { status: 503 });
  }
  const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(conversationId));
  const search = new URL(req.url).search;
  return stub.fetch(new Request(`https://room/ws${search}`, {
    method: "GET",
    headers: req.headers,
  }));
}
