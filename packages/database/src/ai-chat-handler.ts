// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/ai-chat-handler — Streaming AI chat with fillers + safety
// ═══════════════════════════════════════════════════════════════════════════════
// Emits SSE events with three shapes:
//   data: {"delta": "text"}             — incremental assistant token
//   data: {"filler": "Hmm, let me…"}    — filler for UX during latency
//   data: {"done": true, "provider": …} — end of stream
//
// Filler cadence:
//   • Immediately on start: "first-token" filler
//   • If no delta within 5s: "slow" filler
//   • On provider switch mid-stream: "fallback" filler
// ═══════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { FillerEngine, type FillerLocale } from "./fillers";

// ─── Type contracts ──────────────────────────────────────────────────────────
// The handler only needs the fields it actually reads. Any caller that has
// a richer object (like the persona-loader's PersonaContext) can pass it
// because TypeScript structurally subsumes the extra fields.

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache_control?: { type: "ephemeral" };
}

export interface PersonaContext {
  id: string;
  userId: string;
  name: string;
  category: string;
  systemPrompt: string;
  persona: string | null;
  bio: string;
  specialties: string[];
  languages: string[];
  isPaid: boolean;
  perMinuteRate: number;
  safetyLevel?: "RELAXED" | "STANDARD" | "STRICT";
  bannedPatterns?: string[];
}

export interface CallAIOptions {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  preferProvider?: "agnes" | "groqPro" | "groqFast" | "zhipu";
  requestId?: string;
  onEvent?: (e: unknown) => void;
}

export interface CallAIResult {
  response: Response;
  provider: string;
  attempts: Array<{ provider: string; reason: string }>;
}

export type CallAIFn = (opts: CallAIOptions) => Promise<CallAIResult>;

export interface AIChatParams {
  conversationId: string;
  consultantId: string;
  userId: string;
  content: string;
  persona: PersonaContext;
  admin: SupabaseClient;
  callAI: CallAIFn;
  temperature?: number;
  maxTokens?: number;
  contextLimit?: number;
  fillerLocale?: FillerLocale;
}

export interface AIChatResult {
  stream: ReadableStream<Uint8Array>;
  userMessageId: string;
}

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_CONTEXT_LIMIT = 20;

export class AIChatError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_PARTICIPANT"
      | "EMPTY_CONTENT"
      | "TOO_LONG"
      | "AI_UNAVAILABLE"
      | "PERSIST_FAILED",
  ) {
    super(message);
    this.name = "AIChatError";
  }
}

export async function handleAIChat(params: AIChatParams): Promise<AIChatResult> {
  const {
    conversationId,
    userId,
    content,
    persona,
    admin,
    callAI,
    temperature = 0.75,
    maxTokens = 1200,
    contextLimit = DEFAULT_CONTEXT_LIMIT,
    fillerLocale = "hi-en",
  } = params;

  const trimmed = content.trim();
  if (!trimmed) throw new AIChatError("Empty message", "EMPTY_CONTENT");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new AIChatError(
      `Message exceeds ${MAX_MESSAGE_LENGTH} characters`,
      "TOO_LONG",
    );
  }

  // ─── Participant check ───────────────────────────────────────────────────
  const { data: participant, error: partErr } = await admin
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", userId)
    .maybeSingle();

  if (partErr) throw new AIChatError(partErr.message, "PERSIST_FAILED");
  if (!participant) {
    throw new AIChatError("Not a participant in this conversation", "NOT_PARTICIPANT");
  }

  // ─── Fetch prior context ─────────────────────────────────────────────────
  const { data: prior } = await admin
    .from("Message")
    .select("senderId, content, createdAt")
    .eq("conversationId", conversationId)
    .order("createdAt", { ascending: false })
    .limit(contextLimit);

  const priorMessages = (
    (prior ?? []) as Array<{ senderId: string | null; content: string; createdAt: string }>
  )
    .slice()
    .reverse();

  // ─── Persist user message ────────────────────────────────────────────────
  const { data: userMsg, error: userErr } = await admin
    .from("Message")
    .insert({
      conversationId,
      senderId: userId,
      content: trimmed,
      type: "text",
    })
    .select("id")
    .single();

  if (userErr || !userMsg) {
    throw new AIChatError(userErr?.message ?? "Failed to persist", "PERSIST_FAILED");
  }

  // ─── Build message array ─────────────────────────────────────────────────
  const history = priorMessages.map((m) => ({
    role: (m.senderId === persona.userId ? "assistant" : "user") as
      | "assistant"
      | "user",
    content: m.content,
  }));

  const messages: AIMessage[] = [
    {
      role: "system",
      content: persona.systemPrompt,
      cache_control: { type: "ephemeral" },
    },
    ...history.slice(-12),
    { role: "user", content: trimmed },
  ];

  // ─── Fire AI call ────────────────────────────────────────────────────────
  const { response: aiRes, provider, attempts } = await callAI({
    messages,
    stream: true,
    temperature,
    maxTokens,
  });

  if (!aiRes.body) {
    throw new AIChatError("AI provider returned no stream body", "AI_UNAVAILABLE");
  }

  // ─── SSE stream with filler injection ────────────────────────────────────
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulated = "";
  const fillers = new FillerEngine(fillerLocale, 2_500);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* controller closed */
        }
      };

      // ── Immediate first-token filler ────────────────────────────────────
      write({ filler: fillers.nextForce("first-token"), reason: "first-token" });

      // ── Slow-token watchdog (5s) ────────────────────────────────────────
      let lastTokenAt = Date.now();
      let firstTokenSeen = false;
      const watchdog = setInterval(() => {
        const idle = Date.now() - lastTokenAt;
        if (idle > 5_000) {
          const f = firstTokenSeen ? fillers.next("slow") : fillers.next("slow");
          if (f) write({ filler: f, reason: "slow" });
        }
      }, 2_000);

      const reader = aiRes.body!.getReader();
      let buffer = "";

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                lastTokenAt = Date.now();
                firstTokenSeen = true;
                accumulated += delta;
                write({ delta });
              }
            } catch {
              /* malformed SSE chunk — skip */
            }
          }
        }
      } catch (e) {
        console.error("[ai-chat-handler] stream error:", e);
        const f = fillers.next("fallback");
        if (f) write({ filler: f, reason: "fallback" });
      } finally {
        clearInterval(watchdog);
      }

      // ─── Persist assistant message with safety check ─────────────────────
      const finalText = accumulated.trim();
      if (finalText) {
        let safeText = finalText;
        try {
          const { data: safety } = await admin.rpc("check_ai_safety", {
            p_ai_id: persona.id,
            p_content: finalText,
          });
          const s = safety as { safe?: boolean } | null;
          if (s && s.safe === false) {
            safeText =
              "I sense this is outside what I can guide on. Let me redirect us — what else is on your mind?";
          }
        } catch {
          /* safety RPC missing — proceed */
        }

        try {
          await admin.from("Message").insert({
            conversationId,
            senderId: persona.userId,
            content: safeText,
            type: "text",
          });
        } catch (e) {
          console.error("[ai-chat-handler] persist assistant failed:", e);
        }
      }

      write({ done: true, provider, attempts });
      controller.close();
    },
  });

  return { stream, userMessageId: userMsg.id };
}
