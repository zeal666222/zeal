// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Proxy to Cloudflare Worker (zeal-chat)
// ═══════════════════════════════════════════════════════════════════════════════
// The AI chat logic now runs on the Cloudflare Worker (zeal-chat).
// This route proxies the SSE stream back to the client.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { recordAi } from "@/lib/monitoring/ai-metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_URL = process.env.CHAT_WORKER_URL ?? "https://zeal-chat.zeal666-app.workers.dev";

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

  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch (e) {
    console.warn("[chat-proxy] getSession threw:", e instanceof Error ? e.message : e);
  }

  if (!accessToken) {
    console.warn("[chat-proxy] session missing after getUser — cookie jar likely stale", {
      consultantId,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Session expired — please refresh the page." },
      { status: 401 },
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
      console.error("[chat-proxy] worker error:", workerRes.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: "AI chat is momentarily unavailable — please try again." },
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
