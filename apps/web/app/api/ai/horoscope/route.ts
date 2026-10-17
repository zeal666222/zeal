// apps/web/app/api/ai/horoscope/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Daily Horoscope (deterministic-first)
// Reading = real computed Vedic gochara (astronomy-engine, Lahiri) + free
// open-source daily feed + AI synthesis on top. If the AI lane is down, the
// endpoint still returns a complete, data-backed markdown reading — never an
// error page.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { withAICache, callAIJson } from "@/lib/ai";
import { detectLanguage, languageDirective } from "@/lib/ai/language";
import {
  computeDaySky,
  computeLucky,
  formatTransitsForPrompt,
  buildFallbackReading,
  isSunSignName,
} from "@/lib/horoscope/engine";
import { gatherExternalHoroscopes } from "@/lib/horoscope/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const AI_SYSTEM = [
  "ZEAL CONSULTANT DIRECTIVE (applies to everything you output):",
  "LANGUAGE: Default to warm Hinglish (Roman-script Hindi+English mix); mirror the TURN LANGUAGE message.",
  "BACKGROUND ANALYSIS: First state briefly which real transits you are reading (planet, sign, house) before interpreting them.",
  "VERIFY PAST EVENTS FIRST: Reference one verifiable recent pattern the seeker can confirm, then reason forward.",
  "CONFIDENCE: Give an honest confidence note; never fabricate exact dates as certainty.",
  "",
  "You are an expert Vedic astrologer (Jyotishi) writing a DAILY horoscope.",
  "You are given REAL computed sidereal transit data (astronomy-engine, Lahiri ayanamsa) and possibly an open-source daily horoscope line. Base every claim on that data — never invent planetary positions.",
  "If an external daily line is provided, weave its theme in; do not copy it verbatim.",
  "",
  "FORMAT (strict):",
  "- Markdown with bold headings on their own line, exactly: **Today's Sky**, **Career & Money**, **Love & Relationships**, **Health & Energy**, **Lucky Window**.",
  "- Under 220 words total.",
  "- Plain text only — no emoji, no astrological glyph characters, no tables, no code fences.",
].join("\n");

export async function POST(req: Request) {
  // ─── 1. Auth ────────────────────────────────────────────────────────────
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  // ─── 2. Rate limit ──────────────────────────────────────────────────────
  const identifier = user ? `ai:${user.id}` : `ai:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;
  const rl = await checkRateLimit(aiRateLimiter, identifier);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: rl.headers },
    );
  }

  // ─── 3. Validate ────────────────────────────────────────────────────────
  let body: { sign?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sign = String(body.sign ?? "").trim();
  if (!sign || !isSunSignName(sign)) {
    return NextResponse.json({ error: "Invalid zodiac sign" }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.slice(0, 500) : "";

  // ─── 4. Deterministic sky (always computed, never cached-stale) ─────────
  const now = new Date();
  const sky = computeDaySky(now);
  const transits = sky.bySign[sign];
  const sunDeg = transits.find((t) => t.code === "Su")?.degreesInSign ?? 0;
  const lucky = computeLucky(sign, sky.date, sunDeg);

  // ─── 5. Open-source external lines (failure-soft, 8s cap) ───────────────
  const externals = await gatherExternalHoroscopes(sign);
  const externalText = externals.map((e) => e.text).join("\n---\n");

  // ─── 6. AI synthesis (cached per sign+day; fallback is never cached) ────
  let aiText: string | null = null;
  let cached = false;
  try {
    const { value, cached: hit } = await withAICache(
      "horoscope-ai",
      { sign, date: sky.date, ext: externalText.slice(0, 200) },
      6 * 60 * 60,
      async () => {
        const lang = detectLanguage(question);
        const content = await callAIJson({
          messages: [
            { role: "system", content: AI_SYSTEM, cache_control: { type: "ephemeral" } },
            { role: "system", content: `TURN LANGUAGE: ${languageDirective(lang)}` },
            {
              role: "user",
              content: [
                `Daily horoscope for ${sign} — ${sky.date}.`,
                question ? `The seeker also asks: "${question}"` : "",
                "",
                formatTransitsForPrompt(sign, sky),
                "",
                externalText
                  ? `Open-source daily horoscope line for today:\n${externalText}`
                  : "(No external feed available right now — rely on the transits.)",
              ].filter(Boolean).join("\n"),
            },
          ],
          temperature: 0.7,
          maxTokens: 500,
          totalWallMs: 40_000,
        });
        return { text: content };
      },
    );
    aiText = value.text;
    cached = hit;
  } catch {
    aiText = null;
  }

  const reading = aiText?.trim() || buildFallbackReading(sign, sky, lucky);

  return NextResponse.json(
    {
      success: true,
      sign,
      date: sky.date,
      reading,
      aiAvailable: aiText !== null,
      transits,
      moon: sky.moon,
      lucky,
      ayanamsa: sky.ayanamsa,
      sources: [
        "Vedic ephemeris (astronomy-engine, Lahiri)",
        ...externals.map((e) => e.source),
        aiText !== null ? "Zeal AI Jyotishi" : null,
      ].filter((s): s is string => s !== null),
    },
    {
      headers: {
        ...rl.headers,
        "X-Cache": cached ? "HIT" : "MISS",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
