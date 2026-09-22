// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL AI Engine — ConcurrencyGate
// Per-provider semaphore. Prevents a single burst from one Vercel instance
// from overwhelming a provider. FIFO queue with a hard cap on wait time.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ProviderName } from "./types";

interface Waiter {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ConcurrencyGate {
  private active = 0;
  private queue: Waiter[] = [];
  private readonly max: number;
  private readonly maxWaitMs: number;

  constructor(max: number, maxWaitMs = 15_000) {
    this.max = Math.max(1, max);
    this.maxWaitMs = maxWaitMs;
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }

    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error("[ConcurrencyGate] queue wait timeout"));
      }, this.maxWaitMs);

      this.queue.push({
        resolve: () => {
          clearTimeout(timer);
          resolve(() => this.release());
        },
        reject,
        timer,
      });
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next.resolve();
  }

  get inflight(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  /** Snapshot for observability. */
  stats(): { active: number; queued: number; max: number } {
    return { active: this.active, queued: this.queue.length, max: this.max };
  }
}

// Singleton map — one gate per provider per process
const gates = new Map<ProviderName, ConcurrencyGate>();

export function getGate(name: ProviderName, max: number): ConcurrencyGate {
  let g = gates.get(name);
  if (!g) {
    g = new ConcurrencyGate(max);
    gates.set(name, g);
  }
  return g;
}

export function allGateStats(): Record<string, ReturnType<ConcurrencyGate["stats"]>> {
  const out: Record<string, ReturnType<ConcurrencyGate["stats"]>> = {};
  for (const [k, v] of gates.entries()) out[k] = v.stats();
  return out;
}
