// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Proxy to Cloudflare Worker (zeal-chat)
// ═══════════════════════════════════════════════════════════════════════════════
// The AI conversation runs entirely on the worker: the room, the transcript,
// the provider chain and the reply are all Cloudflare's. This route hands the
// seeker's own bearer token to the worker and pipes the SSE stream back.
//
// What is deliberately NOT forwarded: the seeker's birth details. They used to
// travel in an `astro` object on the request body and were injected into the
// system prompt verbatim, so a crafted or buggy client could make a consultant
// read out another person's kundali. The worker now reads them from its own
// store under `jwt.sub`; this route only makes sure that store holds a current
// chart.
//
// Auth contract: a signed-in user reaching this route was gated upstream by
// startChatFlow(), and a 401 here is almost always @supabase/ssr's SessionStore
// refusing to hydrate on Vercel's cookie adapter — see lib/auth/access-token.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { resolveWorkerAuth } from "@/lib/auth/access-token";
import { refreshSeekerState } from "@/lib/chat/seeker-sync";
import { WORKER_URL } from "@/lib/chat/worker";
import { recordAi } from "@/lib/monitoring/ai-metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeJsonOr(text: string, fallback: unknown): unknown {
  try { return JSON.parse(text); } catch { return fallback; }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ consultantId: string }> },
) {
  const { consultantId } = await params;

  const auth = await resolveWorkerAuth();
  if (!auth.userId) {
    console.warn("[chat-proxy] no user", { consultantId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, accessToken } = auth;

  if (!accessToken) {
    // Identity is valid but we have nothing to hand the worker. The chat
    // surface has already gated this user; treat this as a transient
    // infrastructure issue rather than a "please sign in" dead-end.
    console.error("[chat-proxy] signed-in user without access token", {
      consultantId,
      userId,
      authError: "authError" in auth ? auth.authError ?? null : null,
    });
    return NextResponse.json(
      { error: "Session is warming up — please try again in a moment." },
      { status: 503 },
    );
  }

  let parsed: { conversationId?: string; content?: string; opener?: boolean };
  try {
    parsed = JSON.parse(await req.text());
    if (!parsed || typeof parsed !== "object") throw new Error("bad body");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Ground the consultant in the seeker's kundali. The chart is computed here
  // (the worker has no ephemeris) and then lives in the worker's D1, so an
  // ephemeris run costs the first turn or an intake edit — not every turn.
  // Failure is non-fatal: the chat degrades to a persona-only reply, not a 500.
  try {
    await refreshSeekerState(userId, accessToken, { seed: true });
  } catch (e) {
    console.warn("[chat-proxy] seeker sync failed:", e instanceof Error ? e.message : e);
  }

  const forwardBody = JSON.stringify({
    conversationId: parsed.conversationId,
    content: parsed.content,
    opener: parsed.opener === true,
  });

  const workerUrl = `${WORKER_URL}/api/chat/ai/${consultantId}`;
  try {
    const workerRes = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: forwardBody,
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text().catch(() => "");
      console.error("[chat-proxy] worker error:", workerRes.status, errText.slice(0, 200), {
        consultantId,
        userId,
        hasToken: Boolean(accessToken),
        tokenPrefix: accessToken ? `${accessToken.slice(0, 12)}…` : null,
      });
      // Surface worker diagnostics verbatim for the statuses where the cause is
      // actionable (auth, forbidden room, unknown consultant, paid consultant,
      // concurrency) — a generic message here hides the true reason.
      const isDiagnostic = workerRes.status === 401
        || workerRes.status === 403
        || workerRes.status === 404
        || workerRes.status === 409
        || workerRes.status === 429;
      return NextResponse.json(
        isDiagnostic && errText
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
