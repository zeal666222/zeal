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
// asks the engine (Cloudflare Workers AI first) to pick ONE category + 2-3
// consultants, returns structured JSON with hydrated consultant rows so the UI
// can render cards without a second fetch.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter, aiStrictLimiter } from "@/lib/rate-limit";
import { callAIJson, withAICache, AIUnavailableError } from "@/lib/ai";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";
import { detectLanguage, languageDirective } from "@/lib/ai/language";

// ═══════════════════════════════════════════════════════════════════
// Vercel maxDuration — extends the default 10s/15s limit.
// See https://vercel.com/docs/functions/configuring-functions/duration
// ═══════════════════════════════════════════════════════════════════
export const maxDuration = 60;


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Shared Zeal Consultant Directive ───────────────────────────────────────
// Prepended to every free-text handler's system prompt. JSON-contract handlers
// (search, concierge) get a scoped note so the strict output shape survives.
const ZEAL_CONSULTANT_DIRECTIVE = [
  "ZEAL CONSULTANT DIRECTIVE (applies to everything you output):",
  "",
  "LANGUAGE:",
  'Default to warm Hinglish (Roman-script Hindi+English mix). Always mirror the seeker\'s language on this turn — see the TURN LANGUAGE system message that follows.',
  "",
  "BACKGROUND ANALYSIS:",
  "Before answering, do a detailed analysis of everything the user provided (birth details, question, symbols, uploaded file). State briefly what you observed before interpreting.",
  "",
  "VERIFY PAST EVENTS FIRST:",
  "To build confidence, first reference verifiable past patterns/events implied by the input (e.g. past Saturn transit effects the user can confirm), then give self-reasoned predictions about the future. Be specific and grounded, not generic.",
  "",
  "CONFIDENCE:",
  "Give a confidence level and explain your reasoning. Never fabricate exact dates as certainty; frame probabilities honestly.",
].join("\n");

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
const CACHEABLE_TASKS = new Set<TaskName>(["horoscope", "tarot", "numerology"]);

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
    if (query.length > 500) throw new ValidationError("Input too long");

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
              content: `${ZEAL_CONSULTANT_DIRECTIVE}\n\nIMPORTANT: the strict JSON-only contract below overrides this directive's language and free-text rules — return raw JSON only. The "mood" field may follow the Hinglish default.\n\nYou are a wellness query classifier. Given a user query, pick ONE category ID from this list:\n${catList}\n\nReturn ONLY JSON: {"categoryId":"<id>","confidence":0.0-1.0,"mood":"<short>"}. No markdown, no explanation.`,
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
                `${ZEAL_CONSULTANT_DIRECTIVE}\n\nYou are an expert Vedic astrologer. Provide specific, practical daily horoscopes. Avoid generic fortune-teller clichés. Briefly note the chart/transit pattern you are reading (background analysis), reference a verifiable past transit pattern, then give the forward-looking guidance with an honest confidence note.`,
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
                `${ZEAL_CONSULTANT_DIRECTIVE}\n\nYou are an expert Tarot reader using Rider-Waite symbolism. Provide grounded, actionable interpretations. Name what each card shows (background analysis), relate the Past card to something the seeker can verify, then reason forward.`,
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
                `${ZEAL_CONSULTANT_DIRECTIVE}\n\nYou are a master numerologist. Calculate Life Path, Destiny, Soul Urge accurately. Provide grounded readings. Show the numbers you derived (background analysis), point to a past cycle the seeker can confirm, then project ahead with a confidence note.`,
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
    if (prompt.length > 4000) throw new ValidationError("Input too long");

    const reply = await callAIJson({
      messages: [
        {
          role: "system",
          content: `${ZEAL_CONSULTANT_DIRECTIVE}\n\n${
            (body?.system as string | undefined) ??
            "You are Zeal, an empathetic wellness concierge."
          }`,
        },
        {
          role: "system",
          content: `TURN LANGUAGE: ${languageDirective(detectLanguage(prompt))}`,
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
            `${ZEAL_CONSULTANT_DIRECTIVE}\n\nIMPORTANT: keep the strict output format below — exactly 3 numbered lines, no paragraphs. You are an AI assistant for wellness consultants. Provide 3 short empathetic reply suggestions the consultant can send back to the seeker. Suggestions follow the seeker's language on this turn. Return only the suggestions, one per line, numbered 1-3.`,
        },
        {
          role: "system",
          content: `TURN LANGUAGE: ${languageDirective(detectLanguage(query))}`,
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
    if (query.length > 500) throw new ValidationError("Input too long");

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

    // 3. Free services catalog
    const freeServices = [
      { slug: "horoscope", name: "Daily Horoscope", icon: "✨", description: "Personalized daily guidance based on your zodiac" },
      { slug: "kundali", name: "Kundali Analysis", icon: "🪷", description: "Complete Vedic birth chart with predictions" },
      { slug: "tarot", name: "Tarot Reading", icon: "🎴", description: "Interactive card spread for immediate clarity" },
      { slug: "numerology", name: "Numerology", icon: "🔢", description: "Life path numbers and destiny analysis" },
      { slug: "palmistry", name: "Palmistry", icon: "🤚", description: "Upload your palm for detailed reading" },
      { slug: "dream", name: "Dream Analysis", icon: "🌙", description: "Interpret your dreams with symbolic meaning" },
      { slug: "panchang", name: "Daily Panchang", icon: "📅", description: "Auspicious timings and lunar calendar" },
      { slug: "milan", name: "Guna Milan", icon: "💑", description: "Compatibility matching for relationships" },
    ];

    // 4. Compact payloads
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

    const servicesBrief = freeServices.map((s) => ({
      slug: s.slug,
      name: s.name,
      icon: s.icon,
      description: s.description,
    }));

    const categoryList = Object.entries(CATEGORY_ID_TO_NAME)
      .map(([id, name]) => `${id}: ${name}`)
      .join("\n");

    // 5. System prompt — structured JSON contract
    const systemPrompt = [
      ZEAL_CONSULTANT_DIRECTIVE,
      "",
      "IMPORTANT: the strict JSON-only contract below overrides this directive's free-text rules — return raw JSON only. Inside the \"response\" string field, follow the LANGUAGE rule (Hinglish default) and keep the warm, grounded tone.",
      "",
      "ROLE: You are Siddhi, a warm and knowledgeable wellness assistant for Zeal.",
      "Your job is to UNDERSTAND what the user needs and SUGGEST the best match — either a free service, an AI consultant, or a human expert.",
      "",
      "CRITICAL RULES:",
      "1. NEVER ask for birth details (date, time, place) unless the user voluntarily provides them.",
      "2. Focus on understanding their concern first — career, love, health, spirituality, etc.",
      "3. Recommend FREE SERVICES first if they match the need (instant, no signup required).",
      "4. Recommend AI CONSULTANTS for personalized guidance (free, available 24/7).",
      "5. Recommend HUMAN CONSULTANTS for deep, specialized sessions (paid, by appointment).",
      "6. Be conversational and helpful — act like a trusted friend who knows the platform.",
      "",
      "AVAILABLE FREE SERVICES (instant access):",
      JSON.stringify(servicesBrief),
      "",
      "AVAILABLE CATEGORIES:",
      categoryList,
      "",
      "AVAILABLE HUMAN CONSULTANTS (top 20):",
      JSON.stringify(directoryBrief),
      "",
      "AVAILABLE AI CONSULTANTS:",
      JSON.stringify(aiBrief),
      "",
      "Return ONLY valid JSON with this exact shape:",
      '{ "response": "warm, helpful message (max 80 words)", "serviceSlugs": ["slug1"], "consultantIds": ["id1", "id2"], "reason": "why these match the need" }',
      "",
      "RULES:",
      "1. Never invent IDs or slugs — only use from the lists above.",
      "2. Prefer free services for quick answers (horoscope, tarot, numerology).",
      "3. Prefer online human consultants over offline.",
      "4. Prefer higher-rated consultants.",
      "5. If the request is vague, suggest 1-2 free services AND 1 consultant.",
      "6. Raw JSON only — no markdown fences, no commentary.",
    ].join("\n");

    // 6. Call the engine (Cloudflare Workers AI first, then the rest of the chain)
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
      preferProvider: "cloudflareAi",
    });

    // 7. Parse (defensive)
    let parsed: {
      response: string;
      serviceSlugs?: string[];
      consultantIds: string[];
      reason?: string;
    };
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      parsed = {
        response:
          "Let me help you find the right guidance. Could you tell me a bit more about what you're looking for?",
        serviceSlugs: [],
        consultantIds: [],
      };
    }

    // 8. Hydrate consultant rows
    const validIds = new Set<string>(
      Array.isArray(parsed.consultantIds) ? parsed.consultantIds : [],
    );

    const recommendedHumans = (directory as Array<{ id: string }>)
      .filter((c) => validIds.has(c.id))
      .slice(0, 3);

    const recommendedAI = (aiConsultants as Array<{ id: string }>)
      .filter((a) => validIds.has(a.id))
      .slice(0, 3);

    // 9. Hydrate service rows
    const validSlugs = new Set<string>(
      Array.isArray(parsed.serviceSlugs) ? parsed.serviceSlugs : [],
    );

    const recommendedServices = freeServices
      .filter((s) => validSlugs.has(s.slug))
      .slice(0, 3);

    return {
      response: parsed.response,
      reason: parsed.reason ?? null,
      services: recommendedServices,
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
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", code: "VALIDATION" },
        { status: 400 },
      );
    }

    // 4. Execute handler
    const result = await HANDLERS[task]({
      body,
      userId: user?.id ?? null,
      supabase,
    });

    const responseHeaders: Record<string, string> = { ...rl.headers };
    if (CACHEABLE_TASKS.has(task)) {
      responseHeaders["Cache-Control"] = "public, max-age=300";
    } else {
      responseHeaders["Cache-Control"] = "no-store";
    }

    return NextResponse.json(
      { success: true, task, ...(result as Record<string, unknown>) },
      { headers: responseHeaders },
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, code: "VALIDATION" },
        { status: 400 },
      );
    }
    if (err instanceof AIUnavailableError) {
      return NextResponse.json(
        {
          error: "AI services are temporarily unavailable. Please try again.",
          code: "AI_UNAVAILABLE",
          retryable: true,
        },
        { status: 503 },
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
