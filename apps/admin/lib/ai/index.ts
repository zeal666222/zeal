// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Unified AI Module
// ═══════════════════════════════════════════════════════════════════════════════
// Provider chain (in order):
//   1. Agnes AI      — agnes-2.5-flash       (30 RPM default · 1000 RPM Token Plan)
//   2. Groq Pro      — llama-3.3-70b-versatile (30 RPM · 12K TPM free tier)
//   3. Groq Fast     — llama-3.1-8b-instant   (30 RPM · 6K TPM free tier)
//
// Enterprise features:
//   • Per-provider concurrency gate (max 4 in-flight per provider)
//   • Circuit breaker (5 failures → 60s cooldown per provider)
//   • 30s AbortController timeout per request
//   • Retry-After honored on 429; exponential backoff with jitter on 5xx
//   • Prompt caching hint on system message (saves tokens + extends free tier)
//   • Human-facing errors only (AIUnavailableError)
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from "crypto";
import {redis} from "@/lib/cache";

// ─── Provider registry ────────────────────────────────────────────────────────
interface ProviderDef {
  readonly name: string;
  readonly url: string;
  readonly key: () => string | undefined;
  readonly model: string;
  readonly maxConcurrent: number;
}

const PROVIDERS = {
  agnes: {
    name: "agnes",
    url: "https://apihub.agnes-ai.com/v1/chat/completions",
    key: () => process.env.AGNES_API_KEY,
    model: "agnes-2.5-flash",
    maxConcurrent: 4,
  },
  groqPro: {
    name: "groq-pro",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    maxConcurrent: 4,
  },
  groqFast: {
    name: "groq-fast",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    maxConcurrent: 4,
  },
} as const satisfies Record<string, ProviderDef>;

export type ProviderName = keyof typeof PROVIDERS;

// ─── Public types ─────────────────────────────────────────────────────────────
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache_control?: { type: "ephemeral" };
}

export interface CallAIOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  preferProvider?: ProviderName;
  maxRetriesPerProvider?: number;
}

// ─── Concurrency gate ─────────────────────────────────────────────────────────
// Per-instance limiter. Vercel serverless instances are short-lived, so this
// mainly prevents a single burst from a single instance from overwhelming a
// provider. The real protection is 429 handling + circuit breaker below.
class ConcurrencyGate {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const gates: Record<ProviderName, ConcurrencyGate> = {
  agnes: new ConcurrencyGate(PROVIDERS.agnes.maxConcurrent),
  groqPro: new ConcurrencyGate(PROVIDERS.groqPro.maxConcurrent),
  groqFast: new ConcurrencyGate(PROVIDERS.groqFast.maxConcurrent),
};

// ─── Circuit breaker ──────────────────────────────────────────────────────────
// If a provider fails N times in quick succession, skip it for a cooldown.
// Prevents repeatedly hammering a provider that's clearly rate-limited.
class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number,
  ) {}

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.failures = 0;
      console.warn(`[ai] circuit breaker opened for ${this.cooldownMs}ms`);
    }
  }
}

const breakers: Record<ProviderName, CircuitBreaker> = {
  agnes: new CircuitBreaker(5, 60_000),
  groqPro: new CircuitBreaker(5, 60_000),
  groqFast: new CircuitBreaker(5, 60_000),
};

// ─── Human-facing error ───────────────────────────────────────────────────────
export class AIUnavailableError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly internalReason: string,
  ) {
    super(internalReason);
    this.name = "AIUnavailableError";
  }
}

const HUMAN_UNAVAILABLE =
  "I'm taking a brief pause to gather my thoughts. Please try again in a moment.";

// ─── Backoff ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number, base = 500): number {
  const cap = Math.min(base * Math.pow(2, attempt), 20_000);
  const jitter = cap * 0.3 * (Math.random() * 2 - 1);
  return Math.max(120, Math.round(cap + jitter));
}

// ─── Single provider call ─────────────────────────────────────────────────────
async function callProviderOnce(
  provider: ProviderDef,
  opts: CallAIOptions,
): Promise<Response> {
  const apiKey = provider.key();
  if (!apiKey) throw new Error(`missing API key for ${provider.name}`);

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1500,
  };
  if (opts.stream) body.stream = true;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);

  try {
    return await fetch(provider.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Fallback chain ───────────────────────────────────────────────────────────
const FALLBACK_CHAIN: ProviderName[] = ["agnes", "groqPro", "groqFast"];

export async function callAI(opts: CallAIOptions): Promise<Response> {
  const chain: ProviderName[] = opts.preferProvider
    ? [opts.preferProvider, ...FALLBACK_CHAIN.filter((p) => p !== opts.preferProvider)]
    : FALLBACK_CHAIN;

  const maxRetries = opts.maxRetriesPerProvider ?? 2;
  let lastInternal = "all providers failed";

  for (const key of chain) {
    const provider = PROVIDERS[key];
    const breaker = breakers[key];
    const gate = gates[key];

    if (breaker.isOpen()) {
      console.warn(`[ai] ${provider.name} skipped (circuit open)`);
      lastInternal = `${provider.name} circuit open`;
      continue;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await gate.acquire();
      try {
        const res = await callProviderOnce(provider, opts);

        if (res.ok) {
          breaker.recordSuccess();
          return res;
        }

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after")) || 0;
          const delay = retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
          console.warn(`[ai] ${provider.name} 429 — retry in ${delay}ms`);
          breaker.recordFailure();
          if (attempt < maxRetries) {
            await sleep(delay);
            continue;
          }
          lastInternal = `${provider.name} rate limited`;
          break;
        }

        if (res.status >= 500) {
          breaker.recordFailure();
          if (attempt < maxRetries) {
            await sleep(backoffMs(attempt));
            continue;
          }
          lastInternal = `${provider.name} ${res.status}`;
          break;
        }

        // 4xx other than 429 — not retryable, try next provider
        const text = await res.text().catch(() => "");
        lastInternal = `${provider.name} ${res.status}: ${text.slice(0, 120)}`;
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        breaker.recordFailure();
        if (msg.includes("aborted") || msg.includes("abort")) {
          lastInternal = `${provider.name} timeout`;
        } else {
          lastInternal = `${provider.name}: ${msg.slice(0, 120)}`;
        }
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
      } finally {
        gate.release();
      }
    }
  }

  console.error("[ai] all providers failed:", lastInternal);
  throw new AIUnavailableError(HUMAN_UNAVAILABLE, lastInternal);
}

// ─── Text-only helper ─────────────────────────────────────────────────────────
export async function callAIJson(opts: CallAIOptions): Promise<string> {
  const res = await callAI({ ...opts, stream: false });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AIUnavailableError(HUMAN_UNAVAILABLE, "empty response");
  }
  return content as string;
}

// ─── Response cache ───────────────────────────────────────────────────────────
export async function withAICache<T>(
  namespace: string,
  payload: unknown,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
  const key = `zeal:ai:${namespace}:${hash}`;

  try {
    const hit = await redis.get<string>(key);
    if (hit) return { value: JSON.parse(hit) as T, cached: true };
  } catch { /* cache miss */ }

  const value = await producer();
  try { await redis.set(key, JSON.stringify(value), { ex: ttlSeconds }); } catch { /* ignore */ }
  return { value, cached: false };
}
