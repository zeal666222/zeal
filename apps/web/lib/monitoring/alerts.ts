// ═══════════════════════════════════════════════════════════════════════════════
// Alerts — send alerts when thresholds are exceeded
// ═══════════════════════════════════════════════════════════════════════════════
// Checks metrics snapshots against configurable thresholds and fires alerts.
// Alerts are logged and optionally sent to external services (Slack, PagerDuty,
// email via the job queue).
// ═══════════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { getMetricsSnapshot, type MetricsSnapshot } from "./metrics";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AlertThreshold {
  name: string;
  metric: string; // dot-path into MetricsSnapshot
  operator: ">" | "<" | ">=" | "<=";
  value: number;
  severity: "warning" | "critical";
  cooldownMs: number; // minimum time between alerts for this threshold
  message: string;
}

const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    name: "high_error_rate",
    metric: "errors.rate",
    operator: ">",
    value: 0.05, // 5%
    severity: "critical",
    cooldownMs: 5 * 60 * 1000,
    message: "Error rate exceeded 5%",
  },
  {
    name: "high_latency_p95",
    metric: "latency.p95",
    operator: ">",
    value: 5000, // 5s
    severity: "warning",
    cooldownMs: 10 * 60 * 1000,
    message: "P95 latency exceeded 5 seconds",
  },
  {
    name: "high_latency_p99",
    metric: "latency.p99",
    operator: ">",
    value: 10000, // 10s
    severity: "critical",
    cooldownMs: 5 * 60 * 1000,
    message: "P99 latency exceeded 10 seconds",
  },
  {
    name: "db_pool_exhaustion",
    metric: "dbPool.utilization",
    operator: ">",
    value: 90, // 90%
    severity: "critical",
    cooldownMs: 2 * 60 * 1000,
    message: "DB connection pool utilization above 90%",
  },
  {
    name: "db_pool_timeouts",
    metric: "dbPool.timeoutCount",
    operator: ">",
    value: 10,
    severity: "warning",
    cooldownMs: 10 * 60 * 1000,
    message: "DB pool experiencing timeouts",
  },
];

// ─── Alert State ──────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  threshold: string;
  severity: "warning" | "critical";
  message: string;
  value: number;
  thresholdValue: number;
  timestamp: string;
  acknowledged: boolean;
}

const recentAlerts: Alert[] = [];
const MAX_ALERTS = 100;
const lastFired = new Map<string, number>(); // threshold name → timestamp

// ─── Check & Fire ─────────────────────────────────────────────────────────────

/**
 * Check all thresholds against the current metrics snapshot.
 * Returns any new alerts that were fired.
 */
export function checkAlerts(
  snapshot?: MetricsSnapshot,
  thresholds?: AlertThreshold[],
): Alert[] {
  const metrics = snapshot ?? getMetricsSnapshot();
  const checks = thresholds ?? DEFAULT_THRESHOLDS;
  const now = Date.now();
  const newAlerts: Alert[] = [];

  for (const threshold of checks) {
    const value = getNestedValue(metrics as unknown as Record<string, unknown>, threshold.metric);
    if (typeof value !== "number") continue;

    const triggered = evaluateThreshold(value, threshold.operator, threshold.value);
    if (!triggered) continue;

    // Check cooldown
    const lastFire = lastFired.get(threshold.name) ?? 0;
    if (now - lastFire < threshold.cooldownMs) continue;

    // Fire alert
    lastFired.set(threshold.name, now);

    const alert: Alert = {
      id: `alert-${now}-${Math.random().toString(36).slice(2, 8)}`,
      threshold: threshold.name,
      severity: threshold.severity,
      message: threshold.message,
      value,
      thresholdValue: threshold.value,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    newAlerts.push(alert);
    recentAlerts.push(alert);
    if (recentAlerts.length > MAX_ALERTS) {
      recentAlerts.shift();
    }

    // Log the alert
    if (threshold.severity === "critical") {
      logger.error("system", "alert", threshold.message, undefined, {
        threshold: threshold.name,
        value,
        thresholdValue: threshold.value,
        severity: threshold.severity,
      });
    } else {
      logger.warn("system", "alert", threshold.message, {
        threshold: threshold.name,
        value,
        thresholdValue: threshold.value,
        severity: threshold.severity,
      });
    }

    // Fire-and-forget: send to external services
    void dispatchAlert(alert);
  }

  return newAlerts;
}

/**
 * Get recent alerts (last 100).
 */
export function getRecentAlerts(): Alert[] {
  return [...recentAlerts].reverse();
}

/**
 * Acknowledge an alert.
 */
export function acknowledgeAlert(alertId: string): boolean {
  const alert = recentAlerts.find((a) => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    return true;
  }
  return false;
}

/**
 * Clear all alerts.
 */
export function clearAlerts(): void {
  recentAlerts.length = 0;
  lastFired.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateThreshold(
  value: number,
  operator: AlertThreshold["operator"],
  threshold: number,
): boolean {
  switch (operator) {
    case ">": return value > threshold;
    case "<": return value < threshold;
    case ">=": return value >= threshold;
    case "<=": return value <= threshold;
    default: return false;
  }
}

async function dispatchAlert(alert: Alert): Promise<void> {
  // In production, this would send to Slack/PagerDuty/email.
  // For now, we just log. Can be extended to enqueue a notification job:
  //
  //   import { JobQueueClient } from "@zeal/queue";
  //   const queue = new JobQueueClient();
  //   await queue.enqueue("send-notification", {
  //     userId: "admin-user-id",
  //     title: `Alert: ${alert.severity}`,
  //     body: alert.message,
  //   });
  //
  logger.info("system", "alert_dispatch", `Alert dispatched: ${alert.message}`, {
    alertId: alert.id,
    severity: alert.severity,
  });
}

// ─── Periodic Checker ─────────────────────────────────────────────────────────

let checkInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic alert checking (every 30s by default).
 */
export function startAlertChecker(intervalMs = 30_000): void {
  if (checkInterval) return;
  checkInterval = setInterval(() => {
    checkAlerts();
  }, intervalMs);
}

/**
 * Stop periodic alert checking.
 */
export function stopAlertChecker(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
