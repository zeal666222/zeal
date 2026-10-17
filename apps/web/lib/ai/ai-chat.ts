import {z} from "zod";
import {callAIJson, AIUnavailableError} from "@/lib/ai";
import type {AIMessage} from "@/lib/ai";
import {detectLanguage, languageDirective} from "@/lib/ai/language";

const AI_RESPONSE_SCHEMA = z.object({
  content: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

type AIResponse = z.infer<typeof AI_RESPONSE_SCHEMA>;

/** Timeout for the outer AbortController wrapping the engine call. */
const OUTER_TIMEOUT_MS = 15_000;

/**
 * Shared Zeal Consultant directive — mirrors the one in app/api/ai/route.ts.
 * Always applied so chat replies default to Hinglish and follow the
 * background-analysis → past-event-verification → prediction protocol.
 */
const ZEAL_CONSULTANT_DIRECTIVE = [
  "ZEAL CONSULTANT DIRECTIVE (applies to everything you output):",
  "",
  "LANGUAGE:",
  'Start in Hinglish (warm Roman-script Hindi+English mix, e.g. "Aapki kundali mein Shani ki position bahut interesting hai..."). If the user clearly writes full English, switch to English; if full Hindi (Devanagari), match it. Default = Hinglish.',
  "",
  "BACKGROUND ANALYSIS:",
  "Before answering, do a detailed analysis of everything the user provided (birth details, question, symbols, uploaded file). State briefly what you observed before interpreting.",
  "",
  "VERIFY PAST EVENTS FIRST:",
  "To build confidence, first reference verifiable past patterns/events implied by the input (e.g. past Saturn transit effects the user can confirm), then give self-reasoned predictions about the future. Be specific and grounded, not generic.",
  "",
  "CONFIDENCE:",
  "Give a confidence level and explain your reasoning. Never fabricate exact dates as certainty; frame probabilities honestly.",
].join("\n");

export async function getAIResponse(
  prompt: string,
  context?: string,
  systemPrompt?: string,
): Promise<AIResponse> {
  const baseSystem =
    systemPrompt || "You are a helpful assistant for wellness and astrology.";
  const seekerLang = detectLanguage(prompt);
  const userContent = context
    ? `SEEKER CONTEXT (analyse this before answering):\n${context}\n\n${prompt}`
    : prompt;
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `${ZEAL_CONSULTANT_DIRECTIVE}\n\n${baseSystem}`,
    },
    {
      role: "system",
      content: `TURN LANGUAGE: ${languageDirective(seekerLang)}`,
    },
    {
      role: "user",
      content: userContent,
    },
  ];

  // 15-second hard timeout via AbortController
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OUTER_TIMEOUT_MS);

  try {
    const content = await callAIJson({
      messages,
      temperature: 0.7,
      maxTokens: 500,
      signal: ctrl.signal,
    });

    return AI_RESPONSE_SCHEMA.parse({
      content,
      confidence: 0.85,
    });
  } catch (error) {
    if (error instanceof AIUnavailableError) {
      console.warn(
        `[ai-chat] engine unavailable: ${error.internalReason}`,
      );
    } else {
      console.error("[ai-chat] AI request failed:", error);
    }
    return getFallbackResponse(prompt);
  } finally {
    clearTimeout(timer);
  }
}

function getFallbackResponse(prompt: string): AIResponse {
  const fallbacks: string[] = [
    "Thank you for your question. I'm here to help guide you on your journey.",
    "That's a thoughtful question. Let me reflect on that for you.",
    "I appreciate your openness. Here's what I sense about your situation.",
    "I can feel the depth of your inquiry. Let me offer some perspective.",
  ];
  const content = fallbacks[Math.floor(Math.random() * fallbacks.length)] ?? "I'm here to help. Please try again.";
  return { content, confidence: 0.6 };
}

export async function getTarotReading(question?: string): Promise<string> {
  const prompt = question ? `Provide a tarot reading for this question: ${question}` : "Provide a general 3-card tarot reading.";
  const response = await getAIResponse(prompt, "", "You are an expert tarot reader.");
  return response.content;
}
