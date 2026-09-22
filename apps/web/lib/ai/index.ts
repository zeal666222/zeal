// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Unified AI Module (v2)
// ═══════════════════════════════════════════════════════════════════════════════
// Public entry: `callAI` / `callAIJson` now delegate to the enterprise engine
// in `./engine`. The old signature is preserved for backward compatibility.
//
// New capabilities:
//   • Per-provider ConcurrencyGate (semaphore)
//   • Per-provider TokenBucket (RPM + TPM)
//   • Per-provider CircuitBreaker with exponential cooldown
//   • Priority-based fallback chain with health scoring
//   • EngineEvent stream for observability
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from "crypto";
import { redis } from "@/lib/cache";

export {
  callAI,
  callAIJson,
  AIUnavailableError,
  allGateStats,
  allLimiterSnapshots,
  allBreakerHealth,
  resetAllBreakers,
} from "./engine";

export type {
  AIMessage,
  CallAIOptions,
  EngineEvent,
  EngineEventHandler,
  ProviderName,
} from "./engine/types";

// ─── Response cache (unchanged) ───────────────────────────────────────────────
export async function withAICache<T>(
  namespace: string,
  payload: unknown,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
  const key = `zeal:ai:${namespace}:${hash}`;

  try {
    const hit = await redis.get<string>(key);
    if (hit) return { value: JSON.parse(hit) as T, cached: true };
  } catch { /* miss */ }

  const value = await producer();
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch { /* ignore */ }
  return { value, cached: false };
}
