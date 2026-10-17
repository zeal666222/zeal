import { NextResponse } from "next/server";
import {getUserId} from "@/lib/auth";
import {withErrorHandler} from "@/lib/errors";
import {getAIResponse} from "@/lib/ai/ai-chat";
import {checkRateLimit, aiRateLimiter, aiAnonLimiter} from "@/lib/rate-limit";
import {z} from "zod";

const AssistSchema = z.object({
  query: z.string().min(1).max(500),
  astrologerId: z.string().optional(),
});

const FALLBACK = [
  "Thank you for reaching out. Let me look into this for you.",
  "That is a thoughtful question. Here is what I sense.",
  "I understand your concern. Let me offer some guidance.",
];

export const POST = withErrorHandler(async (req: Request) => {
  // ─── 1. Auth & Rate limit ─────────────────────────────────────────────────
  const userId = await getUserId();
  const isAuthenticated = Boolean(userId);
  const identifier = userId
    ? `assist:${userId}`
    : `assist:ip:${req.headers.get("x-forwarded-for") ?? "anon"}`;

  const limiter = isAuthenticated ? aiRateLimiter : aiAnonLimiter;
  const rl = await checkRateLimit(limiter, identifier);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: rl.headers },
    );
  }

  const body = await req.json();
  const { query } = AssistSchema.parse(body);

  const prompt = "A wellness consultant received this client query: \"" + query + "\". Provide 3 short, empathetic reply suggestions. Return ONLY the suggestions, one per line, prefixed with a number.";

  const systemPrompt = "You are an AI assistant helping wellness consultants respond to their clients. Provide warm, professional, and helpful reply suggestions.";

  try {
    const result = await getAIResponse(prompt, "", systemPrompt);
    const suggestions = result.content
      .split("\n")
      .map((l) => l.replace(/^\d+[.):]\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 3);

    if (suggestions.length === 0) {
      return NextResponse.json({ suggestions: FALLBACK }, { headers: rl.headers });
    }
    return NextResponse.json({ suggestions }, { headers: rl.headers });
  } catch (err) {
    console.warn("[AI Assist] Falling back to defaults:", err);
    return NextResponse.json({ suggestions: FALLBACK }, { headers: rl.headers });
  }
});

