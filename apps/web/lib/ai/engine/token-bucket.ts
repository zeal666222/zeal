// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — TokenBucketLimiter
// Three-dimensional limiter per provider:
//   • RPM  — requests per minute
//   • TPM  — tokens per minute (estimated from message length)
//   • Concurrent (handled by ConcurrencyGate)
//
// Refills continuously. A request must pass ALL buckets to proceed.
// If a bucket is dry, the caller is told how long to wait.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AIMessage, ProviderName } from "./types";

interface Bucket {
  capacity: number;
  tokens: number;
  refillPerMs: number;
  lastRefillAt: number;
}

function makeBucket(capacity: number, windowMs: number): Bucket {
  return {
    capacity,
    tokens: capacity,
    refillPerMs: capacity / windowMs,
    lastRefillAt: Date.now(),
  };
}

function refill(b: Bucket, now: number): void {
  const elapsed = now - b.lastRefillAt;
  if (elapsed <= 0) return;
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillPerMs);
  b.lastRefillAt = now;
}

function tryConsume(b: Bucket, amount: number): { ok: boolean; waitMs: number } {
  const now = Date.now();
  refill(b, now);
  if (b.tokens >= amount) {
    b.tokens -= amount;
    return { ok: true, waitMs: 0 };
  }
  const deficit = amount - b.tokens;
  const waitMs = Math.ceil(deficit / b.refillPerMs);
  return { ok: false, waitMs };
}

/** Cheap token estimate: 1 token ≈ 4 chars for English, ~2 for Hindi/Devanagari. */
export function estimateTokens(messages: AIMessage[], maxOutput = 0): number {
  let chars = 0;
  let devanagariChars = 0;
  for (const m of messages) {
    chars += m.content.length;
    const dev = m.content.match(/[\u0900-\u097F]/g);
    if (dev) devanagariChars += dev.length;
  }
  // English: 4 chars/token. Devanagari: 2 chars/token (approximation).
  const asciiChars = Math.max(0, chars - devanagariChars);
  const inputTokens = Math.ceil(asciiChars / 4) + Math.ceil(devanagariChars / 2);
  return inputTokens + maxOutput;
}

export interface LimitCheck {
  ok: boolean;
  waitMs: number;
  reason?: "rpm" | "tpm";
  snapshot: { rpmRemaining: number; tpmRemaining: number };
}

export class TokenBucketLimiter {
  private rpm: Bucket;
  private tpm: Bucket;
  private readonly provider: ProviderName;

  constructor(provider: ProviderName, rpmCapacity: number, tpmCapacity: number) {
    this.provider = provider;
    this.rpm = makeBucket(rpmCapacity, 60_000);
    this.tpm = makeBucket(tpmCapacity, 60_000);
  }

  /**
   * Try to consume. If `tokens` is not provided, it's estimated from messages.
   * Returns { ok: false, waitMs } when the caller should back off.
   */
  check(messages: AIMessage[], maxOutput: number, explicitTokens?: number): LimitCheck {
    const tokens = explicitTokens ?? estimateTokens(messages, maxOutput);

    const r = tryConsume(this.rpm, 1);
    if (!r.ok) {
      return {
        ok: false,
        waitMs: r.waitMs,
        reason: "rpm",
        snapshot: this.snapshot(),
      };
    }

    const t = tryConsume(this.tpm, tokens);
    if (!t.ok) {
      // Refund the RPM we already consumed — the request never goes out.
      this.rpm.tokens = Math.min(this.rpm.capacity, this.rpm.tokens + 1);
      return {
        ok: false,
        waitMs: t.waitMs,
        reason: "tpm",
        snapshot: this.snapshot(),
      };
    }

    return { ok: true, waitMs: 0, snapshot: this.snapshot() };
  }

  /** Refund a token consumed by a failed request (e.g. 5xx). */
  refund(tokens = 1): void {
    this.rpm.tokens = Math.min(this.rpm.capacity, this.rpm.tokens + 1);
    this.tpm.tokens = Math.min(this.tpm.capacity, this.tpm.tokens + tokens);
  }

  snapshot(): { rpmRemaining: number; tpmRemaining: number } {
    const now = Date.now();
    refill(this.rpm, now);
    refill(this.tpm, now);
    return {
      rpmRemaining: Math.floor(this.rpm.tokens),
      tpmRemaining: Math.floor(this.tpm.tokens),
    };
  }

  get name(): ProviderName {
    return this.provider;
  }
}

const limiters = new Map<ProviderName, TokenBucketLimiter>();

export function getLimiter(
  provider: ProviderName,
  rpm: number,
  tpm: number,
): TokenBucketLimiter {
  let l = limiters.get(provider);
  if (!l) {
    l = new TokenBucketLimiter(provider, rpm, tpm);
    limiters.set(provider, l);
  }
  return l;
}

export function allLimiterSnapshots(): Record<string, { rpmRemaining: number; tpmRemaining: number }> {
  const out: Record<string, { rpmRemaining: number; tpmRemaining: number }> = {};
  for (const [k, v] of limiters.entries()) out[k] = v.snapshot();
  return out;
}
