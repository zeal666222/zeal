// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — AI Router (thin wrapper over unified callAI)
// ═══════════════════════════════════════════════════════════════════════════════
// Delegates everything to callAI which handles the provider fallback chain.
//
// NOTE: `callAI` returns `CallAIResult = { response, provider, attempts }`.
// This module destructures `.response` before returning it to callers.
// ═══════════════════════════════════════════════════════════════════════════════

import { callAI, type AIMessage } from "./index";

export interface AIRequest {
  task:
    | "horoscope"
    | "tarot"
    | "numerology"
    | "kundali"
    | "chat"
    | "matchmaking"
    | "palmistry";
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  cached: boolean;
}

export async function runAI(req: AIRequest): Promise<AIResponse> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: req.systemPrompt,
      cache_control: { type: "ephemeral" },
    },
    { role: "user", content: req.userPrompt },
  ];

  const { response, provider } = await callAI({
    messages,
    stream: false,
    temperature: req.temperature,
    maxTokens: req.maxTokens,
  });

  const data = await response.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    model: data?.model ?? "unknown",
    provider: String(provider),
    cached: false,
  };
}

export async function generateFaultTolerantStream(
  systemPrompt: string,
  userPrompt: string,
): Promise<Response> {
  const { response } = await callAI({
    messages: [
      {
        role: "system",
        content: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
      { role: "user", content: userPrompt },
    ],
    stream: true,
    temperature: 0.7,
    maxTokens: 1000,
  });
  return response;
}
