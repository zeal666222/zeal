// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — Cloudflare Workers AI provider helper
// ─────────────────────────────────────────────────────────────────────────────
// FREE TIER ONLY. Cloudflare Workers AI ships a generous no-cost allowance
// (~10,000 neurons/day on the Free plan) and is a natural fit for a SaaS that
// already lives on the Cloudflare edge. It is a *keyed* provider (needs a CF
// API token), so in the fallback chain it sits with the other keyed providers
// (groq → agnes → zhipu → cloudflareAi) and ahead of the keyless free pool.
//
// Two REST surfaces exist:
//   1. OpenAI-COMPATIBLE  →  /accounts/{id}/ai/v1/chat/completions
//      Accepts the exact same `{ model, messages, temperature, max_tokens }`
//      body and returns the standard `{ choices: [{ message: { content } }] }`
//      shape that the generic engine + `callAIJson` already speak. We use this
//      one so the whole pipeline (streaming, circuit breaker, token bucket)
//      works with zero special-casing.
//   2. NATIVE REST        →  /accounts/{id}/ai/run/{model}
//      Model is in the path; response is `{ result: { response } }`. Kept here
//      for reference / future edge-cache adapters (see `workersAiRunUrl`).
//
// ENV VARS THE USER MUST SET (Cloudflare dashboard → My Account → D1/Workers
// AI → "Manage API Token", scope = Workers AI: Run):
//   CF_ACCOUNT_ID  — the account id shown in the dashboard URL
//   CF_AI_TOKEN    — the scoped API token (NOT the global key)
//
// FAIL-SAFE: when either var is missing the provider reports "unconfigured"
// and the engine's existing `missing-api-key` path silently skips it — never
// throws, never opens a circuit, never costs anything.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default instruct model referenced by the rest of the repo.
 * Set CF_AI_MODEL=@cf/meta/llama-3.2-11b-vision-instruct (free tier) to let
 * the engine pass uploaded images to Workers AI as real vision input.
 */
export const CF_AI_MODEL = process.env.CF_AI_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";

/** Cloudflare account id, or undefined when unset (treat empty string as unset). */
export function cfAccountId(): string | undefined {
  const v = process.env.CF_ACCOUNT_ID;
  return v && v.trim() ? v.trim() : undefined;
}

/** Scoped Workers AI API token, or undefined when unset. */
export function cfAiToken(): string | undefined {
  const v = process.env.CF_AI_TOKEN;
  return v && v.trim() ? v.trim() : undefined;
}

/** True only when BOTH the account id and the token are present. */
export function isWorkersAiConfigured(): boolean {
  return Boolean(cfAccountId() && cfAiToken());
}

/**
 * OpenAI-compatible chat-completions base used by the generic engine.
 * When the account id is absent we still return a syntactically valid URL so
 * the registry object never throws at import time; `key()` gates actual usage.
 */
export function workersAiChatUrl(model = CF_AI_MODEL): string {
  void model; // model travels in the JSON body for the compat endpoint
  const acct = cfAccountId() ?? "00000000000000000000000000000000";
  return `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/chat/completions`;
}

/**
 * Native Workers AI `/ai/run/{model}` REST endpoint (model in the path).
 * Provided for adapters / edge cache rules that want the raw, non-OpenAI shape.
 * Not used by the current registry entry, which prefers the compat endpoint.
 */
export function workersAiRunUrl(model = CF_AI_MODEL): string {
  const acct = cfAccountId() ?? "00000000000000000000000000000000";
  return `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${encodeURIComponent(model)}`;
}

/** Convenience token getter wired into the provider registry `key()`. */
export function workersAiKey(): string | null {
  return isWorkersAiConfigured() ? cfAiToken() ?? null : null;
}
