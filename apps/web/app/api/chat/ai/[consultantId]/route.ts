// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Streaming AI chat with fillers
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";
import { handleAIChat, AIChatError } from "@zeal/database/ai-chat-handler";
import { loadPersona } from "@/lib/ai/persona-loader";
import { callAI } from "@/lib/ai/engine";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { z } from "zod";

// Vercel maxDuration
export const maxDuration = 60;


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

    // ─── Global rate limit (per-user) ────────────────────────────────────
    const rl = await checkRateLimit(aiRateLimiter, `ai-chat:${user.id}`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429, headers: rl.headers },
      );
    }

    // ─── Per-AI rate limit (10 msg/min per user per AI) ──────────────────
    const adminForRl = createAdminClient();
    const { data: rl2 } = await adminForRl.rpc("check_ai_rate_limit", {
      p_user_id: user.id,
      p_ai_id: consultantId,
      p_max_per_minute: 10,
    });
    const rlResult = rl2 as { ok?: boolean; retryAfter?: number } | null;
    if (rlResult && rlResult.ok === false) {
      return NextResponse.json(
        { error: "Slow down a moment — try again in a few seconds." },
        {
          status: 429,
          headers: { "Retry-After": String(rlResult.retryAfter ?? 10) },
        },
      );
    }

    // ─── Parse body ───────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
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

    // ─── Load persona (structured role contract) ─────────────────────────
    const persona = await loadPersona(consultantId);
    if (!persona) {
      return NextResponse.json(
        { error: "AI consultant not found or inactive" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();

    // ─── Detect filler locale from content (Hindi → "hi", else "hi-en") ──
    const hasDevanagari = /[\u0900-\u097F]/.test(content);
    const hasRomanHindi = /\b(hai|kya|nahi|haan|karo|kaise|mujhe|tum|aap)\b/i.test(content);
    const fillerLocale = hasDevanagari ? "hi" : "hi-en";
    void hasRomanHindi;

    // ─── Stream ───────────────────────────────────────────────────────────
    const { stream } = await handleAIChat({
      conversationId,
      consultantId,
      userId: user.id,
      content,
      persona,
      admin,
      callAI: async (opts) => {
        // The engine returns { response, provider, attempts }
        const result = await callAI({
          messages: opts.messages,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          stream: true,
          preferProvider: opts.preferProvider,
        });
        return result;
      },
      fillerLocale,
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
    console.error("[api/chat/ai]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
