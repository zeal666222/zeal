// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — AI Router (thin wrapper over unified callAI)
// ═══════════════════════════════════════════════════════════════════════════════
// Delegates everything to callAI which handles Agnes → Groq fallback.
// ═══════════════════════════════════════════════════════════════════════════════

import {callAI, type AIMessage} from "./index";

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

  const res = await callAI({
    messages,
    stream: false,
    temperature: req.temperature,
    maxTokens: req.maxTokens,
  });

  const data = await res.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    model: data?.model ?? "unknown",
    provider: "agnes-or-groq",
    cached: false,
  };
}

export async function generateFaultTolerantStream(
  systemPrompt: string,
  userPrompt: string,
): Promise<Response> {
  return callAI({
    messages: [
      { role: "system", content: systemPrompt, cache_control: { type: "ephemeral" } },
      { role: "user", content: userPrompt },
    ],
    stream: true,
    temperature: 0.7,
    maxTokens: 1000,
  });
}
