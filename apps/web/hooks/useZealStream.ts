"use client";
import { useCallback, useRef, useState } from "react";
import { consumeOpenAIStream } from "@/lib/ai/sse";
export interface UseZealStreamResult {
  streaming: boolean; text: string | null; error: string | null;
  send: (p: { consultantId: string; conversationId: string; content: string }) => Promise<void>;
  cancel: () => void; reset: () => void;
}
export function useZealStream(): UseZealStreamResult {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { ref.current?.abort(); ref.current = null; setStreaming(false); }, []);
  const reset = useCallback(() => { setText(null); setError(null); setStreaming(false); ref.current = null; }, []);
  const send = useCallback(async ({ consultantId, conversationId, content }: { consultantId: string; conversationId: string; content: string }) => {
    cancel();
    const ctrl = new AbortController(); ref.current = ctrl;
    setStreaming(true); setText(""); setError(null);
    try {
      const res = await fetch(`/api/chat/ai/${consultantId}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { error?: string }).error || `HTTP ${res.status}`); }
      await consumeOpenAIStream(res, { onDelta: (acc) => setText(acc), signal: ctrl.signal });
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") setError(e instanceof Error ? e.message : "Stream failed");
    } finally { setStreaming(false); ref.current = null; }
  }, [cancel]);
  return { streaming, text, error, send, cancel, reset };
}
