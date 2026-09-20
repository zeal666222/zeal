// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Unified AI Module (multi-provider, streaming-safe, human errors)
// ═══════════════════════════════════════════════════════════════════════════════
// Provider chain (in order):
//   1. Agnes AI     — agnes-2.5-flash  (free tier, generous concurrency)
//   2. Groq Pro     — llama-3.3-70b-versatile (best reasoning)
//   3. Groq Fast    — llama-3.1-8b-instant (fastest fallback)
//
// Guarantees:
//   • Never throws raw provider text to the caller
//   • 30s per-request timeout via AbortController
//   • Honors Retry-After on 429, exponential backoff with jitter on 5xx
//   • Streaming and non-streaming modes
//   • Response cache for expensive/idempotent tasks (SHA-256 keyed)
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from "crypto";
import {redis} from "@/lib/cache";

// ─── Provider registry ────────────────────────────────────────────────────────
interface ProviderDef {
  readonly name: string;
  readonly url: string;
  readonly key: () => string | undefined;
  readonly model: string;
  readonly free: boolean;
}

const PROVIDERS = {
  agnes: {
    name: "agnes",
    url: "https://apihub.agnes-ai.com/v1/chat/completions",
    key: () => process.env.AGNES_API_KEY,
    model: "agnes-2.5-flash",
    free: true,
  },
  groqPro: {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    free: true,
  },
  groqFast: {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    free: true,
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

// ─── Human-facing error ───────────────────────────────────────────────────────
// Every error class exposed to the client carries a warm, human message.
// Provider text is only logged server-side.
export class AIUnavailableError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly internalReason: string,
  ) {
    super(internalReason);
    this.name = "AIUnavailableError";
  }
}

// ─── Backoff helpers ──────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number, base = 500): number {
  const cap = Math.min(base * Math.pow(2, attempt), 20_000);
  const jitter = cap * 0.3 * (Math.random() * 2 - 1);
  return Math.max(120, Math.round(cap + jitter));
}

// ─── Single provider call ─────────────────────────────────────────────────────
async function callProvider(
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

  // 30s hard timeout — prevents indefinite hangs on slow providers
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

const HUMAN_UNAVAILABLE =
  "I'm taking a brief pause to gather my thoughts. Please try again in a moment.";

export async function callAI(opts: CallAIOptions): Promise<Response> {
  const chain: ProviderName[] = opts.preferProvider
    ? [opts.preferProvider, ...FALLBACK_CHAIN.filter((p) => p !== opts.preferProvider)]
    : FALLBACK_CHAIN;

  const maxRetries = opts.maxRetriesPerProvider ?? 2;
  let lastInternal = "all providers failed";

  for (const name of chain) {
    const provider = PROVIDERS[name];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await callProvider(provider, opts);
        if (res.ok) return res;

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after")) || 0;
          const delay = retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
          console.warn(`[ai] ${name} 429 — waiting ${delay}ms`);
          if (attempt < maxRetries) { await sleep(delay); continue; }
          lastInternal = `${name} rate limited`;
          break;
        }

        if (res.status >= 500) {
          if (attempt < maxRetries) { await sleep(backoffMs(attempt)); continue; }
          lastInternal = `${name} ${res.status}`;
          break;
        }

        // 4xx (non-429) — not retryable, try next provider
        const text = await res.text().catch(() => "");
        lastInternal = `${name} ${res.status}: ${text.slice(0, 120)}`;
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("aborted")) lastInternal = `${name} timeout`;
        else lastInternal = `${name} ${msg.slice(0, 120)}`;

        if (attempt < maxRetries) { await sleep(backoffMs(attempt)); continue; }
      }
    }
  }

  // Never leak provider internals to the client
  console.error("[ai] all providers failed:", lastInternal);
  throw new AIUnavailableError(HUMAN_UNAVAILABLE, lastInternal);
}

// ─── Convenience: text-only response ──────────────────────────────────────────
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
  } catch { /* cache miss on error */ }

  const value = await producer();
  try { await redis.set(key, JSON.stringify(value), { ex: ttlSeconds }); } catch { /* ignore */ }
  return { value, cached: false };
}
