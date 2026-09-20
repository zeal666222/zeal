// apps/web/lib/rate-limit/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Rate limiter — Postgres RPC in prod, in-memory in dev.
// ─────────────────────────────────────────────────────────────────────────────
// Production uses `check_rate_limit` Postgres RPC (migration 093). This scales
// horizontally — the rate limit state lives in a shared table, not per-instance.
//
// Dev uses an in-memory Map, which is fine because dev is single-instance.
//
// Fallback policy: fail-open in dev, fail-closed in prod. If the RPC is
// unreachable in prod, requests are BLOCKED. This is the safe default for a
// financial platform.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  count: number;
}

export interface RateLimitCheck {
  ok: boolean;
  headers: Record<string, string>;
  retryAfter?: number;
}

interface LimiterConfig {
  tokens: number;
  windowSeconds: number;
  prefix: string;
}

// ─── In-memory fallback (dev only) ──────────────────────────────────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkLimitMemory(c: LimiterConfig, id: string): RateLimitResult {
  const key = `${c.prefix}:${id}`;
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + c.windowSeconds * 1000 });
    return { success: true, limit: c.tokens, remaining: c.tokens - 1, reset: now + c.windowSeconds * 1000, count: 1 };
  }

  entry.count += 1;
  return {
    success: entry.count <= c.tokens,
    limit: c.tokens,
    remaining: Math.max(0, c.tokens - entry.count),
    reset: entry.resetAt,
    count: entry.count,
  };
}

async function checkLimit(c: LimiterConfig, id: string): Promise<RateLimitResult> {
  const sb = getClient();
  const allowBypass = process.env.ALLOW_RATE_LIMIT_BYPASS === "true";
  const isProd = process.env.NODE_ENV === "production";

  if (!sb) {
    if (!isProd || allowBypass) return checkLimitMemory(c, id);
    // Prod + no client = fail closed
    return {
      success: false, limit: c.tokens, remaining: 0,
      reset: Date.now() + c.windowSeconds * 1000, count: c.tokens,
    };
  }

  try {
    const { data, error } = await (sb as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("check_rate_limit", {
      p_key: `zeal:rl:${c.prefix}:${id}`,
      p_limit: c.tokens,
      p_window_sec: c.windowSeconds,
    });

    if (error || !data) {
      // Fail open in dev, closed in prod
      if (!isProd || allowBypass) return checkLimitMemory(c, id);
      return {
        success: false, limit: c.tokens, remaining: 0,
        reset: Date.now() + c.windowSeconds * 1000, count: c.tokens,
      };
    }

    return data as RateLimitResult;
  } catch {
    if (!isProd || allowBypass) return checkLimitMemory(c, id);
    return {
      success: false, limit: c.tokens, remaining: 0,
      reset: Date.now() + c.windowSeconds * 1000, count: c.tokens,
    };
  }
}

function createLimiter(tokens: number, windowSeconds: number, prefix: string) {
  const c: LimiterConfig = { tokens, windowSeconds, prefix };
  return { limit: (id: string) => checkLimit(c, id) };
}

// ─── Public limiters ────────────────────────────────────────────────────────
export const generalLimiter   = createLimiter(60, 60, "general");
export const authLimiter      = createLimiter(5,  60, "auth");
export const aiRateLimiter    = createLimiter(10, 60, "ai");
export const aiStrictLimiter  = createLimiter(3,  60, "ai-strict");
export const billingLimiter   = createLimiter(30, 60, "billing");
export const adminLimiter     = createLimiter(120, 60, "admin");

export async function checkRateLimit(
  limiter: { limit: (id: string) => Promise<RateLimitResult> },
  id: string,
): Promise<RateLimitCheck> {
  const r = await limiter.limit(id);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit":     String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset":     String(r.reset),
  };
  if (!r.success) {
    const ra = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
    return { ok: false, headers: { ...headers, "Retry-After": String(ra) }, retryAfter: ra };
  }
  return { ok: true, headers };
}
