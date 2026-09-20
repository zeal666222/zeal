// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Streaming AI chat (admin studio)
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";
import { handleAIChat, AIChatError } from "@zeal/database/ai-chat-handler";
import { loadPersona } from "@/lib/ai/persona-loader";
import { callAI } from "@/lib/ai";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ consultantId: string }> },
) {
  try {
    const { consultantId } = await params;

    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(aiRateLimiter, `ai-chat:${user.id}`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429, headers: rl.headers },
      );
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 422 },
      );
    }

    const { conversationId, content } = parsed.data;

    const persona = await loadPersona(consultantId);
    if (!persona) {
      return NextResponse.json(
        { error: "AI consultant not found or inactive" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();
    const { stream } = await handleAIChat({
      conversationId, consultantId, userId: user.id, content,
      persona, admin, callAI,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...rl.headers,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AIChatError) {
      const status =
        err.code === "NOT_PARTICIPANT" ? 403 :
        err.code === "TOO_LONG" || err.code === "EMPTY_CONTENT" ? 400 :
        500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "AI chat failed";
    console.error("[admin/api/chat/ai]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
