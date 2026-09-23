// __ZEAL_PROMPT_TRIM__
// ZEAL_PHASE2_V1
// apps/web/app/api/ai/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Unified AI Endpoint
// ─────────────────────────────────────────────────────────────────────────────
// One route handles every AI task via ?task=<name>.
//   search | horoscope | tarot | numerology | chat | assist | concierge
//
// Concierge (Phase 2) — reads search_consultants MV + AIConsultant table,
// asks Agnes (fallback Groq) to pick ONE category + 2-3 consultants, returns
// structured JSON with hydrated consultant rows so the UI can render cards
// without a second fetch.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter, aiStrictLimiter } from "@/lib/rate-limit";
import { callAIJson, withAICache } from "@/lib/ai";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";

// ═══════════════════════════════════════════════════════════════════
// Vercel maxDuration — extends the default 10s/15s limit.
// See https://vercel.com/docs/functions/configuring-functions/duration
// ═══════════════════════════════════════════════════════════════════
export const maxDuration = 60;


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Error taxonomy ─────────────────────────────────────────────────────────
// Handlers throw ValidationError for caller mistakes (bad input, short
// query, missing fields). The top-level catch maps it to 400. Any other
// Error is treated as infrastructure failure and returned as 500.
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ─── Task type ──────────────────────────────────────────────────────────────
type TaskName =
  | "search"
  | "horoscope"
  | "tarot"
  | "numerology"
  | "chat"
  | "assist"
  | "concierge";

const STRICT_TASKS: TaskName[] = ["search", "concierge"];

interface TaskCtx {
  body: Record<string, unknown>;
  userId: string | null;
  supabase: unknown;
}

// ─── Handlers ───────────────────────────────────────────────────────────────
const HANDLERS: Record<TaskName, (ctx: TaskCtx) => Promise<unknown>> = {
  // ─── SEARCH ─────────────────────────────────────────────────────────────
  search: async ({ body }) => {
    const query = String(body?.query ?? "").trim();
    if (query.length < 3) throw new ValidationError("Query too short");

    const categoryIds = Object.keys(CATEGORY_ID_TO_NAME);
    const catList = categoryIds
      .map((id) => `${id} (${CATEGORY_ID_TO_NAME[id]})`)
      .join("\n");

    const { value, cached } = await withAICache(
      "search",
      { q: query.toLowerCase(), version: 2 },
      6 * 60 * 60,
      async () => {
        const raw = await callAIJson({
          messages: [
            {
              role: "system",
              content: `You are a wellness query classifier. Given a user query, pick ONE category ID from this list:\n${catList}\n\nReturn ONLY JSON: {"categoryId":"<id>","confidence":0.0-1.0,"mood":"<short>"}. No markdown, no explanation.`,
            },
            { role: "user", content: query },
          ],
          temperature: 0.2,
          maxTokens: 150,
          preferProvider: "groqFast",
        });

        let parsed: { categoryId?: string; confidence?: number; mood?: string };
        try {
          parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        } catch {
          parsed = { categoryId: "wellness", confidence: 0.3 };
        }

        const categoryId =
          parsed.categoryId && categoryIds.includes(parsed.categoryId)
            ? parsed.categoryId
            : "wellness";

        const admin = createAdminClient();
        const prismaCategory = categoryId.toUpperCase().replace(/-/g, "_");

        const { data: consultants } = await admin
          .from("Consultant")
          .select(`
            id, category, specialties, "perMinuteRate", rating, "sparkScore",
            "isActive", subdomain,
            user:User!userId(id, name, username, avatar, is_online)
          `)
          .eq("category", prismaCategory)
          .eq("status", "VERIFIED")
          .eq("isActive", true)
          .order("sparkScore", { ascending: false })
          .limit(5);

        return {
          intent: {
            categoryId,
            categoryName: CATEGORY_ID_TO_NAME[categoryId] ?? categoryId,
            confidence: parsed.confidence ?? 0.5,
            mood: parsed.mood ?? null,
          },
          consultants: consultants ?? [],
          totalMatches: consultants?.length ?? 0,
        };
      },
    );

    return { ...value, cached };
  },

  // ─── HOROSCOPE ──────────────────────────────────────────────────────────
  horoscope: async ({ body }) => {
    const sign = String(body?.sign ?? "").trim();
    if (!sign) throw new ValidationError("Sign required");
    const today = new Date().toISOString().slice(0, 10);

    const { value, cached } = await withAICache(
      "horoscope",
      { sign, date: today },
      6 * 60 * 60,
      async () => {
        const reading = await callAIJson({
          messages: [
            {
              role: "system",
              content:
                "You are an expert Vedic astrologer. Provide specific, practical daily horoscopes. Avoid generic fortune-teller clichés.",
              cache_control: { type: "ephemeral" },
            },
            {
              role: "user",
              content: `Daily horoscope for ${sign} on ${today}. Career, relationships, health. Under 180 words.`,
            },
          ],
          temperature: 0.7,
          maxTokens: 400,
        });
        return { reading };
      },
    );
    return { sign, ...value, cached };
  },

  // ─── TAROT ──────────────────────────────────────────────────────────────
  tarot: async ({ body }) => {
    const cards: string[] = Array.isArray(body?.cards)
      ? (body.cards as string[])
      : [];
    if (cards.length !== 3) throw new ValidationError("Exactly 3 cards required");

    const { value, cached } = await withAICache(
      "tarot",
      { cards },
      12 * 60 * 60,
      async () => {
        const reading = await callAIJson({
          messages: [
            {
              role: "system",
              content:
                "You are an expert Tarot reader using Rider-Waite symbolism. Provide grounded, actionable interpretations.",
              cache_control: { type: "ephemeral" },
            },
            {
              role: "user",
              content: `3-card spread (Past, Present, Future):\n1. ${cards[0]}\n2. ${cards[1]}\n3. ${cards[2]}\n\nSynthesize the combined narrative.`,
            },
          ],
          temperature: 0.7,
          maxTokens: 700,
        });
        return { reading };
      },
    );
    return { cards, ...value, cached };
  },

  // ─── NUMEROLOGY ─────────────────────────────────────────────────────────
  numerology: async ({ body }) => {
    const fullName = String(body?.fullName ?? "").trim();
    const dob = String(body?.dob ?? "").trim();
    if (!fullName || !dob) throw new ValidationError("Name and DOB required");

    const { value, cached } = await withAICache(
      "numerology",
      { fullName, dob },
      24 * 60 * 60,
      async () => {
        const analysis = await callAIJson({
          messages: [
            {
              role: "system",
              content:
                "You are a master numerologist. Calculate Life Path, Destiny, Soul Urge accurately. Provide grounded readings.",
              cache_control: { type: "ephemeral" },
            },
            {
              role: "user",
              content: `Full numerology profile for ${fullName}, born ${dob}.`,
            },
          ],
          temperature: 0.6,
          maxTokens: 800,
        });
        return { analysis };
      },
    );
    return { fullName, dob, ...value, cached };
  },

  // ─── CHAT (non-streaming fallback) ──────────────────────────────────────
  chat: async ({ body }) => {
    const prompt = String(body?.prompt ?? "").trim();
    if (!prompt) throw new ValidationError("Prompt required");

    const reply = await callAIJson({
      messages: [
        {
          role: "system",
          content:
            (body?.system as string | undefined) ??
            "You are Zeal, an empathetic wellness concierge.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 800,
    });
    return { reply };
  },

  // ─── ASSIST (consultant reply suggestions) ──────────────────────────────
  assist: async ({ body }) => {
    const query = String(body?.query ?? "").trim();
    if (!query) throw new ValidationError("Query required");

    const raw = await callAIJson({
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant for wellness consultants. Provide 3 short empathetic reply suggestions. Return only the suggestions, one per line, numbered 1-3.",
        },
        { role: "user", content: query },
      ],
      temperature: 0.6,
      maxTokens: 300,
      preferProvider: "groqFast",
    });

    const suggestions = raw
      .split("\n")
      .map((l) => l.replace(/^\d+[.):]\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 3);

    return {
      suggestions:
        suggestions.length > 0
          ? suggestions
          : [
              "Let me think about that.",
              "Tell me more.",
              "Here's my perspective.",
            ],
    };
  },

  // ─── CONCIERGE (Phase 2) ────────────────────────────────────────────────
  concierge: async ({ body }) => {
    const query = String(body?.query ?? "").trim();
    if (query.length < 3) throw new ValidationError("Query too short");

    // 1. Cached directory (search_consultants MV)
    const { value: directory } = await withAICache(
      "directory",
      {},
      300,
      async () => {
        const admin = createAdminClient();
        const { data } = await admin.rpc("search_consultants", {
          p_filters: { limit: 20, sort: "relevance" },
        });
        return (data as { consultants?: unknown[] } | null)?.consultants ?? [];
      },
    );

    // 2. Cached AI consultants
    const { value: aiConsultants } = await withAICache(
      "ai-consultants",
      {},
      300,
      async () => {
        const admin = createAdminClient();
        const { data } = await admin
          .from("AIConsultant")
          .select(
            'id, name, category, "perMinuteRate", specialties, isPaid, rating, bio',
          )
          .eq("isActive", true);
        return data ?? [];
      },
    );

    // 3. Compact payloads
    const directoryBrief = (
      directory as Array<{
        id: string;
        name: string | null;
        username: string | null;
        category: string | null;
        perMinuteRate: number | null;
        rating: number | null;
        sparkScore: number | null;
        specialties: string[] | null;
        is_online: boolean;
      }>
    )
      .slice(0, 20)
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        rate: c.perMinuteRate,
        rating: c.rating,
        sparks: c.sparkScore,
        specialties: c.specialties,
        online: c.is_online,
      }));

    const aiBrief = (
      aiConsultants as Array<{
        id: string;
        name: string;
        category: string;
        perMinuteRate: number;
        specialties: string[] | null;
        isPaid: boolean;
        rating: number;
      }>
    ).map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      rate: a.perMinuteRate,
      specialties: a.specialties,
      paid: a.isPaid,
      rating: a.rating,
    }));

    const categoryList = Object.entries(CATEGORY_ID_TO_NAME)
      .map(([id, name]) => `${id}: ${name}`)
      .join("\n");

    // 4. System prompt — structured JSON contract
    const systemPrompt = [
      "You are Zeal, a warm, empathetic concierge for a multi-faith wellness platform.",
      "Your job: understand what the user needs and connect them with the right guide.",
      "",
      "AVAILABLE CATEGORIES:",
      categoryList,
      "",
      "AVAILABLE HUMAN CONSULTANTS (top 60):",
      JSON.stringify(directoryBrief),
      "",
      "AVAILABLE AI CONSULTANTS:",
      JSON.stringify(aiBrief),
      "",
      "Return ONLY valid JSON with this exact shape:",
      '{ "response": "warm, concise message (max 60 words)", "categoryId": "<one of the category IDs above>", "consultantIds": ["id1", "id2"], "reason": "short reason" }',
      "",
      "RULES:",
      "1. Never invent IDs — only use IDs from the lists above.",
      "2. Prefer online consultants over offline.",
      "3. Prefer higher-rated and higher-spark consultants.",
      "4. If the request is vague, ask ONE clarifying question and leave consultantIds empty.",
      "5. If AI is a better fit (instant, free), include an AI consultant ID.",
      "6. Raw JSON only — no markdown fences, no commentary.",
    ].join("\n");

    // 5. Call Agnes (fallback Groq) via unified engine
    const raw = await callAIJson({
      messages: [
        {
          role: "system",
          content: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
        { role: "user", content: query },
      ],
      temperature: 0.7,
      maxTokens: 600,
      preferProvider: "agnes",
    });

    // 6. Parse (defensive)
    let parsed: {
      response: string;
      categoryId: string;
      consultantIds: string[];
      reason?: string;
    };
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      parsed = {
        response:
          "Let me find the right guide for you. Could you tell me a bit more about what you're looking for?",
        categoryId: "wellness",
        consultantIds: [],
      };
    }

    // 7. Hydrate consultant rows
    const validIds = new Set<string>(
      Array.isArray(parsed.consultantIds) ? parsed.consultantIds : [],
    );

    const recommendedHumans = (directory as Array<{ id: string }>)
      .filter((c) => validIds.has(c.id))
      .slice(0, 3);

    const recommendedAI = (aiConsultants as Array<{ id: string }>)
      .filter((a) => validIds.has(a.id))
      .slice(0, 3);

    return {
      response: parsed.response,
      categoryId: parsed.categoryId,
      categoryName: CATEGORY_ID_TO_NAME[parsed.categoryId] ?? parsed.categoryId,
      reason: parsed.reason ?? null,
      consultants: recommendedHumans,
      aiConsultants: recommendedAI,
    };
  },
};

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let taskForLog: string = "unknown";
  try {
    const url = new URL(req.url);
    const task = (url.searchParams.get("task") ?? "chat") as TaskName;
    taskForLog = task;

    if (!HANDLERS[task]) {
      return NextResponse.json(
        { error: `Unknown task: ${task}` },
        { status: 400 },
      );
    }

    // 1. Auth
    const supabase = await createServerClientFromCookies();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 2. Rate limit (tiered)
    const limiter = STRICT_TASKS.includes(task) ? aiStrictLimiter : aiRateLimiter;
    const identifier = user
      ? `ai:${task}:${user.id}`
      : `ai:${task}:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;
    const rl = await checkRateLimit(limiter, identifier);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait." },
        { status: 429, headers: rl.headers },
      );
    }

    // 3. Parse body
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    // 4. Execute handler
    const result = await HANDLERS[task]({
      body,
      userId: user?.id ?? null,
      supabase,
    });

    return NextResponse.json(
      { success: true, task, ...(result as Record<string, unknown>) },
      { headers: rl.headers },
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, code: "VALIDATION" },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "AI request failed";
    console.error(`[ai/${taskForLog}]`, message);
    return NextResponse.json(
      { error: message, code: "INTERNAL" },
      { status: 500 },
    );
  }
}
