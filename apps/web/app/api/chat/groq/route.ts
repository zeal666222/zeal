// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/groq — authenticated Groq chat proxy
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";

// Vercel maxDuration
export const maxDuration = 30;


export const runtime = "edge";
export const dynamic = "force-dynamic";

interface ChatBody {
  message?: string;
  category?: string;
  userContext?: {
    name?: string;
    dob?: string;
    time?: string;
    location?: string;
    concern?: string;
  };
}

export async function POST(req: Request) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  // ─── Rate limit ──────────────────────────────────────────────────────────
  const rl = await checkRateLimit(aiRateLimiter, `groq-proxy:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment." },
      { status: 429, headers: rl.headers },
    );
  }

  // ─── Body ────────────────────────────────────────────────────────────────
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: "Chat is temporarily unavailable." }, { status: 503 });
  }

  const category = body.category ?? "wellness";
  const ctx = body.userContext ?? {};

  const systemPrompt = [
    `You are an elite, highly revered Master of ${category} on the Zeal platform.`,
    "You are NOT an AI assistant. You are a profoundly wise, empathetic consultant.",
    "",
    "CLIENT CONTEXT:",
    `Name: ${ctx.name ?? "Seeker"}`,
    `DOB: ${ctx.dob ?? "Unknown"}`,
    `Time: ${ctx.time ?? "Unknown"}`,
    `Location: ${ctx.location ?? "Unknown"}`,
    `Concern: ${ctx.concern ?? "General Guidance"}`,
    "",
    "DIRECTIVES:",
    "1. Empathetic, mystical, professional tone.",
    "2. Use correct Sanskrit/Vedic terms when relevant.",
    "3. Weave birth details naturally into the first response.",
    "4. Refuse death predictions, medical diagnoses, financial advice.",
    "5. Use Indian Rupees (₹) for any cost.",
    "6. Keep responses concise for a chat interface.",
  ].join("\n");

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.6,
        max_tokens: 600,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[groq-proxy] provider error:", data);
      return NextResponse.json(
        { error: "Chat is taking a brief pause. Please try again shortly." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reply: data.choices?.[0]?.message?.content ?? "",
    }, { headers: rl.headers });
  } catch (err) {
    console.error("[groq-proxy] fatal:", err);
    return NextResponse.json(
      { error: "Chat is taking a brief pause. Please try again shortly." },
      { status: 500 },
    );
  }
}
