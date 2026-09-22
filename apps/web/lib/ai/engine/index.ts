// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — Main Router
// ═══════════════════════════════════════════════════════════════════════════════
// Single entry point: `callAI(opts)`.
//
// Pipeline per request:
//   1. Build provider chain (preferProvider first, then by weight)
//   2. For each provider:
//      a. Skip if circuit breaker is open
//      b. Acquire ConcurrencyGate slot
//      c. Check TokenBucket (RPM + TPM)
//      d. Fire request with 30s AbortController
//      e. On 200 → record success, return Response
//      f. On 429 → honour Retry-After, backoff, retry (max 3)
//      g. On 5xx → backoff with jitter, retry (max 2)
//      h. On 4xx other → skip provider
//   3. If all providers fail → throw AIUnavailableError
// ═══════════════════════════════════════════════════════════════════════════════

import { getGate } from "./concurrency-gate";
import { getLimiter } from "./token-bucket";
import { getBreaker } from "./circuit-breaker";
import type {
  AIMessage,
  CallAIOptions,
  EngineEvent,
  EngineEventHandler,
  ProviderDef,
  ProviderName,
} from "./types";

// ─── Provider registry ────────────────────────────────────────────────────────
//
// Rates reflect Groq free-tier defaults (30 RPM / 12K TPM for 70b, 30 RPM /
// 6K TPM for 8b). Agnes uses the 1000 RPM Token Plan tier. Adjust via env
// when you upgrade tiers.
//
const PROVIDERS: Record<ProviderName, ProviderDef> = {
  groqPro: {
    name: "groqPro",
    label: "Groq 70B",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    maxConcurrent: 4,
    rpm: 30,
    tpm: 12_000,
    weight: 90,
  },
  agnes: {
    name: "agnes",
    label: "Agnes 2.5 Flash",
    url: "https://apihub.agnes-ai.com/v1/chat/completions",
    key: () => process.env.AGNES_API_KEY,
    model: "agnes-2.5-flash",
    maxConcurrent: 6,
    rpm: 100,
    tpm: 40_000,
    weight: 100,
  },
  groqFast: {
    name: "groqFast",
    label: "Groq 8B",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    maxConcurrent: 6,
    rpm: 30,
    tpm: 6_000,
    weight: 50,
  },
  zhipu: {
    name: "zhipu",
    label: "Zhipu GLM",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    key: () => process.env.ZHIPU_API_KEY,
    model: "glm-4-flash",
    maxConcurrent: 4,
    rpm: 60,
    tpm: 20_000,
    weight: 60,
  },
};

const FALLBACK_CHAIN: ProviderName[] = ["agnes", "groqPro", "groqFast", "zhipu"];

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
  "I'm taking a brief pause — give me a moment and try again.";

// ─── Backoff ──────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number, base = 500, cap = 16_000): number {
  const exp = Math.min(base * Math.pow(2, attempt), cap);
  const jitter = exp * 0.3 * (Math.random() * 2 - 1);
  return Math.max(150, Math.round(exp + jitter));
}

// ─── Single provider attempt ──────────────────────────────────────────────────
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
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.stream) body.stream = true;

  // 30s hard timeout per attempt
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);

  // Honour the caller's abort signal
  if (opts.signal) {
    if (opts.signal.aborted) {
      clearTimeout(timer);
      throw new Error("aborted by caller");
    }
    opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

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

// ─── Public API ───────────────────────────────────────────────────────────────
export interface CallAIResult {
  response: Response;
  provider: ProviderName;
  attempts: Array<{ provider: ProviderName; reason: string }>;
}

export async function callAI(
  opts: CallAIOptions & { onEvent?: EngineEventHandler },
): Promise<CallAIResult> {
  const emit = opts.onEvent ?? (() => {});
  const requestId = opts.requestId ?? `req-${Date.now().toString(36)}`;
  const maxRetries = opts.maxRetriesPerProvider ?? 3;

  // Build provider chain: preferred first, then remaining by weight desc
  const chain: ProviderName[] = opts.preferProvider
    ? [
        opts.preferProvider,
        ...FALLBACK_CHAIN.filter((p) => p !== opts.preferProvider),
      ]
    : [...FALLBACK_CHAIN].sort(
        (a, b) => PROVIDERS[b].weight - PROVIDERS[a].weight,
      );

  const attempts: Array<{ provider: ProviderName; reason: string }> = [];
  let lastInternal = "all providers failed";

  for (const key of chain) {
    const provider = PROVIDERS[key];
    const breaker = getBreaker(key);
    const gate = getGate(key, provider.maxConcurrent);
    const limiter = getLimiter(key, provider.rpm, provider.tpm);

    // ─── Skip if circuit is open ────────────────────────────────────────
    if (!breaker.isAvailable()) {
      const h = breaker.health();
      emit({
        type: "provider:circuit-open",
        provider: key,
        cooldownMs: 30_000,
      });
      lastInternal = `${provider.label}: circuit open (${h.state})`;
      attempts.push({ provider: key, reason: "circuit-open" });
      continue;
    }

    // ─── Token bucket check (non-blocking) ──────────────────────────────
    const limit = limiter.check(
      opts.messages,
      opts.maxTokens ?? 1200,
    );
    if (!limit.ok) {
      emit({
        type: "provider:fail",
        provider: key,
        reason: `rate-limited:${limit.reason}`,
      });
      attempts.push({
        provider: key,
        reason: `rate-limited:${limit.reason}:wait=${limit.waitMs}ms`,
      });
      // If we have time budget, wait then continue to next provider
      // (we don't wait here — we fall through to the next provider)
      lastInternal = `${provider.label}: ${limit.reason} exhausted`;
      continue;
    }

    // ─── Retry loop ────────────────────────────────────────────────────
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Acquire concurrency slot (blocks if all in use)
      let release: (() => void) | null = null;
      try {
        release = await gate.acquire();
      } catch (e) {
        attempts.push({
          provider: key,
          reason: `gate-timeout`,
        });
        lastInternal = `${provider.label}: concurrency gate timeout`;
        break;
      }

      emit({ type: "provider:attempt", provider: key, attempt });

      const start = Date.now();
      try {
        const res = await callProviderOnce(provider, opts);
        const latency = Date.now() - start;

        if (res.ok) {
          breaker.recordSuccess(latency);
          emit({
            type: "provider:success",
            provider: key,
            latencyMs: latency,
          });
          return { response: res, provider: key, attempts };
        }

        // ─── 429: honour Retry-After ───────────────────────────────────
        if (res.status === 429) {
          const retryAfterSec = Number(res.headers.get("retry-after") ?? "0");
          const delay = retryAfterSec > 0
            ? retryAfterSec * 1000
            : backoffMs(attempt, 500, 16_000);

          breaker.recordFailure();
          limiter.refund();

          emit({
            type: "provider:fail",
            provider: key,
            reason: "429",
            status: 429,
          });

          if (attempt < maxRetries) {
            emit({
              type: "provider:retry",
              provider: key,
              attempt: attempt + 1,
              delayMs: delay,
            });
            await sleep(delay);
            continue;
          }
          lastInternal = `${provider.label}: 429 after ${maxRetries} retries`;
          attempts.push({ provider: key, reason: "429-exhausted" });
          break;
        }

        // ─── 5xx: exponential backoff ──────────────────────────────────
        if (res.status >= 500) {
          breaker.recordFailure();
          limiter.refund();
          emit({
            type: "provider:fail",
            provider: key,
            reason: `http-${res.status}`,
            status: res.status,
          });

          if (attempt < maxRetries) {
            const delay = backoffMs(attempt, 500, 16_000);
            emit({
              type: "provider:retry",
              provider: key,
              attempt: attempt + 1,
              delayMs: delay,
            });
            await sleep(delay);
            continue;
          }
          lastInternal = `${provider.label}: ${res.status} after retries`;
          attempts.push({ provider: key, reason: `http-${res.status}` });
          break;
        }

        // ─── Other 4xx: not retryable on this provider ─────────────────
        const text = await res.text().catch(() => "");
        breaker.recordFailure();
        limiter.refund();
        emit({
          type: "provider:fail",
          provider: key,
          reason: `http-${res.status}`,
          status: res.status,
        });
        lastInternal = `${provider.label}: ${res.status} — ${text.slice(0, 120)}`;
        attempts.push({ provider: key, reason: `http-${res.status}` });
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        breaker.recordFailure();
        limiter.refund();

        const isTimeout = /abort|timeout/i.test(msg);
        emit({
          type: "provider:fail",
          provider: key,
          reason: isTimeout ? "timeout" : msg.slice(0, 80),
        });

        if (attempt < maxRetries) {
          const delay = backoffMs(attempt, 500, 16_000);
          emit({
            type: "provider:retry",
            provider: key,
            attempt: attempt + 1,
            delayMs: delay,
          });
          await sleep(delay);
          continue;
        }
        lastInternal = `${provider.label}: ${isTimeout ? "timeout" : msg.slice(0, 80)}`;
        attempts.push({
          provider: key,
          reason: isTimeout ? "timeout" : "network",
        });
      } finally {
        if (release) release();
      }
    }
  }

  console.error("[ai-engine] all providers failed:", lastInternal, { requestId });
  throw new AIUnavailableError(HUMAN_UNAVAILABLE, lastInternal);
}

// ─── Text-only helper ─────────────────────────────────────────────────────────
export async function callAIJson(
  opts: CallAIOptions & { onEvent?: EngineEventHandler },
): Promise<string> {
  const { response } = await callAI({ ...opts, stream: false });
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AIUnavailableError(HUMAN_UNAVAILABLE, "empty response");
  }
  return content as string;
}

// ─── Observability ────────────────────────────────────────────────────────────
export { allGateStats } from "./concurrency-gate";
export { allLimiterSnapshots } from "./token-bucket";
export { allBreakerHealth, resetAllBreakers } from "./circuit-breaker";
export type { AIMessage, CallAIOptions, EngineEvent, EngineEventHandler } from "./types";
