// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — Main Router (v3 — 100-concurrent scaling)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pipeline per request:
//   0. Dedup check — collapse identical requests within 5s window
//   1. Build provider chain — health-weighted sort (success rate × base weight)
//   2. For each provider:
//      a. Skip if circuit breaker is open
//      b. Acquire ConcurrencyGate slot
//      c. Check TokenBucket (RPM + TPM)
//      d. Fire request with 30s AbortController
//      e. On 200 → record success, return Response
//      f. On 429 → honour Retry-After, backoff, retry (max 2)
//      g. On 5xx → backoff with jitter, retry (max 2)
//      h. On 4xx other → skip provider
//   3. If all providers fail → throw AIUnavailableError
// ═══════════════════════════════════════════════════════════════════════════════

import { getGate } from "./concurrency-gate";
import { getLimiter } from "./token-bucket";
import { getBreaker } from "./circuit-breaker";
import {
  CF_AI_MODEL,
  workersAiChatUrl,
  workersAiKey,
} from "./cloudflare-workers-ai";
import {
  contentToText,
  hasStructuredContent,
} from "./types";
import { buildHardcodedJsonResponse, buildHardcodedStreamResponse } from "./hardcoded-oracle";
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
// Scaled for 100 concurrent users. Total slots: ~95.
// Keyless providers carry the bulk of free-tier traffic.
//
// __ZEAL_PROVIDERS_V3__
const ZHIPU_MODEL = process.env.ZHIPU_MODEL || "glm-4v-flash";

const PROVIDERS: Record<ProviderName, ProviderDef> = {
  // Local deterministic fallback — never goes into FALLBACK_CHAIN, used as
  // the last-resort response builder when all upstream providers fail.
  hardcoded: {
    name: "hardcoded", label: "Zeal Local Oracle",
    url: "local://hardcoded",
    key: () => null,
    model: "zeal-hardcoded-oracle",
    maxConcurrent: 1_000_000, rpm: 1_000_000, tpm: 1_000_000, weight: 0,
    keyless: true,
  },
  groqPro: {
    name: "groqPro", label: "Groq 70B",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    maxConcurrent: 50, rpm: 30, tpm: 14_000, weight: 100,
  },
  groqFast: {
    name: "groqFast", label: "Groq 8B",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    maxConcurrent: 60, rpm: 30, tpm: 6_000, weight: 80,
  },
  agnes: {
    name: "agnes", label: "Agnes 2.5 Flash",
    url: "https://apihub.agnes-ai.com/v1/chat/completions",
    key: () => process.env.AGNES_API_KEY,
    model: "agnes-2.5-flash",
    maxConcurrent: 15, rpm: 30, tpm: 32_000, weight: 70,
  },
  zhipu: {
    name: "zhipu", label: "Zhipu GLM",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    key: () => process.env.ZHIPU_API_KEY,
    model: ZHIPU_MODEL,
    maxConcurrent: 10, rpm: 30, tpm: 15_000, weight: 40,
    supportsVision: ZHIPU_MODEL.includes("4v"),
  },
  cloudflareAi: {
    name: "cloudflareAi", label: "CF Llama 3.3 70B",
    url: workersAiChatUrl(),
    key: workersAiKey,
    model: CF_AI_MODEL,
    maxConcurrent: 40, rpm: 30, tpm: 20_000, weight: 90,
    supportsVision: CF_AI_MODEL.includes("vision"),
  },
  ovh: {
    name: "ovh", label: "OVHcloud Qwen",
    url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
    key: () => null,
    model: "qwen3-32b",
    maxConcurrent: 12, rpm: 20, tpm: 20_000, weight: 30,
    keyless: true,
  },
  kilo: {
    name: "kilo", label: "Kilo Free",
    url: "https://api.kilo.ai/api/gateway",
    key: () => null,
    model: "kilo-auto/free",
    maxConcurrent: 12, rpm: 20, tpm: 20_000, weight: 25,
    keyless: true,
  },
  llm7: {
    name: "llm7", label: "LLM7 Free",
    url: "https://api.llm7.io/v1/chat/completions",
    key: () => null,
    model: "gpt-oss",
    maxConcurrent: 12, rpm: 25, tpm: 20_000, weight: 22,
    keyless: true,
  },
  duckduckgo: {
    name: "duckduckgo", label: "DuckDuckGo AI",
    url: "https://duckduckgo.com/duckchat/v1/chat",
    key: () => null,
    model: "gpt-4o-mini",
    maxConcurrent: 10, rpm: 15, tpm: 15_000, weight: 18,
    keyless: true,
    extraHeaders: () => ({
      "x-vqd-accept": "1",
      "Content-Type": "application/json",
    }),
  },
  freegpt: {
    name: "freegpt", label: "FreeGPT API",
    url: "https://api.freegpt4.cc/v1/chat/completions",
    key: () => null,
    model: "gpt-4",
    maxConcurrent: 10, rpm: 15, tpm: 15_000, weight: 15,
    keyless: true,
  },
  pollinations: {
    name: "pollinations", label: "Pollinations Free",
    url: "https://text.pollinations.ai/openai",
    key: () => null,
    model: "openai-fast",
    maxConcurrent: 40, rpm: 120, tpm: 60_000, weight: 55,
    keyless: true,
  },
};

const FALLBACK_CHAIN: ProviderName[] = [
  "groqPro", "cloudflareAi", "agnes", "groqFast", "zhipu",
  "pollinations", "ovh", "kilo", "llm7", "duckduckgo", "freegpt",
];
// __ZEAL_ENGINE_BUDGET_V4__ — scaled for 1000+ concurrent users
const PROVIDER_WALL_MS = 20_000;
const TOTAL_WALL_MS = 45_000;

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

// ─── Request deduplication ────────────────────────────────────────────────────
// Collapses identical requests within a 5s window (e.g. user double-clicks).
const DEDUP_TTL_MS = 5_000;
const dedupMap = new Map<string, { promise: Promise<CallAIResult>; ts: number }>();

function dedupKey(opts: CallAIOptions): string {
  const msgHash = opts.messages.map((m) => `${m.role}:${contentToText(m.content).slice(0, 200)}`).join("|");
  return `${msgHash}|${opts.temperature ?? 0.7}|${opts.maxTokens ?? 1200}|${opts.stream ? "s" : "n"}`;
}

function purgeDedup(): void {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [k, v] of dedupMap) {
    if (v.ts < cutoff) dedupMap.delete(k);
  }
}

// ─── Health-based provider scoring ────────────────────────────────────────────
// Dynamically adjusts provider order based on recent success rate.
function healthWeightedChain(): ProviderName[] {
  return [...FALLBACK_CHAIN].sort((a, b) => {
    const ha = getBreaker(a).health();
    const hb = getBreaker(b).health();
    const totalA = ha.successCount + ha.failureCount;
    const totalB = hb.successCount + hb.failureCount;
    const rateA = totalA > 0 ? ha.successCount / totalA : 1;
    const rateB = totalB > 0 ? hb.successCount / totalB : 1;
    const scoreA = PROVIDERS[a].weight * rateA;
    const scoreB = PROVIDERS[b].weight * rateB;
    return scoreB - scoreA;
  });
}

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!provider.keyless) {
    const apiKey = provider.key();
    if (!apiKey) throw new Error(`missing API key for ${provider.name}`);
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  if (provider.extraHeaders) {
    Object.assign(headers, provider.extraHeaders());
  }

  // Vision-blind providers receive flattened text so one attached photo can
  // never hard-fail the whole fallback chain on an image_url part.
  const messages: AIMessage[] =
    provider.supportsVision || !hasStructuredContent(opts.messages)
      ? opts.messages
      : opts.messages.map((m) =>
          typeof m.content === "string" ? m : { ...m, content: contentToText(m.content) },
        );

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.stream) body.stream = true;

  // 40s hard timeout per attempt
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40_000);

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
      headers,
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

  // ─── Dedup: collapse identical requests within 5s ───────────────────────
  // Streaming responses are single-consumer; sharing one Response.body between
  // two callers would tear the stream apart, so streams are never deduped.
  purgeDedup();
  if (!opts.stream) {
    const dk = dedupKey(opts);
    const existing = dedupMap.get(dk);
    if (existing) {
      return existing.promise;
    }

    const actualCall = _callAIInner(opts, emit, requestId, maxRetries);
    dedupMap.set(dk, { promise: actualCall, ts: Date.now() });
    // Swallow on the cleanup chain — `p.finally(cb)` re-throws, and nothing
    // awaits that derived promise (unhandledRejection on every provider failure).
    void actualCall.catch(() => {}).finally(() => { dedupMap.delete(dk); });
    return actualCall;
  }

  return _callAIInner(opts, emit, requestId, maxRetries);
}

async function _callAIInner(
  opts: CallAIOptions & { onEvent?: EngineEventHandler },
  emit: EngineEventHandler,
  requestId: string,
  maxRetries: number,
): Promise<CallAIResult> {
  // Build provider chain: preferred first, then health-weighted sort
  const baseChain = healthWeightedChain();
  const chain: ProviderName[] = opts.preferProvider
    ? [
        opts.preferProvider,
        ...baseChain.filter((p) => p !== opts.preferProvider),
      ]
    : baseChain;

  const attempts: Array<{ provider: ProviderName; reason: string }> = [];
  let lastInternal = "all providers failed";

  const __chainStart = Date.now();
  const totalWallMs = opts.totalWallMs ?? TOTAL_WALL_MS;
  for (const key of chain) {
    if (Date.now() - __chainStart > totalWallMs) {
      lastInternal = "global wall-clock budget exceeded";
      attempts.push({ provider: key, reason: "budget-exceeded" });
      break;
    }
    const __providerStart = Date.now();
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
      lastInternal = `${provider.label}: ${limit.reason} exhausted`;
      continue;
    }

    // ─── Silent skip: missing API key (no failure recorded) ────────────
    if (!provider.keyless) {
      const apiKey = provider.key();
      if (!apiKey) {
        emit({ type: "provider:skip", provider: key, reason: "missing-api-key" });
        attempts.push({ provider: key, reason: "missing-api-key" });
        lastInternal = `${provider.label}: no API key configured`;
        continue;
      }
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

  console.error("[ai-engine] all providers failed, using local hardcoded oracle:", lastInternal, { requestId });
  // Last-resort: rich, deterministic, on-brand Hinglish/English reply. Never
  // empty, never error-y, always a full structured answer.
  const sys = opts.messages.find((m) => m.role === "system");
  const sysText = typeof sys?.content === "string" ? sys.content : contentToText(sys?.content ?? "");
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : contentToText(lastUser?.content ?? "");
  const nameMatch = sysText.match(/(?:I am|my name is|You are|\bname:)\s*([A-Z][\p{L}'’\- ]{1,30}?)(?=[\n,.;:!?]|$)/u);
  const catMatch = sysText.match(/\b(category|speciality|specialty)\s*[:\-]\s*([a-zA-Z\- ]{3,40})/i);
  const hardInput = {
    personaName: nameMatch?.[1]?.trim(),
    personaCategory: catMatch?.[2]?.trim()?.toLowerCase(),
    systemPrompt: sysText.slice(0, 3000),
    userMessage: userText.trim() || "Tell me something.",
  };
  const hard = opts.stream
    ? buildHardcodedStreamResponse(hardInput)
    : buildHardcodedJsonResponse(hardInput);
  return { response: hard, provider: "hardcoded", attempts: [...attempts, { provider: "hardcoded", reason: "last-resort" }] };
}

// ─── Text-only helper ─────────────────────────────────────────────────────────
export async function callAIJson(
  opts: CallAIOptions & { onEvent?: EngineEventHandler },
): Promise<string> {
  const { response, provider } = await callAI({ ...opts, stream: false });
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (content) return content as string;
  // Empty upstream response — fall through to hardcoded oracle so the UI
  // never sees a blank bubble.
  console.warn(`[ai-engine] empty content from ${provider}, using hardcoded oracle`);
  const sys = opts.messages.find((m) => m.role === "system");
  const sysText = typeof sys?.content === "string" ? sys.content : contentToText(sys?.content ?? "");
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : contentToText(lastUser?.content ?? "");
  const hardRes = buildHardcodedJsonResponse({
    systemPrompt: sysText.slice(0, 3000),
    userMessage: userText.trim() || "Tell me something.",
  });
  const hardData = await hardRes.json() as { choices?: Array<{ message?: { content?: string } }> };
  return (hardData?.choices?.[0]?.message?.content as string) ?? "";
}

// ─── Observability ────────────────────────────────────────────────────────────
export { allGateStats } from "./concurrency-gate";
export { allLimiterSnapshots } from "./token-bucket";
export { allBreakerHealth, resetAllBreakers } from "./circuit-breaker";
export type { AIMessage, AIContentPart, CallAIOptions, EngineEvent, EngineEventHandler } from "./types";
export { contentToText, hasStructuredContent } from "./types";
