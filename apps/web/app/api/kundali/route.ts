// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Kundali (Janam Patrika) API
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic, error-free Vedic birth chart:
//   1. Strict input validation + POB → coordinates + IANA timezone resolution.
//   2. Astronomical computation via @zeal/astrology (astronomy-engine, Lahiri).
//   3. Self-consistency verification + honest confidence scoring + past-dasha
//      anchors so the user can verify before trusting predictions.
//   4. AI interprets ONLY the computed chart (never recomputes) in Hinglish.
// The chart is returned even if the AI layer is unavailable — it's the core value.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { callAIJson, withAICache, AIUnavailableError } from "@/lib/ai";
import { detectLanguage, languageDirective } from "@/lib/ai/language";
import {
  KundaliInputError,
  validateName,
  validateBirthDate,
  validateBirthTime,
  validatePlace,
  computeKundali,
  formatKundaliForPrompt,
  type KundaliResult,
} from "@/lib/kundali/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INTERPRETER_SYSTEM = `You are Zeal's senior Vedic Jyotishi — 30+ years of Parashari practice.
LANGUAGE: Default to warm Hinglish (Roman-script Hindi mixed with English terms). Always mirror the seeker's language on this turn — see the TURN LANGUAGE system message that follows.
STRICT ACCURACY RULES:
1. The planetary degrees, signs, houses, nakshatras, ayanamsa and dasha dates below are ALREADY computed by an astronomical engine. NEVER recompute, guess, or change them. Interpret them as given.
2. First do a "background analysis": restate what the chart actually shows (Lagna, Moon sign, key house placements) so the user sees you read the real data.
3. VERIFY THE PAST before predicting: use the [past] dasha periods and their lord's house/sign to describe 2-3 concrete past-life themes/events the user can check. Build confidence this way.
4. THEN give self-reasoned future predictions tied to the RUNNING Mahadasha/Antardasha, with a stated confidence level and honest framing (probabilities, not fake certainty).
5. Note the birth-time / Moon-boundary confidence caveats given, and tell the user how to improve accuracy (exact birth minute) if relevant.
Never invent specific dates as certainties. Be specific, grounded, kind, non-fatalistic. Do not give medical/legal/financial directives.
FORMAT (for premium on-page rendering): plain Markdown only — section titles as "**Title**" on their own line, placements as a Markdown table, insights as "- " bullets or numbered lists. NO emoji, NO astrological symbols (☉ ♃ ℞ etc.), NO horizontal rules, NO code fences.`;

// Deterministic chart-derived reading served when every AI lane fails, so the
// user always gets a substantive interpretation instead of an error notice.
const GRAHA_NATURES: Record<string, string> = {
  Sun: "soul, authority, career reputation and the father",
  Moon: "mind, emotions, mother and public response",
  Mars: "courage, property, siblings and driven effort",
  Mercury: "communication, learning, commerce and the nervous system",
  Jupiter: "wisdom, children, wealth-growth and dharma",
  Venus: "partnership, comfort, arts and relationships",
  Saturn: "discipline, labour, delays and long-term maturity",
  Rahu: "desire, foreign influence and sudden upheaval",
  Ketu: "detachment, spirituality and past-life skill",
};

const BHAVA_THEMES = [
  "self, body and first impressions",
  "money earned through effort, family and speech",
  "courage, short travel, siblings and learning",
  "home, mother, vehicles and inner peace",
  "children, creativity, romance and higher intellect",
  "health, daily routine, service and obstacles",
  "partnership, marriage, business and public dealing",
  "shared resources, transformation and research",
  "fortune, higher education, travel and teacher-guidance",
  "career, status, authority and public image",
  "gains, income streams, network and aspirations",
  "expenses, foreign places, rest and confinement",
];

function signTwo(sign: string): string {
  const i = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"].indexOf(sign);
  return i >= 0 ? ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"][i]! : sign;
}

function buildChartFallbackReading(k: KundaliResult): string {
  const rows = k.chart.planets.map(
    (p) =>
      `| ${p.planet} | ${p.sign} (${signTwo(p.sign)}) | ${p.degree.toFixed(1)}${p.isRetrograde ? " (R)" : ""} | ${p.house} | ${p.nakshatra} ${p.nakshatraPada} |`,
  );
  const placements = k.chart.planets
    .filter((p) => GRAHA_NATURES[p.planet])
    .map(
      (p) =>
        `- **${p.planet} in Bhava ${p.house} (${p.sign})** — this graha shades ${GRAHA_NATURES[p.planet]}. With the ${p.house}${ordinal(p.house)} house governing ${BHAVA_THEMES[p.house - 1]}, its results surface mainly through that area of life${p.isRetrograde ? "; the retrograde motion turns the effect inward and reflective" : ""}.`,
    );
  const anchorLines = k.dasha.anchors
    .filter((a) => a.elapsed || a.isCurrent)
    .slice(0, 3)
    .map((a) => `- **${a.planet} ${a.isCurrent ? "running" : "past"} window** (${a.startDate} – ${a.endDate}) — ${a.isCurrent ? "the tone of the present phase" : `a verifiable past phase`}: ${GRAHA_NATURES[a.planet] ?? "this graha"} would have shaped these years — that is the traditional cross-check before reading the future.`);

  return [
    "**Chart Overview — engine-computed**",
    "",
    "| Graha | Rashi | Sign Degree | Bhava | Nakshatra Pada |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `**Lagna and Core**`,
    "",
    `- **Lagna: ${k.chart.ascendantSign} at ${k.chart.ascendantDegree.toFixed(1)}°** — the lens of the whole chart; Navamsa Lagna ${k.chart.navamsaAscendant} confirms the direction of its fruit.`,
    `- **Moon: ${k.chart.moonSign} in ${k.chart.moonNakshatra}** — the emotional weather and mind-pattern of this chart.`,
    `- **Sun: ${k.chart.sunSign}** — the soul-signature and career gravity.`,
    "",
    "**Planetary Placements — Traditional Read**",
    "",
    ...placements,
    "",
    "**Running Dasha**",
    "",
    `- Current Mahadasha **${k.dasha.currentMahadasha}**, Antardasha **${k.dasha.currentAntardasha}**, with ${k.dasha.remainingYears.toFixed(1)} years remaining in the Mahadasha.`,
    ...anchorLines,
    "",
    "_This reading was composed directly from your computed chart using classical Parashari house-significations. The senior Jyotishi AI reading adds personalised cross-checks — please re-run shortly for that layer._",
  ].join("\n");
}

function ordinal(n: number): string {
  if (n === 11 || n === 12 || n === 13) return "th";
  const last = n % 10;
  return last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th";
}

export async function POST(req: Request) {
  try {
    // 1. Rate limit (tiered by auth)
    const supabase = await createServerClientFromCookies();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const identifier = user
      ? `kundali:${user.id}`
      : `kundali:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;
    const rl = await checkRateLimit(aiRateLimiter, identifier);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please pause a moment and try again.", code: "RATE_LIMIT", retryable: true },
        { status: 429, headers: rl.headers }
      );
    }

    // 2. Parse body
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", code: "VALIDATION" }, { status: 400 });
    }

    // 3. Validate + resolve (deterministic, throws KundaliInputError on bad input)
    const name = validateName(body.name);
    const birthDate = validateBirthDate(body.dob);
    const birthTime = validateBirthTime(body.tob);
    const { place, resolved } = await validatePlace(body.pob);

    // 4. Compute the chart (pure, synchronous astronomical engine)
    const kundali: KundaliResult = computeKundali(name, birthDate, birthTime, place, resolved);

    // 5. AI interpretation over the COMPUTED chart (cached; graceful fallback)
    const question = String(body.question ?? "").trim().slice(0, 800);
    const chartText = formatKundaliForPrompt(kundali);

    let interpretation: string;
    let aiAvailable = true;
    const questionLang = detectLanguage(question);
    const userPrompt =
      chartText +
      (question
        ? `\n\nSEEKER'S QUESTION (focus on this): ${question}`
        : `\n\nGive a complete, balanced Janam Kundali reading (past-verify → future-predict).`);
    try {
      interpretation = await withAICache(
        "kundali",
        {
          key: `${name}|${birthDate}|${birthTime}|${resolved.lat},${resolved.lng}|${question}`,
          lagna: kundali.chart.ascendantSign,
          moon: kundali.chart.moonSign,
        },
        30 * 60,
        async () =>
          callAIJson({
            temperature: 0.7,
            maxTokens: 1100,
            // A 1100-token reading routinely needs 20-40s on the free provider
            // lanes; the engine's default 22s global budget cut successful
            // generations and surfaced "temporarily unavailable". Route
            // maxDuration (60s) still caps the request.
            totalWallMs: 50_000,
            messages: [
              { role: "system", content: INTERPRETER_SYSTEM },
              {
                role: "system",
                content: `TURN LANGUAGE: ${languageDirective(questionLang)}`,
              },
              { role: "user", content: userPrompt },
            ],
          })
      ).then((r) => r.value);
    } catch (err) {
      aiAvailable = false;
      if (err instanceof AIUnavailableError) {
        interpretation = buildChartFallbackReading(kundali);
      } else {
        throw err;
      }
    }

    const headers = new Headers(rl.headers);
    headers.set("Cache-Control", "private, no-store");
    return NextResponse.json({ success: true, aiAvailable, kundali, interpretation }, { headers });
  } catch (err) {
    if (err instanceof KundaliInputError) {
      return NextResponse.json({ error: err.message, code: "VALIDATION" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Kundali failed";
    console.error("[kundali]", message);
    return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
  }
}
