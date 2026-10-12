// ═══════════════════════════════════════════════════════════════════════════════
// Fallback: AI — placeholder response when LLM is slow
// ═══════════════════════════════════════════════════════════════════════════════
// If the LLM takes longer than the timeout (10s), we return a placeholder
// response that acknowledges the delay and provides a generic supportive
// message. The real response can be streamed later if it arrives.
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIFallbackResponse {
  content: string;
  confidence: number;
  fallback: boolean;
  source: "placeholder" | "cached" | "template";
}

interface CacheEntry {
  response: AIFallbackResponse;
  createdAt: number;
  key: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE = 200;
const cache = new Map<string, CacheEntry>();

function getCacheKey(consultantId: string, content: string): string {
  // Hash the content to keep keys short
  const hash = simpleHash(content.slice(0, 200));
  return `ai:${consultantId}:${hash}`;
}

function getCached(key: string): AIFallbackResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.response;
}

function setCache(key: string, response: AIFallbackResponse): void {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { response, createdAt: Date.now(), key });
}

// ─── Placeholder Responses ────────────────────────────────────────────────────

const PLACEHOLDER_RESPONSES = [
  "I'm thinking about that carefully. Give me just a moment to formulate a thoughtful response for you.",
  "That's a wonderful question. Let me consider the best way to guide you on this.",
  "I hear you. I'm putting together some insights for you — thank you for your patience.",
  "Great question! I want to give you the most helpful answer, so bear with me for a moment.",
  "I appreciate you sharing that. Let me gather my thoughts on the best guidance for you.",
];

const TEMPLATE_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hello! I'm here to help you. What's on your mind today?",
    "Welcome! I'd love to hear what you'd like guidance on.",
  ],
  career: [
    "Career questions often require looking at both your strengths and the current planetary transits. Could you tell me more about what specific area of your career you'd like to explore?",
  ],
  relationship: [
    "Relationships are deeply connected to our Moon and Venus placements. I'd love to explore this with you — could you share a bit more about your situation?",
  ],
  general: [
    "I'm here to help guide you. Every question is important, and I want to make sure I give you the most relevant insights. Could you tell me a bit more?",
  ],
};

// ─── Main Fallback Function ───────────────────────────────────────────────────

/**
 * Execute an AI call with fallback.
 *
 * @param callFn - The real AI call function
 * @param consultantId - The AI consultant ID
 * @param userMessage - The user's message (for context-aware fallback)
 * @param timeoutMs - Max time to wait (default 10000ms)
 */
export async function withAIFallback<T extends { content: string }>(
  callFn: () => Promise<T>,
  consultantId: string,
  userMessage: string,
  timeoutMs = 10000,
): Promise<T | AIFallbackResponse> {
  const cacheKey = getCacheKey(consultantId, userMessage);

  try {
    const result = await Promise.race([
      callFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AITimeoutError(timeoutMs)), timeoutMs),
      ),
    ]);

    // Cache successful response
    setCache(cacheKey, {
      content: result.content,
      confidence: 0.9,
      fallback: false,
      source: "cached",
    });

    return result;
  } catch (err) {
    const isTimeout = err instanceof AITimeoutError;

    logger.warn("ai", "fallback_triggered", isTimeout
      ? `AI call timed out after ${timeoutMs}ms`
      : `AI call failed: ${err instanceof Error ? err.message : String(err)}`,
      { consultantId },
    );

    // 1. Try cached response for similar query
    const cached = getCached(cacheKey);
    if (cached) {
      logger.info("ai", "fallback_cache", "Returning cached AI response", { consultantId });
      return cached;
    }

    // 2. Generate context-aware placeholder
    const response = generatePlaceholder(userMessage);
    logger.info("ai", "fallback_placeholder", "Returning placeholder AI response", { consultantId });
    return response;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generatePlaceholder(userMessage: string): AIFallbackResponse {
  const lower = userMessage.toLowerCase();

  // Detect intent for context-aware response
  let category = "general";
  if (/^(hi|hello|hey|namaste|good morning|good evening)/i.test(lower)) {
    category = "greeting";
  } else if (/\b(career|job|work|profession|business|money)\b/i.test(lower)) {
    category = "career";
  } else if (/\b(love|relationship|partner|marriage|husband|wife|boyfriend|girlfriend)\b/i.test(lower)) {
    category = "relationship";
  }

  const fallbackArr = TEMPLATE_RESPONSES[category] ?? TEMPLATE_RESPONSES.general ?? [];
  const idx = Math.floor(Math.random() * Math.max(fallbackArr.length, 1));
  const content = fallbackArr[idx] ?? "Thank you for your message. I'll respond shortly.";

  return {
    content: content ?? "Thank you for your message. I'll respond shortly.",
    confidence: 0.3,
    fallback: true,
    source: "template",
  };
}

class AITimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`AI call timed out after ${timeoutMs}ms`);
    this.name = "AITimeoutError";
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
