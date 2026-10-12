// ============================================================================
// POST /api/astrology/interpret — AI-powered astrology interpretation
// ============================================================================
// Takes birth data, computes the chart, retrieves relevant knowledge via RAG,
// and calls the LLM for a natural language interpretation.
//
// Rate limit: 5 requests per hour per user (uses aiStrictLimiter pattern).
// Caching: 24-hour TTL for same birth data + chart type.
// ============================================================================

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiStrictLimiter } from "@/lib/rate-limit";
import { interpretChart, type AstrologyInterpretRequest, type ChartType } from "@/lib/ai/astrology-ai";
import { z } from "zod";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Request Schema ───────────────────────────────────────────────────────────

const BodySchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  birthPlace: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  timezone: z.string().optional(),
  chartType: z.enum(["vedic", "western", "chinese"]).default("vedic"),
  question: z.string().max(2000).optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ─── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to get an interpretation." },
        { status: 401 },
      );
    }

    // ─── Rate Limit (5 per hour per user) ──────────────────────────────────
    const rl = await checkRateLimit(
      aiStrictLimiter,
      `astro-interpret:${user.id}`,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "You've reached the interpretation limit. Please wait before trying again." },
        { status: 429, headers: rl.headers },
      );
    }

    // ─── Parse Body ────────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 422 },
      );
    }

    const input = parsed.data;

    // ─── Compute Interpretation ────────────────────────────────────────────
    const interpretReq: AstrologyInterpretRequest = {
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      birthPlace: input.birthPlace,
      timezone: input.timezone,
      chartType: input.chartType as ChartType,
      question: input.question,
    };

    const result = await interpretChart(interpretReq);

    // ─── Return Response ───────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        interpretation: result.interpretation,
        chart: result.chart,
        ruleBasedInterpretations: result.ruleBasedInterpretations,
        meta: {
          chartType: input.chartType,
          cached: result.cached,
          llmProvider: result.llmProvider,
          ragContext: result.ragContext,
        },
      },
      { headers: rl.headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interpretation failed";
    console.error("[api/astrology/interpret]", message);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to generate interpretation at this time. Please try again later.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
