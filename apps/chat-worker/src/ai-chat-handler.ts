import type { Env } from "./env";
import type { PersonaContext } from "./persona-loader";
import { rpc, insertRow } from "./supabase-client";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache_control?: { type: "ephemeral" };
}

export interface CallAIResult {
  response: Response;
  provider: string;
  attempts: Array<{ provider: string; reason: string }>;
}

export type CallAIFn = (opts: {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}) => Promise<CallAIResult>;

export interface ChatHandlerParams {
  env: Env;
  conversationId: string;
  consultantId: string;
  userId: string;
  content: string;
  persona: PersonaContext;
  callAI: CallAIFn;
  temperature?: number;
  maxTokens?: number;
  contextLimit?: number;
  initialEvents?: unknown[];
}

export interface ChatHandlerResult {
  stream: ReadableStream<Uint8Array>;
  userMessageId: string;
}

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_CONTEXT_LIMIT = 20;

const FILLERS_HI_EN = [
  "Hmm, let me think about this...",
  "Interesting question — let me look at this...",
  "Let me consider the planetary positions...",
  "That's a meaningful question...",
  "Let me reflect on this for a moment...",
];

function randomFiller(): string {
  return FILLERS_HI_EN[Math.floor(Math.random() * FILLERS_HI_EN.length)];
}

export async function handleAIChat(params: ChatHandlerParams): Promise<ChatHandlerResult> {
  const {
    env,
    conversationId,
    userId,
    content,
    persona,
    callAI,
    temperature = 0.75,
    maxTokens = 1200,
    contextLimit = DEFAULT_CONTEXT_LIMIT,
    initialEvents = [],
  } = params;

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Empty message");
  if (trimmed.length > MAX_MESSAGE_LENGTH) throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`);

  // Participant check via D1 (lazy shadow creation)
  const participant = await env.DB.prepare(
    `SELECT user_id FROM conversation_participant WHERE conversation_id = ? AND user_id = ?`
  ).bind(conversationId, userId).first();

  if (!participant) {
    // Lazy shadow: validate via Supabase, then create shadow
    const { data: supaParticipant } = await rpcQuery(env, "ConversationParticipant", {
      conversationId: `eq.${conversationId}`,
      userId: `eq.${userId}`,
      limit: "1",
    });
    if (!supaParticipant || (supaParticipant as unknown[]).length === 0) {
      throw new Error("Not a participant in this conversation");
    }
    // Create shadow
    await env.DB.prepare(
      `INSERT OR IGNORE INTO conversation (id) VALUES (?)`
    ).bind(conversationId).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO conversation_participant (conversation_id, user_id) VALUES (?, ?)`
    ).bind(conversationId, userId).run();
  }

  // Fetch prior context from D1
  const prior = await env.DB.prepare(
    `SELECT sender_id, content, created_at FROM message
     WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(conversationId, contextLimit).all<{ sender_id: string; content: string; created_at: string }>();

  const priorMessages = (prior.results ?? []).slice().reverse();

  // Persist user message to D1
  const userMsgId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO message (id, conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?, 'text')`
  ).bind(userMsgId, conversationId, userId, trimmed).run();

  // Async dual-write to Supabase (fire-and-forget)
  void insertRow(env, "Message", {
    conversationId,
    senderId: userId,
    content: trimmed,
    type: "text",
  });

  // Build message array
  const history = priorMessages.map((m) => ({
    role: (m.sender_id === persona.userId ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));

  const messages: AIMessage[] = [
    { role: "system", content: persona.systemPrompt, cache_control: { type: "ephemeral" } },
    ...(persona.fewShots ?? []).slice(-4),
    ...history.slice(-12),
    { role: "user", content: trimmed },
  ];

  // Fire AI call
  const { response: aiRes, provider, attempts } = await callAI({
    messages,
    stream: true,
    temperature,
    maxTokens,
  });

  if (!aiRes.body) throw new Error("AI provider returned no stream body");

  // SSE stream
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let accumulated = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch { /* closed */ }
      };

      write({ userMessageId: userMsgId });
      for (const evt of initialEvents) write(evt);
      write({ filler: randomFiller(), reason: "first-token" });

      let lastTokenAt = Date.now();
      const watchdog = setInterval(() => {
        if (Date.now() - lastTokenAt > 5_000) {
          write({ filler: randomFiller(), reason: "slow" });
        }
      }, 2_000);

      const reader = aiRes.body!.getReader();
      let buffer = "";
      let streamDied = false;

      try {
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
              const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                lastTokenAt = Date.now();
                accumulated += delta;
                write({ delta });
              }
            } catch { /* malformed */ }
          }
        }
      } catch (e) {
        streamDied = true;
        console.error("[chat-handler] stream error:", e);
        write({ filler: randomFiller(), reason: "fallback" });
      } finally {
        clearInterval(watchdog);
      }

      // Persist assistant message
      const finalText = accumulated.trim();
      let persisted: { id: string; senderId: string; content: string; createdAt: string } | null = null;

      if (finalText) {
        let safeText = finalText;
        try {
          const { data: safety } = await rpc<{ safe?: boolean }>(env, "check_ai_safety", {
            p_ai_id: persona.id,
            p_content: finalText,
          });
          if (safety && safety.safe === false) {
            safeText = "I sense this is outside what I can guide on. Let me redirect — what else is on your mind?";
          }
        } catch { /* safety RPC missing */ }

        const assistantId = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO message (id, conversation_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, 'text', ?)`
        ).bind(assistantId, conversationId, persona.userId, safeText, now).run();

        void insertRow(env, "Message", {
          conversationId,
          senderId: persona.userId,
          content: safeText,
          type: "text",
        });

        persisted = { id: assistantId, senderId: persona.userId, content: safeText, createdAt: now };
      }

      write({
        done: true,
        provider,
        attempts,
        message: persisted,
        fullText: finalText || undefined,
        truncated: streamDied || undefined,
      });
      controller.close();
    },
  });

  return { stream, userMessageId: userMsgId };
}

async function rpcQuery(env: Env, table: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return { data: null };
  const data = await res.json();
  return { data };
}
