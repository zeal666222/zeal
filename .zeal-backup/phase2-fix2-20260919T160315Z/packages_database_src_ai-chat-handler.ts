// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/ai-chat-handler — Framework-agnostic streaming AI chat
// ═══════════════════════════════════════════════════════════════════════════════
// Both apps/web and apps/admin use this same handler. Each app injects its own:
//   • `admin`  — service-role Supabase client (createAdminClient)
//   • `callAI` — provider-agnostic streaming LLM client
//
// The handler owns:
//   • Participant authorization
//   • User message persistence
//   • Conversation context reconstruction (last 20 turns)
//   • System-prompt assembly (persona + specialties + languages)
//   • Streaming SSE passthrough
//   • Assistant message persistence on stream completion
// ═══════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Provider contract ────────────────────────────────────────────────────────
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache_control?: { type: "ephemeral" };
}

export interface CallAIOptions {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export type CallAIFn = (opts: CallAIOptions) => Promise<Response>;

// ─── Persona contract (matches persona-loader.ts) ─────────────────────────────
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
}

// ─── Handler params ───────────────────────────────────────────────────────────
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
}

export interface AIChatResult {
  stream: ReadableStream<Uint8Array>;
  userMessageId: string;
}

// ─── Guard: message length ────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_CONTEXT_LIMIT = 20;

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleAIChat(params: AIChatParams): Promise<AIChatResult> {
  const {
    conversationId,
    userId,
    content,
    persona,
    admin,
    callAI,
    temperature = 0.7,
    maxTokens = 800,
    contextLimit = DEFAULT_CONTEXT_LIMIT,
  } = params;

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Empty content");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`);
  }

  // ─── 1. Verify the sender is a participant ────────────────────────────────
  const { data: participant, error: partErr } = await admin
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", userId)
    .maybeSingle();

  if (partErr) throw new Error(partErr.message);
  if (!participant) throw new Error("Not a participant in this conversation");

  // ─── 2. Fetch context BEFORE inserting the new message ────────────────────
  const { data: prior } = await admin
    .from("Message")
    .select("senderId, content, createdAt")
    .eq("conversationId", conversationId)
    .order("createdAt", { ascending: false })
    .limit(contextLimit);

  const priorMessages = (
    (prior ?? []) as Array<{
      senderId: string | null;
      content: string;
      createdAt: string;
    }>
  )
    .slice()
    .reverse();

  // ─── 3. Insert the user's new message ─────────────────────────────────────
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
    throw new Error(userErr?.message || "Failed to persist user message");
  }

  // ─── 4. Build the message array (system → history → new user turn) ────────
  const systemBlock = [
    persona.systemPrompt,
    "",
    `Specialties: ${persona.specialties.join(", ") || "general guidance"}`,
    `Languages: ${persona.languages.join(", ") || "English"}`,
  ].join("\n");

  const history: AIMessage[] = priorMessages.map((m) => ({
    role: (m.senderId === persona.userId ? "assistant" : "user") as
      | "assistant"
      | "user",
    content: m.content,
  }));

  const messages: AIMessage[] = [
    {
      role: "system",
      content: systemBlock,
      // Prompt caching hint — Groq / OpenAI-compatible providers honor this
      cache_control: { type: "ephemeral" },
    },
    ...history,
    { role: "user", content: trimmed },
  ];

  // ─── 5. Call the AI with streaming ────────────────────────────────────────
  const aiRes = await callAI({
    messages,
    stream: true,
    temperature,
    maxTokens,
  });

  if (!aiRes.body) throw new Error("AI provider returned no stream body");

  // ─── 6. Pipe tokens to client + persist assistant turn on completion ──────
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulated = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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
                accumulated += delta;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
                );
              }
            } catch {
              // Malformed SSE chunk — safe to skip
            }
          }
        }
      } catch (err) {
        console.error("[ai-chat-handler] stream error:", err);
      }

      // Persist the accumulated assistant reply
      const finalText = accumulated.trim();
      if (finalText) {
        try {
          await admin.from("Message").insert({
            conversationId,
            senderId: persona.userId,
            content: finalText,
            type: "text",
          });
        } catch (err) {
          console.error("[ai-chat-handler] persist assistant message failed:", err);
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },

    cancel(reason) {
      console.warn("[ai-chat-handler] client cancelled stream:", reason);
    },
  });

  return { stream, userMessageId: userMsg.id };
}

// ─── Error taxonomy (used by routes to pick HTTP status) ──────────────────────
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
