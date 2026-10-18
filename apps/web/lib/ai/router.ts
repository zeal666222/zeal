// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — AI Router (thin wrapper over unified callAI)
// ═══════════════════════════════════════════════════════════════════════════════
// Delegates everything to callAI which handles the provider fallback chain.
//
// NOTE: `callAI` returns `CallAIResult = { response, provider, attempts }`.
// This module destructures `.response` before returning it to callers.
// ═══════════════════════════════════════════════════════════════════════════════

import { callAI, type AIMessage } from "./index";
import { recordAi } from "@/lib/monitoring/ai-metrics";

export interface AIRequest {
  task:
    | "horoscope"
    | "tarot"
    | "numerology"
    | "kundali"
    | "chat"
    | "matchmaking"
    | "palmistry"
    | "dream";
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  totalWallMs?: number;
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

  const t0 = Date.now();
  let ok = true;
  let err: string | undefined;
  try {
    const { response, provider } = await callAI({
      messages,
      stream: false,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      totalWallMs: req.totalWallMs,
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const tokens = Number(data?.usage?.completion_tokens ?? 0) || Math.ceil(content.length / 4);
    const totalMs = Date.now() - t0;
    recordAi({
      consultantId: req.task,
      provider: String(provider),
      ttftMs: totalMs,
      totalMs,
      tokens,
      retries: 0,
      ok: true,
      cached: false,
    });
    return {
      content,
      model: data?.model ?? "unknown",
      provider: String(provider),
      cached: false,
    };
  } catch (e) {
    ok = false;
    err = e instanceof Error ? e.message : String(e);
    const totalMs = Date.now() - t0;
    recordAi({
      consultantId: req.task,
      provider: "unknown",
      ttftMs: totalMs,
      totalMs,
      tokens: 0,
      retries: 0,
      ok: false,
      err,
    });
    throw e;
  } finally {
    void ok;
  }
}

export async function generateFaultTolerantStream(
  systemPrompt: string,
  userPrompt: string,
): Promise<Response> {
  const t0 = Date.now();
  const { response, provider } = await callAI({
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
  const ttftMs = Date.now() - t0;
  // Wrap the stream so we can count deltas and record TPOT on completion.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let firstAt = ttftMs;
  let tokens = 0;
  const originalBody = response.body;
  if (!originalBody) {
    recordAi({ consultantId: "stream", provider: String(provider), ttftMs, totalMs: ttftMs, tokens: 0, retries: 0, ok: false });
    return response;
  }
  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const reader = originalBody.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (tokens === 0) firstAt = Date.now() - t0;
          tokens += 1;
          ctrl.enqueue(value);
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
        }
      } catch {
        /* swallow — client disconnected */
      } finally {
        const totalMs = Date.now() - t0;
        recordAi({
          consultantId: "stream",
          provider: String(provider),
          ttftMs: firstAt,
          totalMs,
          tokens,
          retries: 0,
          ok: true,
        });
        try { ctrl.close(); } catch { /* already closed */ }
      }
      void encoder;
    },
  });
  return new Response(body, {
    status: response.status,
    headers: response.headers,
  });
}
