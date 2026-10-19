// apps/web/lib/admin/rate-limit/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN rate limiter — availability-first.
// ─────────────────────────────────────────────────────────────────────────────
// Used exclusively by the admin login action. The portal itself is protected by
// a real password check + DB-authoritative role + forced credential rotation, so
// this limiter is defence-in-depth against hammering — NOT the primary gate.
//
// Policy: fail OPEN whenever the Postgres `check_rate_limit` backend is
// unavailable (missing RPC, network blip, cold DB). An infrastructure problem
// must never lock the operator out of their own admin console. Dev uses an
// in-memory Map; prod prefers the shared RPC and silently degrades to in-memory
// on error rather than blocking.
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

  // No client configured → degrade to in-memory (never block an admin).
  if (!sb || allowBypass) return checkLimitMemory(c, id);

  try {
    const { data, error } = await (sb as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("check_rate_limit", {
      p_key: `zeal:rl:${c.prefix}:${id}`,
      p_limit: c.tokens,
      p_window_sec: c.windowSeconds,
    });

    // RPC missing / errored → fail OPEN via in-memory so a backend problem
    // (e.g. migration 093 not applied) can never lock the operator out.
    if (error || !data) return checkLimitMemory(c, id);

    return data as RateLimitResult;
  } catch {
    return checkLimitMemory(c, id);
  }
}

function createLimiter(tokens: number, windowSeconds: number, prefix: string) {
  const c: LimiterConfig = { tokens, windowSeconds, prefix };
  return { limit: (id: string) => checkLimit(c, id) };
}

// ─── Public limiters ────────────────────────────────────────────────────────
// Generous windows: a legitimate operator signing in, rotating a credential,
// or recovering should never trip these. They exist to blunt automated hammering.
export const generalLimiter   = createLimiter(300, 60, "general");
export const authLimiter      = createLimiter(50,  60, "auth");
// Dedicated admin-login bucket (own prefix → never shared with seeker logins).
export const adminAuthLimiter = createLimiter(50, 60, "admin-auth");
export const aiRateLimiter    = createLimiter(200, 60, "ai");
export const aiStrictLimiter  = createLimiter(100, 60, "ai-strict");
export const billingLimiter   = createLimiter(120, 60, "billing");
export const adminLimiter     = createLimiter(600, 60, "admin");

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
