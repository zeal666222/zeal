// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Proxy to Cloudflare Worker (zeal-chat)
// ═══════════════════════════════════════════════════════════════════════════════
// The AI chat logic now runs on the Cloudflare Worker (zeal-chat).
// This route proxies the SSE stream back to the client.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_URL = process.env.CHAT_WORKER_URL ?? "https://zeal-chat.zeal666-app.workers.dev";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ consultantId: string }> },
) {
  const { consultantId } = await params;

  const supabase = createServerClientFromCookies();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
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

    return new Response(workerRes.body, {
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
    return NextResponse.json(
      { error: "AI chat is momentarily unavailable — please try again." },
      { status: 502 },
    );
  }
}
