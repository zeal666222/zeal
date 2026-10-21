import type { Env } from "../env";
import { getGate } from "./concurrency-gate";
import { getLimiter } from "./token-bucket";
import { getBreaker } from "./circuit-breaker";
import { getCFModel, workersAiChatUrl, workersAiKey } from "./cloudflare-workers-ai";
import { contentToText, hasStructuredContent } from "./types";
import { buildHardcodedJsonResponse, buildHardcodedStreamResponse } from "./hardcoded-oracle";
import type { AIMessage, CallAIOptions, EngineEvent, EngineEventHandler, ProviderDef, ProviderName } from "./types";

function buildProviders(env: Env): Record<ProviderName, ProviderDef> {
  const ZHIPU_MODEL = "glm-4v-flash";
  const map: Record<ProviderName, ProviderDef> = {
    // Local deterministic fallback — never goes into FALLBACK_CHAIN, used
    // only as the last-resort response builder in callAI.
    hardcoded: {
      name: "hardcoded", label: "Zeal Local Oracle",
      url: "local://hardcoded", key: () => null,
      model: "zeal-hardcoded-oracle",
      maxConcurrent: 1_000_000, rpm: 1_000_000, tpm: 1_000_000, weight: 0,
      keyless: true,
    },
    groqPro: {
      name: "groqPro", label: "Groq 70B",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: () => env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      maxConcurrent: 50, rpm: 30, tpm: 14_000, weight: 85,
    },
    groqFast: {
      name: "groqFast", label: "Groq 8B",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: () => env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      maxConcurrent: 60, rpm: 30, tpm: 6_000, weight: 65,
    },
    zhipu: {
      name: "zhipu", label: "Zhipu GLM",
      url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      key: () => env.ZHIPU_API_KEY,
      model: ZHIPU_MODEL,
      maxConcurrent: 10, rpm: 30, tpm: 15_000, weight: 40,
      supportsVision: ZHIPU_MODEL.includes("4v"),
    },
    cloudflareAi: {
      name: "cloudflareAi", label: "CF Llama 3.3 70B",
      url: workersAiChatUrl(env),
      key: () => workersAiKey(env),
      model: getCFModel(env),
      maxConcurrent: 40, rpm: 30, tpm: 20_000, weight: 90,
      supportsVision: getCFModel(env).includes("vision"),
    },
    cfBinding: {
      name: "cfBinding", label: "CF Workers AI (binding)",
      url: "binding://cf-ai",
      key: () => null,
      model: getCFModel(env),
      maxConcurrent: 200, rpm: 1000, tpm: 100_000, weight: 95,
      keyless: true,
      supportsVision: getCFModel(env).includes("vision"),
      callFn: env.AI ? async (opts) => {
        const messages = opts.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.map((p) => p.type === "text" ? p.text : "").join(""),
        }));
        const result = await env.AI.run(getCFModel(env) as any, {
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 1200,
          stream: opts.stream ?? false,
        });
        if (opts.stream && result instanceof ReadableStream) {
          return new Response(result, { headers: { "Content-Type": "text/event-stream" } });
        }
        const json = result as { response?: string };
        return new Response(JSON.stringify({ choices: [{ message: { content: json.response ?? "" } }] }), {
          headers: { "Content-Type": "application/json" },
        });
      } : undefined,
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
      extraHeaders: () => ({ "x-vqd-accept": "1", "Content-Type": "application/json" }),
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
  return map;
}

// Cloudflare first, always. `cfBinding` is the free Workers AI binding (no key,
// no egress), `cloudflareAi` is the same models over the REST API with
// CF_AI_TOKEN. Groq/Zhipu sit behind them as capacity overflow, the keyless pool
// behind that, and the local oracle last. Weights encode that order because
// healthWeightedChain re-sorts per request by circuit-breaker health.
const FALLBACK_CHAIN: ProviderName[] = [
  "cfBinding", "cloudflareAi", "groqPro", "groqFast", "zhipu",
  "pollinations", "ovh", "kilo", "llm7", "duckduckgo", "freegpt",
];

const TOTAL_WALL_MS = 45_000;

export class AIUnavailableError extends Error {
  constructor(public readonly userMessage: string, public readonly internalReason: string) {
    super(internalReason);
    this.name = "AIUnavailableError";
  }
}

const HUMAN_UNAVAILABLE = "I'm taking a brief pause — give me a moment and try again.";

function healthWeightedChain(providers: Record<ProviderName, ProviderDef>): ProviderName[] {
  return [...FALLBACK_CHAIN].sort((a, b) => {
    const ha = getBreaker(a).health();
    const hb = getBreaker(b).health();
    const tA = ha.successCount + ha.failureCount;
    const tB = hb.successCount + hb.failureCount;
    const rA = tA > 0 ? ha.successCount / tA : 1;
    const rB = tB > 0 ? hb.successCount / tB : 1;
    return providers[b].weight * rB - providers[a].weight * rA;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number, base = 500, cap = 16_000): number {
  const exp = Math.min(base * Math.pow(2, attempt), cap);
  return Math.max(150, Math.round(exp + exp * 0.3 * (Math.random() * 2 - 1)));
}

async function callProviderOnce(
  provider: ProviderDef,
  opts: CallAIOptions,
): Promise<Response> {
  // Use custom callFn if provided (e.g. for env.AI binding)
  if (provider.callFn) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40_000);
    if (opts.signal) {
      if (opts.signal.aborted) { clearTimeout(timer); throw new Error("aborted"); }
      opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
    try {
      return await provider.callFn({ ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!provider.keyless) {
    const apiKey = provider.key();
    if (!apiKey) throw new Error(`missing API key for ${provider.name}`);
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  if (provider.extraHeaders) Object.assign(headers, provider.extraHeaders());

  const messages: AIMessage[] =
    provider.supportsVision || !hasStructuredContent(opts.messages)
      ? opts.messages
      : opts.messages.map((m) =>
          typeof m.content === "string" ? m : { role: m.role, content: contentToText(m.content) } as AIMessage,
        );

  const body: Record<string, unknown> = {
    model: provider.model, messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.stream) body.stream = true;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40_000);
  if (opts.signal) {
    if (opts.signal.aborted) { clearTimeout(timer); throw new Error("aborted"); }
    opts.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  try {
    return await fetch(provider.url, { method: "POST", signal: ctrl.signal, headers, body: JSON.stringify(body) });
  } finally {
    clearTimeout(timer);
  }
}

export interface CallAIResult {
  response: Response;
  provider: ProviderName;
  attempts: Array<{ provider: ProviderName; reason: string }>;
}

export async function callAI(
  env: Env,
  opts: CallAIOptions & { onEvent?: EngineEventHandler },
): Promise<CallAIResult> {
  const emit = opts.onEvent ?? (() => {});
  const maxRetries = opts.maxRetriesPerProvider ?? 3;
  const providers = buildProviders(env);
  const chain = healthWeightedChain(providers);
  const attempts: Array<{ provider: ProviderName; reason: string }> = [];
  let lastInternal = "all providers failed";
  const start = Date.now();
  const totalWallMs = opts.totalWallMs ?? TOTAL_WALL_MS;

  for (const key of chain) {
    if (Date.now() - start > totalWallMs) {
      attempts.push({ provider: key, reason: "budget-exceeded" });
      break;
    }
    const provider = providers[key];
    const breaker = getBreaker(key);
    const gate = getGate(key, provider.maxConcurrent);
    const limiter = getLimiter(key, provider.rpm, provider.tpm);

    if (!breaker.isAvailable()) {
      emit({ type: "provider:circuit-open", provider: key, cooldownMs: 30_000 });
      lastInternal = `${provider.label}: circuit open`;
      attempts.push({ provider: key, reason: "circuit-open" });
      continue;
    }

    const limit = limiter.check(opts.messages, opts.maxTokens ?? 1200);
    if (!limit.ok) {
      attempts.push({ provider: key, reason: `rate-limited:${limit.reason}` });
      lastInternal = `${provider.label}: ${limit.reason} exhausted`;
      continue;
    }

    if (!provider.keyless && !provider.key()) {
      emit({ type: "provider:skip", provider: key, reason: "missing-api-key" });
      attempts.push({ provider: key, reason: "missing-api-key" });
      continue;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let release: (() => void) | null = null;
      try { release = await gate.acquire(); } catch {
        attempts.push({ provider: key, reason: "gate-timeout" });
        break;
      }
      emit({ type: "provider:attempt", provider: key, attempt });
      const t0 = Date.now();
      try {
        const res = await callProviderOnce(provider, opts);
        const latency = Date.now() - t0;
        if (res.ok) {
          breaker.recordSuccess(latency);
          emit({ type: "provider:success", provider: key, latencyMs: latency });
          return { response: res, provider: key, attempts };
        }
        if (res.status === 429) {
          breaker.recordFailure();
          limiter.refund();
          if (attempt < maxRetries) {
            const delay = Number(res.headers.get("retry-after") ?? "0") * 1000 || backoffMs(attempt);
            emit({ type: "provider:retry", provider: key, attempt: attempt + 1, delayMs: delay });
            await sleep(delay);
            continue;
          }
          attempts.push({ provider: key, reason: "429-exhausted" });
          break;
        }
        if (res.status >= 500) {
          breaker.recordFailure();
          limiter.refund();
          if (attempt < maxRetries) {
            await sleep(backoffMs(attempt));
            emit({ type: "provider:retry", provider: key, attempt: attempt + 1, delayMs: backoffMs(attempt) });
            continue;
          }
          attempts.push({ provider: key, reason: `http-${res.status}` });
          break;
        }
        breaker.recordFailure();
        limiter.refund();
        attempts.push({ provider: key, reason: `http-${res.status}` });
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        breaker.recordFailure();
        limiter.refund();
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
        attempts.push({ provider: key, reason: /abort|timeout/i.test(msg) ? "timeout" : "network" });
      } finally {
        if (release) release();
      }
    }
  }

  // ─── Last resort: local hardcoded oracle ────────────────────────────────
  // Guarantees the user always gets a rich, on-brand reply instead of an
  // empty error bubble. Never throws past this point.
  emit({ type: "provider:attempt", provider: "hardcoded", attempt: 0 });
  const hard = hardcodedResponse(opts);
  emit({ type: "provider:success", provider: "hardcoded", latencyMs: 1 });
  return { response: hard, provider: "hardcoded", attempts: [...attempts, { provider: "hardcoded", reason: "last-resort" }] };
}

function hardcodedResponse(opts: CallAIOptions): Response {
  // Extract persona context from the system message and last user message.
  const sys = opts.messages.find((m) => m.role === "system");
  const sysText = typeof sys?.content === "string" ? sys.content : contentToText(sys?.content ?? "");
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : contentToText(lastUser?.content ?? "");

  const nameMatch = sysText.match(/(?:I am|my name is|You are|\bname:)\s*([A-Z][\p{L}'’\- ]{1,30}?)(?=[\n,.;:!?]|$)/u);
  const catMatch = sysText.match(/\b(category|speciality|specialty)\s*[:\-]\s*([a-zA-Z\- ]{3,40})/i);

  const input = {
    personaName: nameMatch?.[1]?.trim(),
    personaCategory: catMatch?.[2]?.trim()?.toLowerCase(),
    systemPrompt: sysText.slice(0, 3000),
    userMessage: userText.trim() || "Tell me something.",
  };

  return opts.stream
    ? buildHardcodedStreamResponse(input)
    : buildHardcodedJsonResponse(input);
}

export async function callAIJson(env: Env, opts: CallAIOptions & { onEvent?: EngineEventHandler }): Promise<string> {
  const { response } = await callAI(env, { ...opts, stream: false });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content;
  if (content) return content as string;
  // Empty upstream — return hardcoded deterministic reply.
  const hardRes = hardcodedResponse(opts);
  const hardData = await hardRes.json() as { choices?: Array<{ message?: { content?: string } }> };
  return (hardData?.choices?.[0]?.message?.content as string) ?? "";
}

export { allGateStats } from "./concurrency-gate";
export { allLimiterSnapshots } from "./token-bucket";
export { allBreakerHealth, resetAllBreakers } from "./circuit-breaker";
export type { AIMessage, AIContentPart, CallAIOptions, EngineEvent, EngineEventHandler } from "./types";
export { contentToText, hasStructuredContent } from "./types";
