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
import { detectBirthData } from "@/lib/astrology/birth-data-detector";
import { interpretChart, type AstrologyAIResult } from "@/lib/ai/astrology-ai";
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
    const persona = await loadPersona(consultantId, user.id);
    if (!persona) {
      return NextResponse.json(
        { error: "AI consultant not found or inactive" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();

    // ─── Per-minute billing (auto-start for paid conversations) ───────────
    let billing: Record<string, unknown> | null = null;
    try {
      const { data: billingData } = await admin.rpc("auto_start_chat_billing", {
        p_conversation_id: conversationId,
        p_user_id: user.id,
      });
      billing = (billingData ?? null) as Record<string, unknown> | null;
    } catch {
      /* billing is best-effort; stream continues */
    }
    if (billing && billing.success === false && billing.error === "insufficient_balance") {
      return NextResponse.json(
        {
          error: "Insufficient wallet balance for this per-minute session.",
          code: "insufficient_balance",
          required: billing.required ?? persona.perMinuteRate,
          available: billing.available ?? 0,
        },
        { status: 402 },
      );
    }

    // ─── Detect filler locale from content (Hindi → "hi", else "hi-en") ──
    const hasDevanagari = /[\u0900-\u097F]/.test(content);
    const hasRomanHindi = /\b(hai|kya|nahi|haan|karo|kaise|mujhe|tum|aap)\b/i.test(content);
    const fillerLocale = hasDevanagari ? "hi" : "hi-en";
    void hasRomanHindi;

    // ─── Build initial SSE events ──────────────────────────────────────────
    const initialEvents: unknown[] = billing ? [{ billing }] : [];

    // ─── Astrology integration: detect birth data in message ──────────────
    let astrologyResult: AstrologyAIResult | null = null;
    let astrologyContext = "";
    const birthData = detectBirthData(content);
    if (birthData && birthData.confidence !== "low") {
      try {
        astrologyResult = await interpretChart({
          birthDate: birthData.birthDate,
          birthTime: birthData.birthTime,
          birthPlace: birthData.birthPlace,
          timezone: birthData.timezone,
          chartType: "vedic",
        });

        // Build a concise context string to inject into the system prompt
        const interp = astrologyResult.interpretation;
        astrologyContext = `\n\n[ASTROLOGY READING — Computed from user's birth data: ${birthData.birthDate} ${birthData.birthTime} at ${birthData.placeName}]\n`;
        astrologyContext += `\nChart Overview: ${interp.overview}`;
        if (interp.career) astrologyContext += `\nCareer: ${interp.career}`;
        if (interp.relationships) astrologyContext += `\nRelationships: ${interp.relationships}`;
        if (interp.dasha) astrologyContext += `\nCurrent Dasha: ${interp.dasha}`;
        if (interp.remedies) astrologyContext += `\nRemedies: ${interp.remedies}`;
        if (interp.chartSummary) astrologyContext += `\nTechnical: ${interp.chartSummary}`;
        astrologyContext += "\n\nUse this chart data to provide insightful, personalized guidance when relevant. Reference specific planetary positions and classical texts.";

        // Emit astrology data as an initial SSE event so the UI can display it
        initialEvents.push({
          astrology: {
            interpretation: astrologyResult.interpretation,
            chart: astrologyResult.chart,
            ruleBasedInterpretations: astrologyResult.ruleBasedInterpretations,
            birthData: {
              date: birthData.birthDate,
              time: birthData.birthTime,
              place: birthData.placeName,
            },
          },
        });
      } catch (err) {
        console.error("[chat/ai] Astrology computation failed:", err);
        // Non-fatal — continue with normal chat
      }
    }

    // Inject astrology context into persona's system prompt if available
    if (astrologyContext) {
      persona.systemPrompt = persona.systemPrompt + astrologyContext;
    }

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
      initialEvents,
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
