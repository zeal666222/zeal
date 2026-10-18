// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — CircuitBreaker
// Per-provider. States:
//   closed     → normal operation
//   open       → skip provider entirely for `cooldownMs`
//   half-open  → let ONE request through; success closes, failure re-opens
//
// Uses exponential cooldown on repeated opens (30s → 60s → 120s → 300s cap).
// ═══════════════════════════════════════════════════════════════════════════════

import type { ProviderHealth, ProviderName } from "./types";

const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 300_000;

export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private consecutiveFailures = 0;
  private openUntil = 0;
  private cooldownMs = BASE_COOLDOWN_MS;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;

  private readonly threshold: number;
  private readonly provider: ProviderName;

  // Rolling latency window for health scoring
  private latencies: number[] = [];
  private readonly latencyWindow = 20;

  private successCount = 0;
  private failureCount = 0;

  constructor(provider: ProviderName, threshold = 5) {
    this.provider = provider;
    this.threshold = threshold;
  }

  isAvailable(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() >= this.openUntil) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    // half-open — allow exactly one request
    return true;
  }

  recordSuccess(latencyMs: number): void {
    this.consecutiveFailures = 0;
    this.successCount++;
    this.lastSuccessAt = Date.now();
    if (this.state !== "closed") {
      this.state = "closed";
      this.cooldownMs = BASE_COOLDOWN_MS; // reset backoff on full recovery
    }
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.latencyWindow) this.latencies.shift();
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.state === "half-open") {
      // Probe failed — re-open with doubled cooldown
      this.trip();
      return;
    }

    if (this.consecutiveFailures >= this.threshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = "open";
    this.openUntil = Date.now() + this.cooldownMs;
    this.cooldownMs = Math.min(this.cooldownMs * 2, MAX_COOLDOWN_MS);
    this.consecutiveFailures = 0;
  }

  health(): ProviderHealth {
    const avg =
      this.latencies.length > 0
        ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
        : 0;
    return {
      name: this.provider,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      avgLatencyMs: avg,
      successCount: this.successCount,
      failureCount: this.failureCount,
    };
  }

  /** Force-reset — used by admin operations. */
  reset(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.cooldownMs = BASE_COOLDOWN_MS;
  }
}

const breakers = new Map<ProviderName, CircuitBreaker>();

export function getBreaker(provider: ProviderName, threshold = 5): CircuitBreaker {
  let b = breakers.get(provider);
  if (!b) {
    b = new CircuitBreaker(provider, threshold);
    breakers.set(provider, b);
  }
  return b;
}

export function allBreakerHealth(): ProviderHealth[] {
  return Array.from(breakers.values()).map((b) => b.health());
}

export function resetAllBreakers(): void {
  for (const b of breakers.values()) b.reset();
}
