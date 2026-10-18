// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — Cloudflare Workers AI helpers (Worker port)
// ═══════════════════════════════════════════════════════════════════════════════

import type { Env } from "../env";

export function getCFModel(env: Env): string {
  return env.CF_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
}

export function workersAiChatUrl(env: Env): string {
  const acct = env.CF_ACCOUNT_ID || "00000000000000000000000000000000";
  return `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/chat/completions`;
}

export function workersAiKey(env: Env): string | null {
  return env.CF_AI_TOKEN?.trim() ? env.CF_AI_TOKEN : null;
}
