// apps/web/app/api/ai/tarot/route.ts
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { withCache } from "@/lib/ai/response-cache";
import { runAI } from "@/lib/ai/router";

export const dynamic = "force-dynamic";

interface CardInput {
  name: string;
  reversed: boolean;
  position: string;
}

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  const identifier = user
    ? `tarot:${user.id}`
    : `tarot:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;
  const rl = await checkRateLimit(aiRateLimiter, identifier);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rl.headers });
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

  const { value, cached } = await withCache(
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
          "You are an expert Tarot reader skilled in Rider-Waite symbolism and psychological archetypes.",
          "Provide grounded, actionable interpretations that feel personal and insightful.",
          "For each card, briefly address its meaning in the given position, noting if it appears reversed (which modifies or blocks the upright energy).",
          "After the card-by-card breakdown, synthesize the combined narrative into a cohesive message.",
          "Close with one concrete, actionable step the seeker can take.",
          "Keep the total reading under 400 words.",
        ].join("\n"),
        userPrompt: `Provide a profound ${spreadLabel} Tarot reading:\n${cardLines}${questionLine}\n\nFirst, briefly interpret each card in its position. Then synthesize the combined energetic narrative.`,
        temperature: 0.7,
        maxTokens: 1000,
      });
      return { reading: result.content, model: result.model };
    },
  );

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
