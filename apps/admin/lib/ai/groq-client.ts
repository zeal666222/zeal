// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Groq Client (compat shim → routes through unified callAI)
// ═══════════════════════════════════════════════════════════════════════════════
// Kept for backward compatibility with older call sites. New code should use
// `callAI` / `callAIJson` from `@/lib/ai`.
// ═══════════════════════════════════════════════════════════════════════════════

import {callAI, AIUnavailableError} from "./index";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache_control?: { type: "ephemeral" };
}

export interface GroqOptions {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}

export interface GroqResult {
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  cached: boolean;
}

export async function callGroq(options: GroqOptions): Promise<GroqResult> {
  const res = await callAI({
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stream: false,
    preferProvider: "groqPro",
    maxRetriesPerProvider: options.maxRetries ?? 2,
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AIUnavailableError(
      "I'm taking a brief pause. Please try again in a moment.",
      "empty response",
    );
  }
  return {
    content,
    model: data?.model ?? options.model ?? "groq",
    usage: data?.usage,
    cached: false,
  };
}

export async function streamGroq(options: GroqOptions): Promise<Response> {
  return callAI({
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stream: true,
    preferProvider: "groqPro",
    maxRetriesPerProvider: options.maxRetries ?? 2,
  });
}
