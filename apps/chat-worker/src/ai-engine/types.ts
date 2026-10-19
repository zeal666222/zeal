// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OpenAI-compatible multimodal content part. Providers that understand images
 * receive these directly; providers without vision support get the message
 * flattened back to text by `engine/index.ts` before the call.
 */
export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string | AIContentPart[];
  cache_control?: { type: "ephemeral" };
}

/** True when any message carries structured (non-string) content. */
export function hasStructuredContent(messages: AIMessage[]): boolean {
  return messages.some((m) => typeof m.content !== "string");
}

/** Flatten a message body to plain text (image parts become labelled links). */
export function contentToText(content: string | AIContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => {
      if (part.type === "text") return part.text;
      return `[The user has attached an image. Image URL: ${part.image_url.url}. Please acknowledge the attachment and respond based on any context available.]`;
    })
    .join("\n");
}

export type ProviderName = "hardcoded" | "agnes" | "groqPro" | "groqFast" | "zhipu" | "ovh" | "kilo" | "llm7" | "duckduckgo" | "freegpt" | "cloudflareAi" | "cfBinding" | "pollinations";

export interface ProviderDef {
  readonly name: ProviderName;
  readonly label: string;
  readonly url: string;
  /** Returns API key, or undefined/empty for free keyless providers. */
  readonly key: () => string | undefined | null;
  readonly model: string;
  /** Max simultaneous in-flight requests against this provider. */
  readonly maxConcurrent: number;
  /** Hard cap on requests per minute. */
  readonly rpm: number;
  /** Hard cap on tokens per minute (input + output). */
  readonly tpm: number;
  /** Weight for priority in the fallback chain (higher = preferred). */
  readonly weight: number;
  /** If true, no Authorization header is sent (truly keyless). */
  readonly keyless?: boolean;
  /** Custom headers to merge into the request (for non-standard auth). */
  readonly extraHeaders?: () => Record<string, string>;
  /**
   * True when the configured `model` accepts `image_url` content parts.
   * Non-vision providers receive flattened text so an attached photo can
   * never make the whole fallback chain fail.
   */
  readonly supportsVision?: boolean;
  /**
   * Override the default fetch-based call. Used for providers that use
   * SDK bindings (e.g. env.AI.run) instead of REST.
   */
  readonly callFn?: (opts: CallAIOptions) => Promise<Response>;
}

export interface CallAIOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  preferProvider?: ProviderName;
  maxRetriesPerProvider?: number;
  /** Abort signal from the caller. */
  signal?: AbortSignal;
  /** Correlation id for logs. */
  requestId?: string;
  /**
   * Per-request override of the engine's global wall-clock budget
   * (TOTAL_WALL_MS). Long generations (e.g. a full kundali reading at
   * 1100 tokens) legitimately need more than the default across slow
   * free-provider lanes; short UX-critical calls keep the default.
   */
  totalWallMs?: number;
}

export interface ProviderHealth {
  name: ProviderName;
  state: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  /** Rolling average latency in ms over the last N calls. */
  avgLatencyMs: number;
  /** Total successful calls since boot. */
  successCount: number;
  /** Total failed calls since boot. */
  failureCount: number;
}

export type EngineEvent =
  | { type: "provider:attempt"; provider: ProviderName; attempt: number }
  | { type: "provider:success"; provider: ProviderName; latencyMs: number }
  | { type: "provider:fail"; provider: ProviderName; reason: string; status?: number }
  | { type: "provider:skip"; provider: ProviderName; reason: string }
  | { type: "provider:circuit-open"; provider: ProviderName; cooldownMs: number }
  | { type: "provider:retry"; provider: ProviderName; attempt: number; delayMs: number }
  | { type: "filler"; text: string; reason: "first-token" | "slow" | "fallback" }
  | { type: "first-token"; provider: ProviderName; latencyMs: number }
  | { type: "stream:done"; provider: ProviderName; totalMs: number };

export type EngineEventHandler = (event: EngineEvent) => void;

export interface FillerConfig {
  /** Language mix: "hi-en" blends Hindi + English (default). */
  locale: "hi-en" | "en" | "hi";
  /** Emit a filler if no token arrives within this many ms. */
  firstTokenTimeoutMs: number;
  /** Emit a mid-stream filler if a gap exceeds this. */
  interTokenTimeoutMs: number;
  /** Absolute cap — after this, we abort and switch provider. */
  absoluteTimeoutMs: number;
}
