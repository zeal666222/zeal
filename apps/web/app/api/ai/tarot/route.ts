// apps/web/app/api/ai/tarot/route.ts
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter, aiAnonLimiter } from "@/lib/rate-limit";
import { withCache } from "@/lib/ai/response-cache";
import { runAI } from "@/lib/ai/router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CardInput {
  name: string;
  reversed: boolean;
  position: string;
}

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user);
  const identifier = user
    ? `tarot:${user.id}`
    : `tarot:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;

  const limiter = isAuthenticated ? aiRateLimiter : aiAnonLimiter;
  const rl = await checkRateLimit(limiter, identifier);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before your next reading." },
      { status: 429, headers: rl.headers },
    );
  }

  let body: { cards?: (string | CardInput)[]; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawCards = body.cards;
  if (!rawCards || !Array.isArray(rawCards) || rawCards.length === 0) {
    return NextResponse.json({ error: "At least 1 card required" }, { status: 400 });
  }

  const normalized: CardInput[] = rawCards.map((c, i) => {
    if (typeof c === "string") {
      return { name: c, reversed: false, position: `Position ${i + 1}` };
    }
    return {
      name: String(c.name ?? `Card ${i + 1}`),
      reversed: Boolean(c.reversed),
      position: String(c.position ?? `Position ${i + 1}`),
    };
  });

  const cacheKey = {
    cards: normalized.map((c) => `${c.name}:${c.reversed ? "rx" : "up"}:${c.position}`),
    question: body.question ?? null,
  };

  let value: { reading: string; model: string };
  let cached = false;
  try {
    const result = await withCache(
      { namespace: "tarot", ttl: 12 * 60 * 60 },
      cacheKey,
      async () => {
        const cardLines = normalized
          .map((c, i) => {
            const rx = c.reversed ? " (REVERSED)" : "";
            return `${i + 1}. ${c.name}${rx} — Position: ${c.position}`;
          })
          .join("\n");

        const questionLine = body.question
          ? `\n\nThe seeker's question: "${body.question}"`
          : "";

        const spreadLabel = normalized.length === 1
          ? "single-card"
          : normalized.length === 3
          ? "three-card"
          : normalized.length === 5
          ? "five-card"
          : `${normalized.length}-card`;

        const result = await runAI({
          task: "tarot",
          systemPrompt: [
            "You are a master Tarot reader with deep knowledge of Rider-Waite symbolism, Jungian archetypes, and elemental correspondences.",
            "You provide rich, layered interpretations that feel personal, mystical, and actionable.",
            "",
            "## Response Format",
            "Respond in valid JSON with this exact structure:",
            "{",
            '  "cardDetails": [',
            "    {",
            '      "position": "the position name",',
            '      "cardName": "card name",',
            '      "orientation": "upright or reversed",',
            '      "coreMeaning": "2-3 sentence deep interpretation of this card in this position",',
            '      "symbolism": "key symbols, imagery, and archetypal significance (1-2 sentences)",',
            '      "elementalInfluence": "how the card\'s element (fire/water/air/earth) shapes the reading (1 sentence)",',
            '      "practicalGuidance": "one concrete, actionable insight from this card (1 sentence)"',
            "    }",
            "  ],",
            '  "synthesis": "A flowing 3-4 paragraph narrative weaving all cards together into a cohesive message. Address the seeker directly. Reference how the cards interact with each other and the position they occupy.",',
            '  "actionStep": "One specific, concrete action the seeker can take in the next 24-48 hours based on this reading.",',
            '  "overallEnergy": "A single phrase capturing the reading\'s dominant energy (e.g., \'Transformation through surrender\')"',
            "}",
            "",
            "## Guidelines",
            "- For REVERSED cards: explain how the energy is blocked, internalized, or shadow-expressed — not just 'bad version of upright'.",
            "- For each card's symbolism: reference specific Rider-Waite imagery (colors, numbers, figures, objects).",
            "- For elemental influence: connect the element to the card's message (fire=action/passion, water=emotion/intuition, air=thought/communication, earth=material/stability).",
            "- The synthesis should NOT repeat card-by-card meanings — it should reveal the STORY the cards tell together.",
            "- Keep the total response under 800 words.",
            "- Write with warmth and authority. The seeker trusts you.",
            "- Plain text only inside JSON string values — never emoji, astrological or tarot glyph characters, markdown fences, or decorative symbols.",
          ].join("\n"),
          userPrompt: `Provide a profound ${spreadLabel} Tarot reading:\n${cardLines}${questionLine}\n\nFor each card, give a detailed interpretation covering its meaning in position, symbolism, elemental influence, and practical guidance. Then synthesize all cards into a unified narrative.\n\nRespond ONLY with valid JSON matching the specified structure.`,
          temperature: 0.75,
          maxTokens: 2000,
          totalWallMs: 50_000,
        });
        return { reading: result.content, model: result.model };
      },
    );
    value = result.value;
    cached = result.cached;
  } catch {
    value = {
      reading: JSON.stringify({
        cardDetails: normalized.map((c) => ({
          position: c.position,
          cardName: c.name,
          orientation: c.reversed ? "reversed" : "upright",
          coreMeaning: "The AI reader is temporarily unavailable. Please try again in a moment for a detailed interpretation.",
          symbolism: "",
          elementalInfluence: "",
          practicalGuidance: "",
        })),
        synthesis: "The cards have been drawn and their traditional meanings are available below. The AI deep-dive is momentarily paused — please try again shortly for a personalized synthesis.",
        actionStep: "Take a moment to reflect on each card's traditional meaning.",
        overallEnergy: "Patience and reflection",
      }),
      model: "fallback",
    };
  }

  return NextResponse.json(
    {
      success: true,
      cards: normalized,
      reading: value.reading,
      cached,
    },
    { headers: { ...rl.headers, "X-Cache": cached ? "HIT" : "MISS" } },
  );
}
