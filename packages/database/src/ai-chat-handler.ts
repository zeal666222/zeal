// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/ai-chat-handler — Framework-agnostic streaming AI chat
// ═══════════════════════════════════════════════════════════════════════════════
import type { SupabaseClient } from "@supabase/supabase-js";

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
    conversationId, userId, content, persona, admin, callAI,
    temperature = 0.7, maxTokens = 800, contextLimit = DEFAULT_CONTEXT_LIMIT,
  } = params;

  const trimmed = content.trim();
  if (!trimmed) throw new AIChatError("Empty message", "EMPTY_CONTENT");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new AIChatError(
      `Message exceeds ${MAX_MESSAGE_LENGTH} characters`,
      "TOO_LONG",
    );
  }

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

  const { data: prior } = await admin
    .from("Message")
    .select("senderId, content, createdAt")
    .eq("conversationId", conversationId)
    .order("createdAt", { ascending: false })
    .limit(contextLimit);

  const priorMessages = (
    (prior ?? []) as Array<{ senderId: string | null; content: string; createdAt: string }>
  ).slice().reverse();

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

  const systemBlock = [
    persona.systemPrompt,
    "",
    `Specialties: ${persona.specialties.join(", ") || "general guidance"}`,
    `Languages: ${persona.languages.join(", ") || "English"}`,
  ].join("\n");

  const history: AIMessage[] = priorMessages.map((m) => ({
    role: (m.senderId === persona.userId ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));

  const messages: AIMessage[] = [
    { role: "system", content: systemBlock, cache_control: { type: "ephemeral" } },
    ...history,
    { role: "user", content: trimmed },
  ];

  const aiRes = await callAI({ messages, stream: true, temperature, maxTokens });
  if (!aiRes.body) throw new AIChatError("AI provider returned no stream body", "AI_UNAVAILABLE");

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
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            } catch { /* malformed SSE — skip */ }
          }
        }
      } catch (e) {
        console.error("[ai-chat-handler] stream error:", e);
      }

      const finalText = accumulated.trim();
      if (finalText) {
        try {
          await admin.from("Message").insert({
            conversationId,
            senderId: persona.userId,
            content: finalText,
            type: "text",
          });
        } catch (e) {
          console.error("[ai-chat-handler] persist assistant failed:", e);
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return { stream, userMessageId: userMsg.id };
}
