import type { Env } from "./env";
import type { PersonaContext } from "./persona-loader";
import { rpc, insertRow } from "./supabase-client";
import { FillerEngine, type FillerLocale } from "./support/fillers";
import { buildStageSequence, pickStageLocale } from "./support/stages";
import { buildSuggestions, pickSuggestionLocale, type Suggestion } from "./support/suggestions";
import { PersonaEngine } from "./persona-engine";
import { detectUploadedFiles, readTextualAttachment, buildFileAnalysisDirective } from "./support/file-analysis";
import { detectBirthData } from "./support/birth-data-detector";
import { record as recordAiMetric } from "./ai-metrics";

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

function pickFillerLocale(text: string): FillerLocale {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  // Simple Hinglish heuristic — good enough for filler selection.
  return "hi-en";
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
    const { data: supaParticipant } = await rpcQuery(env, "ConversationParticipant", {
      conversationId: `eq.${conversationId}`,
      userId: `eq.${userId}`,
      limit: "1",
    });
    if (!supaParticipant || (supaParticipant as unknown[]).length === 0) {
      throw new Error("Not a participant in this conversation");
    }
    await env.DB.prepare(`INSERT OR IGNORE INTO conversation (id) VALUES (?)`).bind(conversationId).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO conversation_participant (conversation_id, user_id) VALUES (?, ?)`
    ).bind(conversationId, userId).run();
  }

  // Prior context from D1
  const prior = await env.DB.prepare(
    `SELECT sender_id, content, created_at FROM message
     WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(conversationId, contextLimit).all<{ sender_id: string; content: string; created_at: string }>();
  const priorMessages = (prior.results ?? []).slice().reverse();

  // Persist user message
  const userMsgId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO message (id, conversation_id, sender_id, content, type) VALUES (?, ?, ?, ?, 'text')`
  ).bind(userMsgId, conversationId, userId, trimmed).run();

  void insertRow(env, "Message", {
    conversationId,
    senderId: userId,
    content: trimmed,
    type: "text",
  });

  // ─── Build the rich system prompt with contextual directives ───────────
  // PersonaEngine already produced persona.systemPrompt as the base contract.
  // We now layer: (1) uploaded-file directive, (2) detected birth data,
  // (3) seeker context, then re-build the message array so the TURN LANGUAGE
  // directive from PersonaEngine.buildMessages lands just before the user turn.

  const enrichedPromptParts: string[] = [persona.systemPrompt];

  const detectedFiles = detectUploadedFiles(trimmed);
  if (detectedFiles.length > 0) {
    const analyzed = await Promise.all(
      detectedFiles.map(async (f) =>
        f.kind === "image" ? f : { ...f, extractedText: await readTextualAttachment(f) },
      ),
    );
    const directive = buildFileAnalysisDirective(analyzed);
    if (directive) enrichedPromptParts.push(directive);
  }

  const birth = detectBirthData(trimmed);
  if (birth && birth.confidence !== "low") {
    enrichedPromptParts.push(
      `\n\n[DETECTED BIRTH DATA — high-confidence parse from this turn]\n` +
      `Date: ${birth.birthDate}\nTime: ${birth.birthTime}\nPlace: ${birth.placeName} (${birth.birthPlace.lat.toFixed(3)}, ${birth.birthPlace.lng.toFixed(3)})\n` +
      `Treat this as verified intake data. Ground your reading in this chart, ask only for details you still need (e.g. dominant hand for palmistry, specific question focus). Do NOT re-ask for date/time/place.`,
    );
  }

  const finalSystemPrompt = enrichedPromptParts.join("");

  const history = priorMessages.map((m) => ({
    role: (m.sender_id === persona.userId ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));

  // Use PersonaEngine.buildMessages for consistent structure:
  //   system (contract) → few-shots → history → TURN LANGUAGE directive → user
  const messages = PersonaEngine.buildMessages(
    {
      systemPrompt: finalSystemPrompt,
      prohibitions: [],
      fewShots: persona.fewShots ?? [],
    },
    history,
    trimmed,
  ) as AIMessage[];

  const t0 = Date.now();
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
  let firstTokenAt = 0;
  let tokenCount = 0;
  const fillers = new FillerEngine(pickFillerLocale(trimmed), 2_500);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch { /* closed */ }
      };

      write({ userMessageId: userMsgId });
      for (const evt of initialEvents) write(evt);

      // Semantic stage sequence — persona-aware "thinking out loud" labels.
      // We advance through them until the first token arrives; the client
      // renders them as a shimmer stepper instead of three bouncing dots.
      const stageLocale = pickStageLocale(trimmed);
      const stages = buildStageSequence(persona.category, stageLocale);
      let stageIdx = 0;
      const advanceStage = () => {
        if (stageIdx >= stages.length) return;
        write({ stage: stages[stageIdx] });
        stageIdx++;
      };
      advanceStage();
      const stageTimer = setInterval(() => {
        if (firstTokenAt > 0) return; // stop once the model is talking
        advanceStage();
      }, 1200);

      write({ filler: fillers.nextForce("first-token"), reason: "first-token" });

      let lastTokenAt = Date.now();
      const watchdog = setInterval(() => {
        if (Date.now() - lastTokenAt > 5_000) {
          const f = fillers.next("slow");
          if (f) write({ filler: f, reason: "slow" });
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
                if (firstTokenAt === 0) {
                  firstTokenAt = Date.now();
                  // Advance to the "reading answer" stage as soon as tokens
                  // start flowing so the client can retire the stepper.
                  write({ stageDone: true });
                }
                tokenCount += 1;
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
        const f = fillers.next("fallback");
        if (f) write({ filler: f, reason: "fallback" });
      } finally {
        clearInterval(watchdog);
        clearInterval(stageTimer);
        const t1 = Date.now();
        const ttft = firstTokenAt ? firstTokenAt - t0 : t1 - t0;
        const tpot = tokenCount > 1 ? (t1 - (firstTokenAt || t1)) / (tokenCount - 1) : 0;
        recordAiMetric({
          consultant: persona.id,
          provider,
          ttftMs: ttft,
          totalMs: t1 - t0,
          tokens: tokenCount,
          ok: !streamDied,
        });
        console.log(JSON.stringify({
          ev: "ai_call",
          consultant: persona.id,
          provider,
          attempts: attempts.length,
          ttft_ms: ttft,
          tpot_ms: Math.round(tpot),
          total_ms: t1 - t0,
          tokens: tokenCount,
          ok: !streamDied,
        }));
      }

      const finalTextRaw = accumulated.trim();
      // Never-empty guarantee: if the upstream stream died mid-flight or every
      // provider failed, fall back to the local hardcoded oracle so the user
      // sees a real, structured, on-brand reply instead of a blank bubble.
      let finalText = finalTextRaw;
      if (!finalText) {
        const { generateHardcoded } = await import("./ai-engine/hardcoded-oracle");
        finalText = generateHardcoded({
          personaName: persona.name,
          personaCategory: persona.category,
          systemPrompt: persona.systemPrompt.slice(0, 400),
          userMessage: trimmed || "Tell me something.",
        });
        // Stream it as a single delta so UI picks it up like normal text.
        write({ delta: finalText });
      }
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
        try {
          await env.DB.prepare(
            `INSERT INTO message (id, conversation_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, 'text', ?)`
          ).bind(assistantId, conversationId, persona.userId, safeText, now).run();
        } catch (e) {
          console.error("[chat-handler] D1 insert failed:", e instanceof Error ? e.message : e);
        }

        // Persist the assistant reply into Supabase so a page refresh shows the
        // full conversation. Message.senderId has an FK to public."User" — on
        // deployments where AI consultants don't have shadow auth.users rows
        // (the 0000_consolidated migration seeds them, but the cleanup has not
        // always been applied), the insert fails with a 23503 FK violation.
        // Retry once with senderId=null: the column is nullable and the UI
        // treats any message whose senderId differs from the human user's id
        // as the AI's reply, so a null sender renders on the correct side.
        const supaInsert = await insertRow(env, "Message", {
          id: assistantId,
          conversationId,
          senderId: persona.userId,
          content: safeText,
          type: "text",
          createdAt: now,
        });
        if (supaInsert.error) {
          console.warn("[chat-handler] Supabase Message insert failed (persona sender):", supaInsert.error.message);
          const retry = await insertRow(env, "Message", {
            id: assistantId,
            conversationId,
            senderId: null,
            content: safeText,
            type: "text",
            metadata: { ai_consultant_id: persona.id, ai_consultant_name: persona.name },
            createdAt: now,
          });
          if (retry.error) {
            console.error("[chat-handler] Supabase Message retry insert failed:", retry.error.message);
          } else {
            persisted = { id: assistantId, senderId: persona.userId, content: safeText, createdAt: now };
          }
        } else {
          persisted = { id: assistantId, senderId: persona.userId, content: safeText, createdAt: now };
        }
      }

      const suggestionLocale = pickSuggestionLocale(trimmed);
      const suggestions: Suggestion[] = finalText
        ? buildSuggestions(persona.category, finalText, suggestionLocale)
        : [];

      write({
        done: true,
        provider,
        attempts,
        message: persisted,
        fullText: finalText || undefined,
        truncated: streamDied || undefined,
        suggestions: suggestions.length ? suggestions : undefined,
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
