// apps/web/app/api/ai/kundali/route.ts
// Public-API variant of /api/kundali: deterministic local chart computation via
// @zeal/astrology engine + AI interpretation of ONLY the computed chart.
// Never returns a blank "success" reading — if the AI layer fails the client
// still gets the real chart plus an honest message.
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiStrictLimiter } from "@/lib/rate-limit";
import { getCached, setCached } from "@/lib/ai/response-cache";
import { runAI } from "@/lib/ai/router";
import {
  KundaliInputError,
  validateName,
  validateBirthDate,
  validateBirthTime,
  validatePlace,
  computeKundali,
  formatKundaliForPrompt,
} from "@/lib/kundali/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AI_DOWN_MESSAGE =
  "Your Kundali has been fully computed by the astronomical engine (see chart), but the AI interpretation is temporarily unavailable. Please try again in a moment.";

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Strict rate limit (expensive operation)
  const identifier = user ? `kundali:${user.id}` : `kundali:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;
  const rl = await checkRateLimit(aiStrictLimiter, identifier);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded — 3 kundali/minute", code: "RATE_LIMIT", retryable: true },
      { status: 429, headers: rl.headers }
    );
  }

  // 3. Validate
  let body: { name?: string; dob?: string; tob?: string; pob?: string; lat?: number; lng?: number; lang?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, dob, tob, pob } = body;
  if (!name || !dob || !tob || !pob) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // 4. Deterministic chart computation (pure astronomical engine, no external worker)
    const birthDate = validateBirthDate(dob);
    const birthTime = validateBirthTime(tob);
    const { place, resolved } = await validatePlace(pob);
    const kundali = computeKundali(name, birthDate, birthTime, place, resolved);
    const chartText = formatKundaliForPrompt(kundali);

    // 5. AI interpretation over the computed chart (cached 24h per birth details)
    // Cache stores ONLY successful readings; a degraded cached entry is
    // recomputed, never replayed.
    const cacheKey = { name, dob, tob, pob };
    type Cached = { source: "engine"; chart: unknown; svg: null; analysis: string; aiAvailable: boolean };
    const hit = await getCached<Cached>("kundali", cacheKey);
    let value: Cached;
    let cached = false;
    if (hit && hit.aiAvailable) {
      value = hit;
      cached = true;
    } else {
      let analysis = "";
      let aiAvailable = true;
      try {
        const result = await runAI({
          task: "kundali",
          systemPrompt:
            "You are an expert Vedic astrologer (Jyotishi) with mastery over Janam Kundali, planetary houses, nakshatras, and Vimshottari Dashas. The chart below is ALREADY computed by an astronomical engine — NEVER recompute or change degrees, signs or dasha dates; interpret them as given.",
          userPrompt: `Interpret this computed Janam Kundali for ${name}:\n\n${chartText}\n\nInclude Lagna, planetary strengths, house placements, and current Dasha overview. Be specific, kind, and non-fatalistic.`,
          temperature: 0.7,
          maxTokens: 1500,
        });
        analysis = result.content?.trim() ?? "";
      } catch {
        aiAvailable = false;
      }
      if (!analysis) aiAvailable = false;
      value = {
        source: "engine",
        chart: kundali,
        svg: null,
        analysis: aiAvailable ? analysis : AI_DOWN_MESSAGE,
        aiAvailable,
      };
      if (aiAvailable) await setCached("kundali", cacheKey, value, 24 * 60 * 60);
    }

    return NextResponse.json({
      success: true,
      ...value,
      cached,
    }, { headers: { ...rl.headers, "X-Cache": cached ? "HIT" : "MISS" } });
  } catch (err) {
    if (err instanceof KundaliInputError) {
      return NextResponse.json({ error: err.message, code: "VALIDATION" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Kundali failed";
    console.error("[ai/kundali]", message);
    return NextResponse.json({ success: false, error: message, code: "INTERNAL" }, { status: 500 });
  }
}
