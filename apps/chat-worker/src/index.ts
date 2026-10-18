import type { Env } from "./env";
import { validateJWT, extractBearer, authSnapshot } from "./auth";
import { loadPersona } from "./persona-loader";
import { tryAcquire, release } from "./chat-concurrency";
import { startChatBilling } from "./billing";
import { handleAIChat, type CallAIResult, type AIMessage } from "./ai-chat-handler";
import { snapshot as snapshotAiMetrics } from "./ai-metrics";
import { callAI } from "./ai-engine";
import { uploadToR2, deleteFromR2, listR2 } from "./storage";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
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
      return handleChatRequest(req, env, chatMatch[1], corsHeaders);
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
};

async function handleChatRequest(
  req: Request,
  env: Env,
  consultantId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // 1. Auth
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  const jwt = await validateJWT(env, token);
  if (!jwt?.sub) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }
  const userId = jwt.sub;

  // 2. Parse body
  let body: { conversationId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const { conversationId, content } = body;
  if (!conversationId || !content) {
    return Response.json({ error: "conversationId and content required" }, { status: 400, headers: corsHeaders });
  }
  if (content.length > 4000) {
    return Response.json({ error: "Message too long (max 4000 chars)" }, { status: 400, headers: corsHeaders });
  }

  // 3. Concurrency
  const acquire = tryAcquire(userId);
  if (!acquire.allowed) {
    return Response.json({ error: acquire.error ?? "Too many concurrent chats" }, { status: 429, headers: corsHeaders });
  }

  try {
    // 4. Load persona from D1
    const persona = await loadPersona(env, consultantId);
    if (!persona) {
      return Response.json({ error: "Consultant not found" }, { status: 404, headers: corsHeaders });
    }

    // 5. Billing (free consultants skip billing)
    if (persona.isPaid) {
      const billing = await startChatBilling(env, userId, consultantId, conversationId);
      if (!billing.success) {
        return Response.json(
          { error: billing.error ?? "Billing failed" },
          { status: billing.code === "INSUFFICIENT_BALANCE" ? 402 : 400, headers: corsHeaders },
        );
      }
    }

    // 6. Build callAI function bound to env
    const callAIFn = async (opts: { messages: AIMessage[]; stream?: boolean; temperature?: number; maxTokens?: number }): Promise<CallAIResult> => {
      const result = await callAI(env, {
        messages: opts.messages,
        stream: opts.stream,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
      return { response: result.response, provider: result.provider, attempts: result.attempts };
    };

    // 7. Handle chat (SSE stream)
    const { stream } = await handleAIChat({
      env,
      conversationId,
      consultantId,
      userId,
      content,
      persona,
      callAI: callAIFn,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
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
    // Release concurrency after stream completes
    // Note: in Workers, the response is returned immediately and the stream
    // continues in the background. We release after a reasonable timeout.
    setTimeout(() => release(userId), 60_000);
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

  const allOk = Object.values(checks).every((v) => v === "ok");
  const body = {
    status: allOk ? "ok" : "degraded",
    service: "zeal-chat",
    ts: new Date().toISOString(),
    checks,
    providers: {
      // Booleans only — never leak key material. A missing key causes the
      // engine to emit `provider:skip missing-api-key` and rotate to the
      // next slot in FALLBACK_CHAIN; hardcoded stays as last-resort.
      groq: Boolean(env.GROQ_API_KEY),
      cloudflareAi: Boolean(env.CF_AI_TOKEN && env.CF_ACCOUNT_ID),
      agnes: Boolean(env.AGNES_API_KEY),
      zhipu: Boolean(env.ZHIPU_API_KEY),
      keylessFallbacks: ["pollinations", "ovh", "kilo", "llm7", "duckduckgo", "freegpt"],
      lastResort: "hardcoded",
    },
    auth: authSnapshot(),
    ai: snapshotAiMetrics(),
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
