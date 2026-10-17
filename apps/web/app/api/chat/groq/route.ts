// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/groq — authenticated chat proxy (unified AI engine)
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { detectLanguage, languageDirective } from "@/lib/ai/language";
import { callAIJson, AIUnavailableError, type AIMessage } from "@/lib/ai/engine";

// Vercel maxDuration
export const maxDuration = 30;


export const runtime = "nodejs";
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

  const category = body.category ?? "wellness";
  const ctx = body.userContext ?? {};

  // Shared Zeal Consultant directive (mirrors app/api/ai/route.ts)
  const ZEAL_CONSULTANT_DIRECTIVE = [
    "ZEAL CONSULTANT DIRECTIVE:",
    'LANGUAGE — Default to warm Hinglish (Roman-script Hindi+English mix). Always mirror the seeker\'s language on this turn — see the TURN LANGUAGE system message that follows.',
    "BACKGROUND ANALYSIS — Before answering, analyse everything the user provided (birth details, question, symbols, uploaded file) and state briefly what you observed.",
    "VERIFY PAST EVENTS FIRST — Reference verifiable past patterns/events implied by the input (e.g. past Saturn transit effects), then give self-reasoned future predictions. Be specific, not generic.",
    "CONFIDENCE — Give a confidence level and explain reasoning. Never fabricate exact dates as certainty; frame probabilities honestly.",
  ].join("\n");

  // Detect uploaded-file markdown links appended by ChatInterface
  const attachmentRe = /(!?)\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  const files = [...message.matchAll(attachmentRe)].map((m) => {
    const url = m[3] ?? "";
    const ext = (url.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
    const kind = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)
      ? "IMAGE"
      : ext === "pdf"
        ? "PDF"
        : "DOCUMENT";
    return `${kind} — "${(m[2] || "").trim() || "uploaded file"}" (URL: ${url})`;
  });

  const fileProtocol =
    files.length > 0
      ? [
          "",
          "[UPLOADED FILES DETECTED IN THIS MESSAGE]",
          ...files,
          'FILE-ANALYSIS PROTOCOL: (1) Acknowledge the file warmly and specifically ("Aapne jo palm photo bheji hai..."). (2) Extract and describe relevant details from the file type/name/question; if a visual detail cannot be confidently resolved, say so honestly and never invent it. (3) Proactively ask 1-2 clarifying questions about the file (e.g. "Aapne palm photo bheji hai — kya aap right hand ki baat kar rahe hain?"). (4) Weave the file into your background analysis before predicting.',
        ].join("\n")
      : "";

  const systemPrompt = [
    ZEAL_CONSULTANT_DIRECTIVE,
    "",
    `You are an elite, highly revered Master of ${category} on the Zeal platform.`,
    "You are NOT an AI assistant. You are a profoundly wise, empathetic consultant.",
    "",
    "CLIENT CONTEXT:",
    `Name: ${ctx.name ?? "Seeker"}`,
    `DOB: ${ctx.dob ?? "Unknown"}`,
    `Time: ${ctx.time ?? "Unknown"}`,
    `Location: ${ctx.location ?? "Unknown"}`,
    `Concern: ${ctx.concern ?? "General Guidance"}`,
    fileProtocol,
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
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `TURN LANGUAGE: ${languageDirective(detectLanguage(message))}`,
      },
      { role: "user", content: message },
    ];

    const reply = await callAIJson({ messages, temperature: 0.6, maxTokens: 600 });
    return NextResponse.json({ reply }, { headers: rl.headers });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json(
        { error: "Chat is taking a brief pause. Please try again shortly." },
        { status: 503 },
      );
    }
    console.error("[chat-proxy] fatal:", err);
    return NextResponse.json(
      { error: "Chat is taking a brief pause. Please try again shortly." },
      { status: 500 },
    );
  }
}
