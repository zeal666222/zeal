// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Proxy to Cloudflare Worker (zeal-chat)
// ═══════════════════════════════════════════════════════════════════════════════
// The AI chat logic now runs on the Cloudflare Worker (zeal-chat).
// This route proxies the SSE stream back to the client.
//
// Auth contract:
//   Signed-in users are gated by startChatFlow() before ever reaching the
//   chat page, and every other surface (Wallet, Profile, etc.) already
//   trusts Supabase cookies. So a 401 from this proxy is almost always a
//   false negative caused by @supabase/ssr's SessionStore refusing to
//   hydrate on Vercel's route-handler cookie adapter. We therefore:
//     1. ask the SSR client for a session (fast path);
//     2. if that returns null, decode the raw `sb-*-access-token` cookie
//        jar (handles @supabase/ssr's chunked cookie format);
//     3. only 401 when both fail AND getUser() has no identity to fall
//        back on — i.e. when the user genuinely is not signed in.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "@zeal/database/server";
import { recordAi } from "@/lib/monitoring/ai-metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_URL = process.env.CHAT_WORKER_URL ?? "https://zeal-chat.zeal666-app.workers.dev";

function projectRefFromUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function safeJsonOr(text: string, fallback: unknown): unknown {
  try { return JSON.parse(text); } catch { return fallback; }
}

// Supabase's @supabase/ssr storage layout has shifted over time; support both:
//   * `sb-<ref>-access-token`       — legacy single-JSON-string session blob
//   * `sb-<ref>-auth-token`         — current whole-session JSON, often chunked
//                                     as `<base>.0`, `<base>.1`, ... encoded as
//                                     `<byteLength>|<payload>~`
// We reassemble the chunks in ascending index order, strip the length prefix
// and trailing tilde, and either JSON.parse for `{ access_token }` or accept a
// raw JWT if the value already looks like one.
async function readAccessTokenFromCookieJar(): Promise<string | null> {
  const ref = projectRefFromUrl();
  if (!ref) return null;
  const jar = Object.fromEntries((await cookies()).getAll().map((c) => [c.name, c.value]));

  const candidateBases = [`sb-${ref}-auth-token`, `sb-${ref}-access-token`];
  for (const base of candidateBases) {
    const direct = jar[base];
    if (direct) {
      const tok = extractTokenFromValue(direct);
      if (tok) return tok;
    }
    const chunkNames = Object.keys(jar)
      .filter((k) => k.startsWith(`${base}.`))
      .map((k) => ({ name: k, idx: Number(k.slice(base.length + 1)) }))
      .filter((c) => Number.isFinite(c.idx))
      .sort((a, b) => a.idx - b.idx);
    if (!chunkNames.length) continue;
    let out = "";
    let ok = true;
    for (const { name } of chunkNames) {
      const raw = jar[name] ?? "";
      const sep = raw.indexOf("|");
      if (sep < 0) { ok = false; break; }
      const payload = raw.slice(sep + 1);
      out += payload.endsWith("~") ? payload.slice(0, -1) : payload;
    }
    if (!ok || out.length < 20) continue;
    const tok = extractTokenFromValue(out);
    if (tok) return tok;
  }
  return null;
}

function extractTokenFromValue(value: string): string | null {
  // Raw JWT?
  if (value.split(".").length === 3 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    return value;
  }
  try {
    const obj = JSON.parse(value) as { access_token?: string };
    return obj.access_token ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ consultantId: string }> },
) {
  const { consultantId } = await params;

  const supabase = await createServerClientFromCookies();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  // A soft refresh warning (AuthRetryableFetchError, transient network blip)
  // still yields a populated `user` — only bail when we truly have no identity.
  if (!user) {
    console.warn("[chat-proxy] no user", {
      consultantId,
      authErr: authErr?.message ?? null,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken: string | null | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch (e) {
    console.warn("[chat-proxy] getSession threw:", e instanceof Error ? e.message : e);
  }

  if (!accessToken) {
    accessToken = await readAccessTokenFromCookieJar();
    if (accessToken) {
      console.info("[chat-proxy] recovered token from cookie jar", {
        consultantId,
        userId: user.id,
      });
    }
  }

  if (!accessToken) {
    // Identity is valid but we have nothing to hand the worker. The chat
    // surface has already gated this user; treat this as a transient
    // infrastructure issue rather than a "please sign in" dead-end.
    console.error("[chat-proxy] signed-in user without access token", {
      consultantId,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Session is warming up — please try again in a moment." },
      { status: 503 },
    );
  }

  let body: string;
  try {
    body = await req.text();
    JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workerUrl = `${WORKER_URL}/api/chat/ai/${consultantId}`;
  try {
    const workerRes = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text().catch(() => "");
      console.error("[chat-proxy] worker error:", workerRes.status, errText.slice(0, 200), {
        consultantId,
        userId: user.id,
        hasToken: Boolean(accessToken),
        tokenPrefix: accessToken ? `${accessToken.slice(0, 12)}…` : null,
      });
      // Surface worker diagnostics verbatim for 401/403 so the client (and
      // Vercel logs) can tell apart "no bearer" vs "signature mismatch" vs
      // "consultant not found" — a generic message here hides the true cause.
      const isAuthError = workerRes.status === 401 || workerRes.status === 403;
      return NextResponse.json(
        isAuthError && errText
          ? safeJsonOr(errText, { error: errText.slice(0, 200), workerStatus: workerRes.status })
          : { error: "AI chat is momentarily unavailable — please try again.", workerStatus: workerRes.status },
        { status: workerRes.status },
      );
    }

    return new Response(tapAiStream(workerRes.body, consultantId), {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat-proxy] fetch failed:", err instanceof Error ? err.message : err);
    recordAi({
      consultantId,
      provider: "worker",
      ttftMs: 0,
      totalMs: 0,
      tokens: 0,
      retries: 0,
      ok: false,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "AI chat is momentarily unavailable — please try again." },
      { status: 502 },
    );
  }
}

function tapAiStream(body: ReadableStream<Uint8Array> | null, consultantId: string): ReadableStream<Uint8Array> | null {
  if (!body) return body;
  const t0 = Date.now();
  let firstAt = 0;
  let tokens = 0;
  let providerHint = "worker";
  const decoder = new TextDecoder();
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) {
        const totalMs = Date.now() - t0;
        recordAi({
          consultantId,
          provider: providerHint,
          ttftMs: firstAt || totalMs,
          totalMs,
          tokens,
          retries: 0,
          ok: true,
        });
        try { ctrl.close(); } catch { /* closed */ }
        return;
      }
      ctrl.enqueue(value);
      const chunk = decoder.decode(value, { stream: true });
      if (firstAt === 0 && chunk.includes("delta")) firstAt = Date.now() - t0;
      tokens += (chunk.match(/"delta"/g) ?? []).length;
      const pm = chunk.match(/"provider":"([a-z0-9-]+)"/i);
      if (pm && pm[1]) providerHint = pm[1];
    },
    cancel(reason) {
      try { reader.cancel(reason); } catch { /* ignore */ }
      const totalMs = Date.now() - t0;
      recordAi({
        consultantId,
        provider: providerHint,
        ttftMs: firstAt || totalMs,
        totalMs,
        tokens,
        retries: 0,
        ok: false,
        err: "cancelled",
      });
    },
  });
}
