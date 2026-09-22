// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Streaming consumer for the AI chat SSE endpoint
// ═══════════════════════════════════════════════════════════════════════════════
// Handles three event types:
//   { delta: "text" }       → append to assistant message
//   { filler: "Hmm…" }      → replace the typing indicator text
//   { done: true }          → finalize
//
// The filler is rendered in a lighter style so it reads as "the consultant is
// thinking", not as part of the answer.
// ═══════════════════════════════════════════════════════════════════════════════

export interface StreamCallbacks {
  onDelta: (accumulated: string) => void;
  onFiller?: (text: string) => void;
  onDone?: (meta: { provider: string; attempts: unknown[] }) => void;
  onError?: (err: Error) => void;
}

export async function consumeAIStream(
  res: Response,
  cb: StreamCallbacks,
): Promise<string> {
  if (!res.body) {
    const e = new Error("No stream body");
    cb.onError?.(e);
    throw e;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const parsed = JSON.parse(payload) as {
            delta?: string;
            filler?: string;
            reason?: string;
            done?: boolean;
            provider?: string;
            attempts?: unknown[];
          };

          if (parsed.delta) {
            accumulated += parsed.delta;
            cb.onDelta(accumulated);
          }
          if (parsed.filler) {
            cb.onFiller?.(parsed.filler);
          }
          if (parsed.done) {
            cb.onDone?.({
              provider: parsed.provider ?? "unknown",
              attempts: parsed.attempts ?? [],
            });
          }
        } catch {
          /* skip malformed */
        }
      }
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    cb.onError?.(err);
    throw err;
  }

  return accumulated;
}
