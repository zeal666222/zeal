import type { Env } from "./env";
import type { PersonaContext } from "./persona-loader";
import { FillerEngine, type FillerLocale } from "./support/fillers";
import { buildStageSequence, pickStageLocale } from "./support/stages";
import { buildSuggestions, pickSuggestionLocale, type Suggestion } from "./support/suggestions";
import { PersonaEngine } from "./persona-engine";
import { detectUploadedFiles, readTextualAttachment, buildFileAnalysisDirective } from "./support/file-analysis";
import { detectBirthData } from "./support/birth-data-detector";
import { retrieveKnowledge } from "./knowledge/rag";
import { detectEmotion, buildEmotionDirective, trackEmotionalTrajectory } from "./knowledge/emotion-detect";
import { record as recordAiMetric } from "./ai-metrics";
import { insertMessage, isoOf, readMessages, requireParticipant, sqliteNow, touchConversation } from "./conversation-store";
import { describeProfile, saveSeekerProfile, readSeekerProfile } from "./seeker-profile";
import { ensureChart } from "./kundali/service";
import { screenReply } from "./moderation";
import { publishToRoom } from "./realtime";

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
  /** Proactive consultant opener — generate the first assistant message
   *  from the seeker's kundali without persisting a synthetic user turn. */
  opener?: boolean;
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
    opener = false,
  } = params;

  const OPENING_TRIGGER = "Open the consultation with a warm, personal greeting.";
  const trimmed = content.trim() || (opener ? OPENING_TRIGGER : "");
  if (!trimmed) throw new Error("Empty message");
  if (!opener && trimmed.length > MAX_MESSAGE_LENGTH) throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`);

  // Membership gate — D1 alone decides who is in the room. The room id comes
  // from the caller, so this is the only thing separating one seeker's
  // transcript from another's.
  const isMember = await requireParticipant(env, conversationId, userId);
  if (!isMember) throw new Error("Not a participant in this conversation");

  // Prior context from D1
  const priorMessages = await readMessages(env, conversationId, contextLimit);

  // Persist the user turn (skipped for the proactive opener — there is no
  // human turn to record, only the assistant's chart-grounded greeting).
  const userMsgId = crypto.randomUUID();
  if (!opener) {
    const userStamp = sqliteNow();
    await insertMessage(env, {
      id: userMsgId,
      conversationId,
      senderId: userId,
      content: trimmed,
      type: "text",
      createdAt: userStamp,
    });
    await touchConversation(env, conversationId, trimmed);
    // Another tab of the same seeker sees the turn immediately.
    void publishToRoom(env, conversationId, {
      type: "message",
      message: {
        id: userMsgId,
        conversationId,
        senderId: userId,
        content: trimmed,
        createdAt: isoOf(userStamp),
      },
    });
  }

  // ─── Build the rich system prompt with contextual directives ───────────
  // PersonaEngine already produced persona.systemPrompt as the base contract.
  // We now layer: (1) uploaded-file directive, (2) detected birth data,
  // (3) seeker context, then re-build the message array so the TURN LANGUAGE
  // directive from PersonaEngine.buildMessages lands just before the user turn.

  const enrichedPromptParts: string[] = [persona.systemPrompt];
  const derivedEvents: unknown[] = [];
  let emotionSignal: ReturnType<typeof detectEmotion> | null = null;

  if (opener) {
    enrichedPromptParts.push(
      `\n\n[OPENING TURN] This is your very first message to the seeker; they have just completed intake. ` +
      `Greet them warmly in their language (default Hinglish), address them by name if known, and show that you have genuinely read their chart: ` +
      `reference 2-3 concrete specifics from the kundali above (Lagna, Moon rashi/nakshatra, the running Mahadasha/Antardasha, or a notable house placement) ` +
      `as a short, intriguing observation tied to their stated concern. Do NOT recite the whole chart, do NOT ask again for details you already have, ` +
      `and end with ONE inviting question that draws them into the conversation. Keep it under 120 words.`,
    );
  } else {
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
      // A seeker who types their birth details mid-conversation is answering
      // the same question the intake form asks — so store it under their own
      // id and it grounds every later turn, across consultants and devices.
      const stored = await saveSeekerProfile(env, userId, {
        dob: birth.birthDate,
        tob: birth.birthTime,
        pob: birth.placeName,
        latitude: birth.birthPlace.lat,
        longitude: birth.birthPlace.lng,
        timezone: birth.timezone,
      });
      if (stored) {
        // Compute the chart now, on the worker, so the next turn's persona
        // sees a fresh summary instead of a stale flag.
        await ensureChart(env, userId, stored);
        const refreshed = await readSeekerProfile(env, userId);
        derivedEvents.push({
          profileUpdated: {
            chartStale: describeProfile(refreshed).chartStale,
            hasBirthData: describeProfile(refreshed).hasBirthData,
            missing: describeProfile(refreshed).missing,
            name: refreshed?.name,
            dob: refreshed?.dob,
            tob: refreshed?.tob,
            pob: refreshed?.pob,
            latitude: refreshed?.latitude,
            longitude: refreshed?.longitude,
            timezone: refreshed?.timezone,
          },
        });
      }
      enrichedPromptParts.push(
        `\n\n[DETECTED BIRTH DATA — high-confidence parse from this turn, now saved to this seeker's profile]\n` +
        `Date: ${birth.birthDate}\nTime: ${birth.birthTime}\nPlace: ${birth.placeName} (${birth.birthPlace.lat.toFixed(3)}, ${birth.birthPlace.lng.toFixed(3)})\n` +
        `Treat this as verified intake data. Ground your reading in this chart, ask only for details you still need (e.g. dominant hand for palmistry, specific question focus). Do NOT re-ask for date/time/place.`,
      );
    }

    // Real-time emotion detection — runs in <0.1ms, pure regex.
    // Detects emotional state from the user's message and injects a psychology-
    // grounded directive into the system prompt BEFORE knowledge retrieval,
    // so the AI responds with appropriate emotional intelligence from the start.
    emotionSignal = detectEmotion(trimmed);
    const emotionDirective = buildEmotionDirective(emotionSignal);
    if (emotionDirective) enrichedPromptParts.push(`\n\n${emotionDirective}`);

    // Per-turn knowledge grounding from the 400+ book training corpus.
    // Retrieves astrology + psychology + communication excerpts matching the
    // seeker's message; the model treats these as its own internal reasoning
    // fuel. Legitimate topics like love/marriage yogas now have specific
    // vocabulary in-context, so upstream safety filters stop firing.
    const grounding = retrieveKnowledge(trimmed, persona.category, 6, persona.specialties);
    if (grounding) enrichedPromptParts.push(grounding);
  }

  const history = priorMessages.map((m) => ({
    role: (m.sender_id === persona.userId ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));

  // Track emotional trajectory across the conversation. If the user has been
  // in the same emotional state for 3+ turns, deepen the approach. If they've
  // shifted emotions, follow the shift naturally.
  if (emotionSignal) {
    const trajectory = trackEmotionalTrajectory(history, emotionSignal);
    if (trajectory.adjust && trajectory.adjustment) {
      enrichedPromptParts.push(`\n\n${trajectory.adjustment}`);
    }
  }

  const finalSystemPrompt = enrichedPromptParts.join("");
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

      if (!opener) write({ userMessageId: userMsgId });
      for (const evt of [...initialEvents, ...derivedEvents]) write(evt);

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
      //
      // Also: refusal-shape guard. Even with the affirmative "answer legitimate
      // astrology" directive + per-turn corpus grounding, some providers still
      // emit canned refusals on love/marriage/intimacy questions. Detect that
      // pattern here and swap the reply with the hardcoded oracle, which
      // answers those topics substantively in the seeker's language.
      let finalText = finalTextRaw;
      const refusalShape = isRefusalShaped(finalTextRaw);
      if (!finalText || refusalShape) {
        const { generateHardcoded } = await import("./ai-engine/hardcoded-oracle");
        const replacement = generateHardcoded({
          personaName: persona.name,
          personaCategory: persona.category,
          systemPrompt: persona.systemPrompt.slice(0, 400),
          userMessage: trimmed || "Tell me something.",
        });
        if (refusalShape && finalText) {
          // Stream had content — replace it with a full substantive reply.
          // Emit a single delta so the client appends after a visible boundary.
          write({ delta: "\n\n" + replacement });
          finalText = finalTextRaw + "\n\n" + replacement;
        } else {
          finalText = replacement;
          write({ delta: finalText });
        }
      }
      let persisted: { id: string; senderId: string; content: string; createdAt: string } | null = null;

      if (finalText) {
        // Local screen: platform floor + this consultant's banned patterns.
        // Read from D1 with the persona, so no database round-trip gates the reply.
        const { text: safeText } = screenReply(finalText, persona);

        const assistantId = crypto.randomUUID();
        // D1 stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS"; the user turn
        // above uses that default. An ISO 'T'-separated stamp would sort ahead
        // of same-second rows lexicographically and reorder the transcript.
        const stamp = sqliteNow();
        await insertMessage(env, {
          id: assistantId,
          conversationId,
          senderId: persona.userId,
          content: safeText,
          type: "text",
          createdAt: stamp,
        });
        await touchConversation(env, conversationId, safeText);
        persisted = { id: assistantId, senderId: persona.userId, content: safeText, createdAt: isoOf(stamp) };

        void publishToRoom(env, conversationId, { type: "message", message: { ...persisted, conversationId } });
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

// ─── Refusal-shape detector ───────────────────────────────────────────────────
// Matches upstream-model canned refusal phrasing so we can swap in a real,
// substantive reply from the local hardcoded oracle. Deliberately narrow:
// only fires when the message is essentially a refusal, so a legitimate
// "I can't predict a specific death date but here's what I can see…" hedge
// from our own persona still passes through untouched.
const REFUSAL_PATTERNS: RegExp[] = [
  /^i(?:'?|’?)\s*(?:cannot|can't|am\s+unable|'?m\s+not\s+able)/i,
  /^i\s+cannot\s+provide/i,
  /^i(?:'?|’?)m\s+not\s+(?:able|allowed|permitted)/i,
  /^i\s+am\s+not\s+(?:able|allowed|permitted|designed)/i,
  /^as\s+an?\s+(?:ai|language\s+model|virtual\s+assistant|assistant)/i,
  /^i\s+don[’']?t\s+(?:have|provide)\s+(?:personal\s+opinions|the\s+ability)/i,
  /^i\s+can[’']?t\s+help\s+(?:with|that)/i,
  /^\s*is\s+there\s+something\s+else\s+i\s+can\s+help/i,
  /^\s*i\s+(?:hope|understand)\s+you\s+find\s+something\s+else/i,
  /^\s*(?:main|hum)\s+(?:yeh|ye)\s+(?:nahi|nahin)\s+(?:bata|kar|sakt)/i,
  /^\s*(?:ksham|sorry)\s*(?:ki|karne)/i,
];

function isRefusalShaped(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length > 260) return false; // real answer — never looks like this
  for (const re of REFUSAL_PATTERNS) if (re.test(t)) return true;
  // Catches "I cannot provide a detailed explanation of X. Is there something else I can help you with?"
  return /cannot\s+provide\b/i.test(t) && /is\s+there\s+something\s+else/i.test(t);
}
