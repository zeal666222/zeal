// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Collection — request count, latency, error rate, DB pool stats
// ═══════════════════════════════════════════════════════════════════════════════
// In-memory metrics collection for the current Vercel instance. Aggregated
// periodically and exposed via /api/metrics for the admin dashboard.
//
// For production, these would be exported to an external metrics service
// (Datadog, Grafana Cloud, etc.). This module provides the local collection
// layer that can be wired to any exporter.
// ═══════════════════════════════════════════════════════════════════════════════

import { getPoolManager } from "@/lib/db/pool";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  requests: RequestMetrics;
  latency: LatencyMetrics;
  errors: ErrorMetrics;
  dbPool: {
    active: number;
    idle: number;
    waiting: number;
    utilization: number;
    errorCount: number;
    timeoutCount: number;
  };
  aiChat: {
    activeConversations: number;
    providerGates: Record<string, { active: number; queued: number; max: number }>;
  };
  queue: {
    pending: number;
    processing: number;
    failed: number;
  };
}

interface RequestMetrics {
  total: number;
  perSecond: number;
  byRoute: Record<string, number>;
  byStatus: Record<string, number>;
}

interface LatencyMetrics {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  samples: number;
}

interface ErrorMetrics {
  total: number;
  rate: number; // errors / total requests
  byType: Record<string, number>;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const MAX_LATENCY_SAMPLES = 1000;
const startTime = Date.now();

let totalRequests = 0;
let totalErrors = 0;
let latencySamples: number[] = [];
const routeCounts = new Map<string, number>();
const statusCounts = new Map<string, number>();
const errorTypes = new Map<string, number>();

let lastSnapshotTime = Date.now();
let lastRequestCount = 0;

// ─── Recording ────────────────────────────────────────────────────────────────

/**
 * Record a completed request.
 */
export function recordRequest(opts: {
  route: string;
  status: number;
  latencyMs: number;
  error?: string;
}): void {
  totalRequests++;

  // Route counts
  const routeKey = opts.route;
  routeCounts.set(routeKey, (routeCounts.get(routeKey) ?? 0) + 1);

  // Status counts
  const statusKey = String(Math.floor(opts.status / 100)) + "xx";
  statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);

  // Latency
  latencySamples.push(opts.latencyMs);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples = latencySamples.slice(-MAX_LATENCY_SAMPLES);
  }

  // Errors
  if (opts.status >= 400) {
    totalErrors++;
    if (opts.error) {
      errorTypes.set(opts.error, (errorTypes.get(opts.error) ?? 0) + 1);
    }
  }
}

/**
 * Record an error event.
 */
export function recordError(type: string, message?: string): void {
  totalErrors++;
  const key = message ? `${type}: ${message}` : type;
  errorTypes.set(key, (errorTypes.get(key) ?? 0) + 1);
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Get a snapshot of all current metrics.
 */
export function getMetricsSnapshot(): MetricsSnapshot {
  const now = Date.now();
  const elapsed = (now - lastSnapshotTime) / 1000;
  const reqDelta = totalRequests - lastRequestCount;
  const rps = elapsed > 0 ? reqDelta / elapsed : 0;

  lastSnapshotTime = now;
  lastRequestCount = totalRequests;

  // Calculate latency percentiles
  const sorted = [...latencySamples].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const avg =
    sorted.length > 0
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length
      : 0;

  // DB pool stats
  const poolStats = getPoolManager().getStats();

  // Build route map
  const byRoute: Record<string, number> = {};
  for (const [k, v] of routeCounts.entries()) {
    byRoute[k] = v;
  }

  // Build status map
  const byStatus: Record<string, number> = {};
  for (const [k, v] of statusCounts.entries()) {
    byStatus[k] = v;
  }

  // Build error type map
  const byType: Record<string, number> = {};
  for (const [k, v] of errorTypes.entries()) {
    byType[k] = v;
  }

  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor((now - startTime) / 1000),
    requests: {
      total: totalRequests,
      perSecond: Math.round(rps * 10) / 10,
      byRoute,
      byStatus,
    },
    latency: {
      avg: Math.round(avg),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      samples: sorted.length,
    },
    errors: {
      total: totalErrors,
      rate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      byType,
    },
    dbPool: {
      active: poolStats.active,
      idle: poolStats.idle,
      waiting: poolStats.waiting,
      utilization: getPoolManager().getUtilization(),
      errorCount: poolStats.errorCount,
      timeoutCount: poolStats.timeoutCount,
    },
    aiChat: {
      activeConversations: 0, // populated by caller if available
      providerGates: {},
    },
    queue: {
      pending: 0,
      processing: 0,
      failed: 0,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

/**
 * Reset all metrics (for testing).
 */
export function resetMetrics(): void {
  totalRequests = 0;
  totalErrors = 0;
  latencySamples = [];
  routeCounts.clear();
  statusCounts.clear();
  errorTypes.clear();
  lastSnapshotTime = Date.now();
  lastRequestCount = 0;
}
