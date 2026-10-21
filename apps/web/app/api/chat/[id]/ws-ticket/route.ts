// apps/web/app/api/chat/[id]/ws-ticket/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Mint a short-lived realtime ticket for an AI room and hand back the socket URL.
//
// The browser never holds the Supabase bearer — @supabase/ssr keeps the session
// in httpOnly cookies — so the upgrade credential has to be minted server-side.
// The worker derives it from the same JWT secret it uses for the SSE auth check,
// ties it to this user + conversation, and the Durable Object re-verifies it
// before accepting the socket.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { resolveWorkerAuth } from "@/lib/auth/access-token";
import { wsTicket, wsUrl, isAiConversationId, WorkerError } from "@/lib/chat/worker";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  if (!isAiConversationId(conversationId)) {
    return NextResponse.json({ error: "Not an AI conversation" }, { status: 404 });
  }

  const auth = await resolveWorkerAuth();
  if (!auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.accessToken) {
    return NextResponse.json(
      { error: "Session is warming up — please try again in a moment." },
      { status: 503 },
    );
  }

  try {
    const { ticket, expiresInSeconds } = await wsTicket(auth.accessToken, conversationId);
    return NextResponse.json(
      { ticket, url: wsUrl(conversationId, ticket), expiresInSeconds },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const status = err instanceof WorkerError && err.status === 404 ? 404 : 502;
    const message = err instanceof Error ? err.message : "Realtime unavailable";
    return NextResponse.json({ error: message }, { status });
  }
}
