// Universal SSE parser for OpenAI-compatible streams (Groq, Agnes, Zhipu).
export interface SSECallbacks {
  onDelta: (accumulated: string) => void;
  onDone?: (final: string) => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}
export async function consumeOpenAIStream(response: Response, cb: SSECallbacks): Promise<string> {
  if (!response.body) { const e = new Error("Stream has no body"); cb.onError?.(e); throw e; }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", accumulated = "";
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (cb.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) { accumulated += delta; cb.onDelta(accumulated); }
        } catch { /* skip */ }
      }
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    cb.onError?.(err); throw err;
  }
  cb.onDone?.(accumulated); return accumulated;
}
