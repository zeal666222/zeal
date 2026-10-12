// ═══════════════════════════════════════════════════════════════════════════════
// DB Connection Pool Manager
// ═══════════════════════════════════════════════════════════════════════════════
// Monitors and manages Supabase/Postgres connection pool health.
// Supabase client uses PostgREST under the hood, which manages its own pool
// via PgBouncer. This module provides:
//   - Connection health tracking (active, idle, waiting)
//   - Timeout enforcement for long-running queries
//   - Retry with exponential backoff for transient failures
//   - Stats export for the monitoring dashboard
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface PoolConfig {
  /** Max connections in the pool. Default: 20 */
  maxSize: number;
  /** Connection timeout in ms. Default: 30000 */
  timeoutMs: number;
  /** Max retries for transient failures. Default: 3 */
  maxRetries: number;
  /** Base delay for exponential backoff in ms. Default: 100 */
  baseRetryDelayMs: number;
}

const DEFAULT_CONFIG: PoolConfig = {
  maxSize: parseInt(process.env.DB_POOL_SIZE ?? "20", 10),
  timeoutMs: parseInt(process.env.DB_POOL_TIMEOUT ?? "30000", 10),
  maxRetries: parseInt(process.env.DB_POOL_MAX_RETRIES ?? "3", 10),
  baseRetryDelayMs: 100,
};

// ─── Pool Stats ───────────────────────────────────────────────────────────────

export interface PoolStats {
  active: number;
  idle: number;
  waiting: number;
  total: number;
  maxSize: number;
  avgLatencyMs: number;
  errorCount: number;
  timeoutCount: number;
  timestamp: string;
}

// ─── Pool Manager ─────────────────────────────────────────────────────────────

class PoolManager {
  private config: PoolConfig;
  private activeConnections = 0;
  private idleConnections = 0;
  private waitingRequests = 0;
  private totalErrors = 0;
  private totalTimeouts = 0;
  private latencySamples: number[] = [];
  private readonly MAX_SAMPLES = 100;

  constructor(config?: Partial<PoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a database operation with pool monitoring, timeout, and retry.
   */
  async execute<T>(
    label: string,
    operation: () => Promise<T>,
    options?: { timeoutMs?: number; retries?: number },
  ): Promise<T> {
    const timeout = options?.timeoutMs ?? this.config.timeoutMs;
    const maxRetries = options?.retries ?? this.config.maxRetries;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      this.activeConnections++;
      this.waitingRequests++;

      try {
        // Race the operation against a timeout
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new PoolTimeoutError(label, timeout)),
              timeout,
            ),
          ),
        ]);

        const elapsed = Date.now() - startTime;
        this.recordLatency(elapsed);
        this.activeConnections--;
        this.idleConnections++;
        this.waitingRequests--;

        logger.debug("db", "pool.execute", `${label} completed`, {
          attempt,
          elapsedMs: elapsed,
        });

        return result;
      } catch (err) {
        this.activeConnections--;
        this.waitingRequests--;

        if (err instanceof PoolTimeoutError) {
          this.totalTimeouts++;
          logger.warn("db", "pool.timeout", `${label} timed out after ${timeout}ms`, {
            attempt,
            timeout,
          });
        } else {
          this.totalErrors++;
          logger.warn("db", "pool.error", `${label} failed`, {
            attempt,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on the last attempt
        if (attempt < maxRetries) {
          const delay = this.config.baseRetryDelayMs * Math.pow(2, attempt);
          // Add jitter: +/- 25%
          const jitter = delay * 0.25 * (Math.random() * 2 - 1);
          await new Promise((r) => setTimeout(r, delay + jitter));
        }
      }
    }

    logger.error("db", "pool.exhausted", `${label} failed after ${maxRetries + 1} attempts`, lastError);
    throw lastError!;
  }

  /**
   * Get current pool stats snapshot.
   */
  getStats(): PoolStats {
    const avgLatency =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
        : 0;

    return {
      active: this.activeConnections,
      idle: this.idleConnections,
      waiting: this.waitingRequests,
      total: this.activeConnections + this.idleConnections,
      maxSize: this.config.maxSize,
      avgLatencyMs: Math.round(avgLatency),
      errorCount: this.totalErrors,
      timeoutCount: this.totalTimeouts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all stats counters.
   */
  resetStats(): void {
    this.activeConnections = 0;
    this.idleConnections = 0;
    this.waitingRequests = 0;
    this.totalErrors = 0;
    this.totalTimeouts = 0;
    this.latencySamples = [];
  }

  /**
   * Get pool utilization as a percentage (0-100).
   */
  getUtilization(): number {
    if (this.config.maxSize === 0) return 0;
    return Math.round((this.activeConnections / this.config.maxSize) * 100);
  }

  /**
   * Check if the pool is healthy (not overloaded).
   */
  isHealthy(): boolean {
    const utilization = this.getUtilization();
    return utilization < 90 && this.totalTimeouts < 10;
  }

  private recordLatency(ms: number): void {
    this.latencySamples.push(ms);
    if (this.latencySamples.length > this.MAX_SAMPLES) {
      this.latencySamples.shift();
    }
  }
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PoolTimeoutError extends Error {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
  ) {
    super(`DB operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = "PoolTimeoutError";
  }
}

export class PoolExhaustedError extends Error {
  constructor(public readonly maxSize: number) {
    super(`Connection pool exhausted (max: ${maxSize})`);
    this.name = "PoolExhaustedError";
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: PoolManager | null = null;

export function getPoolManager(config?: Partial<PoolConfig>): PoolManager {
  if (!_instance) {
    _instance = new PoolManager(config);
  }
  return _instance;
}

/**
 * Convenience: execute a DB operation with pool monitoring.
 */
export async function withPool<T>(
  label: string,
  operation: () => Promise<T>,
  options?: { timeoutMs?: number; retries?: number },
): Promise<T> {
  return getPoolManager().execute(label, operation, options);
}

export { PoolManager };
