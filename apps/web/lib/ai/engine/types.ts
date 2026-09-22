// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache_control?: { type: "ephemeral" };
}

export type ProviderName = "agnes" | "groqPro" | "groqFast" | "zhipu";

export interface ProviderDef {
  readonly name: ProviderName;
  readonly label: string;
  readonly url: string;
  readonly key: () => string | undefined;
  readonly model: string;
  /** Max simultaneous in-flight requests against this provider. */
  readonly maxConcurrent: number;
  /** Hard cap on requests per minute. */
  readonly rpm: number;
  /** Hard cap on tokens per minute (input + output). */
  readonly tpm: number;
  /** Weight for priority in the fallback chain (higher = preferred). */
  readonly weight: number;
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
