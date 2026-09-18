// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Rate Limiting (Upstash Redis, fail-closed)
// ─────────────────────────────────────────────────────────────────────────────
// Design:
//   • Rate-limit by user ID (not IP) for authenticated routes
//   • Sliding window for fairness
//   • Tiered limits: anonymous < user < premium
//   • PRODUCTION: hard-fails at boot if Redis isn't configured
//   • DEVELOPMENT: no-op fallback so local work isn't blocked
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const HAS_REDIS_ENV =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// ─── Boot guard: never ship to prod without rate limiting ────────────────────
if (IS_PRODUCTION && !HAS_REDIS_ENV) {
  throw new Error(
    "[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production",
  );
}

let redis: Redis | null = null;
if (HAS_REDIS_ENV) {
  try {
    redis = Redis.fromEnv();
  } catch (err) {
    console.error("[rate-limit] Failed to initialize Redis:", err);
    if (IS_PRODUCTION) throw err;
  }
} else {
  console.warn("[rate-limit] Redis env missing — rate limiting disabled (non-production only)");
}

// ─── Fallback result shape (used in dev when Redis is absent) ────────────────
interface LimiterResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const ALLOW_ALL: LimiterResult = {
  success: true,
  limit: 0,
  remaining: 0,
  reset: Date.now(),
};

// ─── Factory ─────────────────────────────────────────────────────────────────
function createLimiter(tokens: number, window: `${number} ${"s" | "m" | "h" | "d"}`, prefix: string) {
  if (!redis) {
    return { limit: async (_id: string): Promise<LimiterResult> => ALLOW_ALL };
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: `@zeal/${prefix}`,
  });
}

// ─── Pre-configured limiters ─────────────────────────────────────────────────
export const generalLimiter = createLimiter(60, "1 m", "general");
export const authLimiter    = createLimiter(5,  "1 m", "auth");
export const aiRateLimiter  = createLimiter(10, "1 m", "ai");
export const aiStrictLimiter = createLimiter(3, "1 m", "ai-strict");
export const aiTokenBudget  = createLimiter(20_000, "1 h", "ai-budget");

// ─── Helper ──────────────────────────────────────────────────────────────────
export interface RateLimitCheck {
  ok: boolean;
  headers?: Record<string, string>;
  retryAfter?: number;
}

export async function checkRateLimit(
  limiter: { limit: (id: string) => Promise<LimiterResult> },
  identifier: string,
): Promise<RateLimitCheck> {
  // Fail-open in dev, fail-closed in prod when Redis throws
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    const headers = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
    };
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return {
        ok: false,
        headers: { ...headers, "Retry-After": String(retryAfter) },
        retryAfter,
      };
    }
    return { ok: true, headers };
  } catch (err) {
    console.error("[rate-limit] check failed:", err);
    if (IS_PRODUCTION) {
      // Fail-closed: refuse the request rather than silently allowing it
      return { ok: false, retryAfter: 30 };
    }
    return { ok: true };
  }
}

// ─── Legacy compat ───────────────────────────────────────────────────────────
export const enforceRateLimit = async (identifier?: unknown) => {
  const id = typeof identifier === "string" ? identifier : "anonymous";
  return generalLimiter.limit(id);
};
