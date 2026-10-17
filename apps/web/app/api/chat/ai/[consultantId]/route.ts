// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/ai/[consultantId] — Streaming AI chat with fillers
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";
import { handleAIChat, AIChatError } from "@zeal/database/ai-chat-handler";
import { loadPersona } from "@/lib/ai/persona-loader";
import { callAI, type AIMessage as EngineAIMessage, type AIContentPart } from "@/lib/ai/engine";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { detectBirthData } from "@/lib/astrology/birth-data-detector";
import { interpretChart, type AstrologyAIResult } from "@/lib/ai/astrology-ai";
import { withAdvisoryLock } from "@/lib/billing/concurrency";
import { tryAcquireAIChat, releaseAIChat } from "@/lib/ai/chat-concurrency";
import { z } from "zod";

// Vercel maxDuration
export const maxDuration = 60;


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

// ─── Uploaded-file detection ────────────────────────────────────────────────
// ChatInterface uploads files via /api/upload and appends markdown links to
// the message content: ![name](url) for images, [name](url) for docs/PDFs.
const ATTACHMENT_RE = /(!?)\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

interface DetectedFile {
  name: string;
  url: string;
  kind: "image" | "pdf" | "document";
}

function detectUploadedFiles(content: string): DetectedFile[] {
  const files: DetectedFile[] = [];
  for (const match of content.matchAll(ATTACHMENT_RE)) {
    const url = match[3] ?? "";
    const name = (match[2] || "").trim() || "uploaded file";
    const ext = (url.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
    const kind: DetectedFile["kind"] = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)
      ? "image"
      : ext === "pdf"
        ? "pdf"
        : "document";
    files.push({ name, url, kind });
  }
  return files;
}

// Text-ish attachments we can read server-side and hand to the model verbatim.
const TEXTUAL_EXT = new Set(["txt", "md", "csv", "json", "log", "xml", "html", "svg", "vcard", "ics"]);
const MAX_INLINE_CHARS = 6000;

/** Hosts we are willing to fetch server-side (our own storage + CDN only). */
function isTrustedStorageHost(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const supabaseHost = (() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    try {
      return new URL(base).hostname;
    } catch {
      return null;
    }
  })();
  const hosts = [
    supabaseHost,
    "imagedelivery.net",
    "r2.cloudflarestorage.com",
  ].filter(Boolean) as string[];
  return hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

async function readTextualAttachment(file: DetectedFile): Promise<string | null> {
  const ext = (file.url.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
  if (!TEXTUAL_EXT.has(ext) || !isTrustedStorageHost(file.url)) return null;
  try {
    const res = await fetch(file.url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const text = await res.text();
    const clipped = text.replace(/\s+/g, " ").trim().slice(0, MAX_INLINE_CHARS);
    return clipped || null;
  } catch {
    return null;
  }
}

function buildFileAnalysisDirective(
  files: Array<DetectedFile & { extractedText?: string | null }>,
): string {
  if (files.length === 0) return "";
  const lines = files.map((f, i) => {
    const head = `${i + 1}. ${f.kind.toUpperCase()} — "${f.name}" (URL: ${f.url})`;
    return f.extractedText
      ? `${head}\n   EXTRACTED TEXT (already read by our server — analyse this directly):\n   """${f.extractedText}"""`
      : head;
  });
  return [
    "",
    "",
    "[UPLOADED FILES DETECTED IN THIS MESSAGE]",
    ...lines,
    "",
    "FILE-ANALYSIS PROTOCOL (mandatory whenever the seeker attaches files):",
    '1. ACKNOWLEDGE the file first, warmly and specifically — e.g. "Aapne jo palm photo bheji hai, maine use receive kar liya..."',
    '2. EXTRACT RELEVANT DETAILS: where EXTRACTED TEXT is given above, quote and analyse it directly — do not claim you cannot read it. For images, describe what you can actually observe (or infer); if a visual detail cannot be confidently resolved, say so honestly — NEVER invent specifics you cannot see.',
    '3. PROACTIVELY ASK CLARIFYING QUESTIONS about the file — e.g. "Aapne palm photo bheji hai — kya aap right hand ki baat kar rahe hain, aur aapki dominant hand kaunsi hai?" or for a PDF: "Is report mein se kaunsa section aap decode karwana chahenge?" Ask only the 1-2 questions that most change the reading.',
    "4. WEAVE THE FILE into your background analysis and past-event verification before giving any prediction.",
  ].join("\n");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ consultantId: string }> },
) {
  try {
    const { consultantId } = await params;

    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Global rate limit (per-user) ────────────────────────────────────
    const rl = await checkRateLimit(aiRateLimiter, `ai-chat:${user.id}`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429, headers: rl.headers },
      );
    }

    // ─── Per-AI rate limit (200 msg/min per user per AI) ─────────────────
    const adminForRl = createAdminClient();
    const { data: rl2 } = await adminForRl.rpc("check_ai_rate_limit", {
      p_user_id: user.id,
      p_ai_id: consultantId,
      p_max_per_minute: 200,
    });
    const rlResult = rl2 as { ok?: boolean; retryAfter?: number } | null;
    if (rlResult && rlResult.ok === false) {
      return NextResponse.json(
        { error: "Slow down a moment — try again in a few seconds." },
        {
          status: 429,
          headers: { "Retry-After": String(rlResult.retryAfter ?? 10) },
        },
      );
    }

    // ─── Parse body ───────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 422 },
      );
    }

    const { conversationId, content } = parsed.data;

    // ─── Concurrency gate (per-user + global limits) ───────────────────────
    const concurrency = await tryAcquireAIChat(user.id);
    if (!concurrency.allowed) {
      return NextResponse.json(
        { error: concurrency.error ?? "Too many concurrent chats" },
        { status: 429 },
      );
    }

    // ─── Load persona (structured role contract) ─────────────────────────
    const persona = await loadPersona(consultantId, user.id);
    if (!persona) {
      await releaseAIChat(user.id);
      return NextResponse.json(
        { error: "AI consultant not found or inactive" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();

    // ─── Per-minute billing (auto-start for paid conversations) ───────────
    let billing: Record<string, unknown> | null = null;
    try {
      const lockResult = await withAdvisoryLock(
        `billing:${conversationId}:${user.id}`,
        async () => {
          const { data: billingData } = await admin.rpc("auto_start_chat_billing", {
            p_conversation_id: conversationId,
            p_user_id: user.id,
          });
          return (billingData ?? null) as Record<string, unknown> | null;
        },
      );
      billing = lockResult.result ?? null;
    } catch {
      /* billing is best-effort; stream continues */
    }
    if (billing && billing.success === false && billing.error === "insufficient_balance") {
      return NextResponse.json(
        {
          error: "Insufficient wallet balance for this per-minute session.",
          code: "insufficient_balance",
          required: billing.required ?? persona.perMinuteRate,
          available: billing.available ?? 0,
        },
        { status: 402 },
      );
    }

    // ─── Detect filler locale from content (Hindi → "hi", else "hi-en") ──
    const hasDevanagari = /[\u0900-\u097F]/.test(content);
    const hasRomanHindi = /\b(hai|kya|nahi|haan|karo|kaise|mujhe|tum|aap)\b/i.test(content);
    const fillerLocale = hasDevanagari ? "hi" : "hi-en";
    void hasRomanHindi;

    // ─── Build initial SSE events ──────────────────────────────────────────
    const initialEvents: unknown[] = billing ? [{ billing }] : [];

    // ─── Astrology integration: detect birth data in message ──────────────
    let astrologyResult: AstrologyAIResult | null = null;
    let astrologyContext = "";
    const birthData = detectBirthData(content);
    if (birthData && birthData.confidence !== "low") {
      try {
        astrologyResult = await interpretChart({
          birthDate: birthData.birthDate,
          birthTime: birthData.birthTime,
          birthPlace: birthData.birthPlace,
          timezone: birthData.timezone,
          chartType: "vedic",
        });

        // Build a concise context string to inject into the system prompt
        const interp = astrologyResult.interpretation;
        astrologyContext = `\n\n[ASTROLOGY READING — Computed from user's birth data: ${birthData.birthDate} ${birthData.birthTime} at ${birthData.placeName}]\n`;
        astrologyContext += `\nChart Overview: ${interp.overview}`;
        if (interp.career) astrologyContext += `\nCareer: ${interp.career}`;
        if (interp.relationships) astrologyContext += `\nRelationships: ${interp.relationships}`;
        if (interp.dasha) astrologyContext += `\nCurrent Dasha: ${interp.dasha}`;
        if (interp.remedies) astrologyContext += `\nRemedies: ${interp.remedies}`;
        if (interp.chartSummary) astrologyContext += `\nTechnical: ${interp.chartSummary}`;
        astrologyContext += "\n\nUse this chart data to provide insightful, personalized guidance when relevant. Reference specific planetary positions and classical texts.";

        // Emit astrology data as an initial SSE event so the UI can display it
        initialEvents.push({
          astrology: {
            interpretation: astrologyResult.interpretation,
            chart: astrologyResult.chart,
            ruleBasedInterpretations: astrologyResult.ruleBasedInterpretations,
            birthData: {
              date: birthData.birthDate,
              time: birthData.birthTime,
              place: birthData.placeName,
            },
          },
        });
      } catch (err) {
        console.error("[chat/ai] Astrology computation failed:", err);
        // Non-fatal — continue with normal chat
      }
    }

    // Inject astrology context into persona's system prompt if available
    if (astrologyContext) {
      persona.systemPrompt = persona.systemPrompt + astrologyContext;
    }

    // ─── Uploaded-file analysis: detect attachments in the message ────────
    const detectedFiles = detectUploadedFiles(content);
    const analyzedFiles = await Promise.all(
      detectedFiles.map(async (f) => {
        // Textual docs are fetched server-side so even text-only providers
        // analyse the real content; images go to vision-capable providers.
        if (f.kind === "image") return f;
        return { ...f, extractedText: await readTextualAttachment(f) };
      }),
    );
    const fileDirective = buildFileAnalysisDirective(analyzedFiles);
    if (fileDirective) {
      persona.systemPrompt = persona.systemPrompt + fileDirective;
    }
    const imageParts: AIContentPart[] = analyzedFiles
      .filter((f) => f.kind === "image")
      .slice(0, 4)
      .map((f) => ({ type: "image_url", image_url: { url: f.url } }));

    // ─── Stream ───────────────────────────────────────────────────────────
    const { stream } = await handleAIChat({
      conversationId,
      consultantId,
      userId: user.id,
      content,
      persona,
      admin,
      callAI: async (opts) => {
        // Attach uploaded images to the newest user message as multimodal
        // parts. Non-vision providers receive them flattened back to text
        // (engine-side), so a photo can never break the fallback chain.
        const messages: EngineAIMessage[] =
          imageParts.length === 0
            ? opts.messages
            : opts.messages.map((m, i, arr) =>
                i === arr.length - 1 && m.role === "user"
                  ? {
                      ...m,
                      content: [
                        { type: "text" as const, text: typeof m.content === "string" ? m.content : "" },
                        ...imageParts,
                      ],
                    }
                  : m,
              );
        // The engine returns { response, provider, attempts }
        const result = await callAI({
          messages,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          stream: true,
          preferProvider: opts.preferProvider,
        });
        return result;
      },
      fillerLocale,
      initialEvents,
    });

    // ─── Wrap stream to release concurrency on close ──────────────────────
    const reader = stream.getReader();
    const wrappedStream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            await releaseAIChat(user.id);
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (err) {
          await releaseAIChat(user.id);
          controller.error(err);
        }
      },
      async cancel() {
        await releaseAIChat(user.id);
        await reader.cancel();
      },
    });

    return new Response(wrappedStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...rl.headers,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AIChatError) {
      const status =
        err.code === "NOT_PARTICIPANT" ? 403 :
        err.code === "TOO_LONG" || err.code === "EMPTY_CONTENT" ? 400 :
        500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "AI chat failed";
    console.error("[api/chat/ai]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
