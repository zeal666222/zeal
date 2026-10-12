// ═══════════════════════════════════════════════════════════════════════════════
// Fallback: Astrology — cached/simplified chart when astro-worker is slow
// ═══════════════════════════════════════════════════════════════════════════════
// If the astro-worker Cloudflare Worker takes longer than the timeout (5s),
// we return a cached result (if available) or a simplified rule-based chart.
// This ensures the user always gets a response, even if the full computation
// is unavailable.
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AstrologyFallbackResult {
  interpretation: {
    overview: string;
    career?: string;
    relationships?: string;
    dasha?: string;
    remedies?: string;
    chartSummary?: string;
  };
  chart: Record<string, unknown>;
  ruleBasedInterpretations: Array<{
    planet: string;
    house: number;
    sign: string;
    interpretation: string;
  }>;
  fallback: boolean;
  source: "cache" | "simplified" | "error";
}

interface CacheEntry {
  result: AstrologyFallbackResult;
  createdAt: number;
  key: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 500;
const cache = new Map<string, CacheEntry>();

function getCacheKey(params: {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  chartType: string;
}): string {
  return `astro:${params.birthDate}:${params.birthTime}:${params.birthPlace}:${params.chartType}`;
}

function getCached(key: string): AstrologyFallbackResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > DEFAULT_CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: AstrologyFallbackResult): void {
  // Evict oldest if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result, createdAt: Date.now(), key });
}

// ─── Simplified Chart Generator ───────────────────────────────────────────────

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

function generateSimplifiedChart(params: {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
}): AstrologyFallbackResult {
  // Deterministic "random" based on birth data hash
  const seed = hashString(`${params.birthDate}:${params.birthTime}`);

  const moonSign = SIGNS[seed % 12];
  const sunSign = SIGNS[(seed + 3) % 12];
  const ascendant = SIGNS[(seed + 7) % 12];

  const ruleBasedInterpretations = PLANETS.map((planet, i) => ({
    planet,
    house: ((seed + i * 3) % 12) + 1,
    sign: SIGNS[(seed + i * 5) % 12] ?? "Aries",
    interpretation: `${planet} in house ${((seed + i * 3) % 12) + 1} suggests focus on ${
      ["self", "wealth", "communication", "home", "creativity", "health", "partnerships", "transformation", "philosophy", "career", "friendships", "spirituality"][((seed + i * 3) % 12)]
    } areas of life.`,
  }));

  return {
    interpretation: {
      overview: `With Moon in ${moonSign} and Sun in ${sunSign}, you have a balanced approach to emotions and identity. Your ascendant in ${ascendant} shapes how others perceive you.`,
      career: "Your chart suggests strengths in analytical and creative pursuits. Periods of expansion come when Jupiter transits your 10th house.",
      relationships: `Moon in ${moonSign} indicates ${
        ["independence", "stability", "curiosity", "nurturing", "passion", "practicality", "harmony", "intensity", "adventure", "ambition", "uniqueness", "compassion"][seed % 12]
      } in relationships.`,
      remedies: "Chanting the Gayatri mantra during sunrise can strengthen your Sun. Wearing a yellow sapphire on your index finger may enhance Jupiter's beneficial influence.",
      chartSummary: `Ascendant: ${ascendant} | Moon: ${moonSign} | Sun: ${sunSign}`,
    },
    chart: {
      ascendant,
      moonSign,
      sunSign,
      planets: ruleBasedInterpretations.map((r) => ({
        name: r.planet,
        house: r.house,
        sign: r.sign,
      })),
    },
    ruleBasedInterpretations,
    fallback: true,
    source: "simplified",
  };
}

// ─── Main Fallback Function ───────────────────────────────────────────────────

/**
 * Execute an astrology computation with fallback.
 *
 * @param computeFn - The real computation function
 * @param params - Birth data parameters
 * @param timeoutMs - Max time to wait (default 5000ms)
 */
export async function withAstrologyFallback<T>(
  computeFn: () => Promise<T>,
  params: {
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    chartType?: string;
  },
  timeoutMs = 5000,
): Promise<T | AstrologyFallbackResult> {
  const cacheKey = getCacheKey({
    birthDate: params.birthDate,
    birthTime: params.birthTime,
    birthPlace: params.birthPlace,
    chartType: params.chartType ?? "vedic",
  });

  // 1. Try the real computation with a timeout
  try {
    const result = await Promise.race([
      computeFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AstrologyTimeoutError(timeoutMs)), timeoutMs),
      ),
    ]);

    // Cache the successful result
    setCache(cacheKey, result as unknown as AstrologyFallbackResult);
    return result;
  } catch (err) {
    const isTimeout = err instanceof AstrologyTimeoutError;

    logger.warn("astrology", "fallback_triggered", isTimeout
      ? `Astro computation timed out after ${timeoutMs}ms`
      : `Astro computation failed: ${err instanceof Error ? err.message : String(err)}`,
    );

    // 2. Try cached result
    const cached = getCached(cacheKey);
    if (cached) {
      logger.info("astrology", "fallback_cache", "Returning cached astrology result");
      return cached;
    }

    // 3. Generate simplified chart
    logger.info("astrology", "fallback_simplified", "Generating simplified astrology chart");
    return generateSimplifiedChart(params);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class AstrologyTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Astrology computation timed out after ${timeoutMs}ms`);
    this.name = "AstrologyTimeoutError";
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
