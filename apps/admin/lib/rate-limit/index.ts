// apps/admin/lib/rate-limit/index.ts
// Postgres-backed rate limiter via check_rate_limit RPC.
// Fails open in dev, fails closed in prod (unless bypass env is set).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

export interface RateLimitResult {
  success: boolean; limit: number; remaining: number; reset: number; count: number;
}
export interface RateLimitCheck {
  ok: boolean; headers?: Record<string, string>; retryAfter?: number;
}
interface LimiterConfig { tokens: number; windowSeconds: number; prefix: string; }

async function checkLimit(c: LimiterConfig, id: string): Promise<RateLimitResult> {
  const sb = getClient();
  const allowBypass = process.env.ALLOW_RATE_LIMIT_BYPASS === "true";
  const failOpen = process.env.NODE_ENV !== "production" || allowBypass;

  const failed: RateLimitResult = failOpen
    ? { success: true,  limit: c.tokens, remaining: c.tokens, reset: Date.now() + c.windowSeconds * 1000, count: 0 }
    : { success: false, limit: c.tokens, remaining: 0,       reset: Date.now() + c.windowSeconds * 1000, count: c.tokens };

  if (!sb) return failed;
  try {
    const { data, error } = await (sb as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("check_rate_limit", {
      p_key: `zeal:rl:${c.prefix}:${id}`,
      p_limit: c.tokens,
      p_window_sec: c.windowSeconds,
    });
    if (error || !data) return failed;
    return data as RateLimitResult;
  } catch {
    return failed;
  }
}

function createLimiter(tokens: number, windowSeconds: number, prefix: string) {
  const c: LimiterConfig = { tokens, windowSeconds, prefix };
  return { limit: (id: string) => checkLimit(c, id) };
}

export const generalLimiter  = createLimiter(60, 60, "general");
export const authLimiter     = createLimiter(5,  60, "auth");
export const aiRateLimiter   = createLimiter(10, 60, "ai");
export const aiStrictLimiter = createLimiter(3,  60, "ai-strict");

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
