// ═══════════════════════════════════════════════════════════════════════════════
// Health Check — periodic check of DB, Redis, CF Workers, AI providers
// ═══════════════════════════════════════════════════════════════════════════════
// Returns a structured health report used by:
//   - /api/health endpoint
//   - Admin dashboard system page
//   - Alert system (triggers alerts on failures)
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";
import { logger } from "@/lib/logger";
import { getPoolManager } from "@/lib/db/pool";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "down";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  checks: HealthCheck[];
  uptime: number;
  version: string;
}

const startTime = Date.now();

// ─── Individual Checks ────────────────────────────────────────────────────────

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("health_check_db").single();

    if (error) {
      // RPC doesn't exist yet — try a simple query instead
      const { error: qErr } = await admin.from("User").select("id").limit(1);
      if (qErr) throw new Error(qErr.message);
    }

    return {
      name: "database",
      status: "healthy",
      latencyMs: Date.now() - start,
      details: { pool: getPoolManager().getStats() },
    };
  } catch (err) {
    return {
      name: "database",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkSupabaseRealtime(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
      return {
        name: "realtime",
        status: "degraded",
        latencyMs: 0,
        message: "NEXT_PUBLIC_SUPABASE_URL not set",
      };
    }

    // Simple connectivity check — hit the Supabase REST endpoint
    const res = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      signal: AbortSignal.timeout(5000),
    });

    return {
      name: "realtime",
      status: res.ok ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "realtime",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function checkAIProvider(): Promise<HealthCheck> {
  const start = Date.now();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      name: "ai_provider",
      status: "degraded",
      latencyMs: 0,
      message: "GROQ_API_KEY not set",
    };
  }

  try {
    // Lightweight check: list models (no token usage)
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    return {
      name: "ai_provider",
      status: res.ok ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "ai_provider",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function checkAstroWorker(): Promise<HealthCheck> {
  const start = Date.now();
  const workerUrl = process.env.ASTRO_WORKER_URL;

  if (!workerUrl) {
    return {
      name: "astro_worker",
      status: "degraded",
      latencyMs: 0,
      message: "ASTRO_WORKER_URL not set",
    };
  }

  try {
    const res = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    return {
      name: "astro_worker",
      status: res.ok ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      message: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "astro_worker",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

// ─── Full Report ──────────────────────────────────────────────────────────────

/**
 * Run all health checks and return a comprehensive report.
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkSupabaseRealtime(),
    checkAIProvider(),
    checkAstroWorker(),
  ]);

  const results: HealthCheck[] = checks.map((c, i) => {
    if (c.status === "fulfilled") return c.value;
    const names = ["database", "realtime", "ai_provider", "astro_worker"];
    return {
      name: names[i] ?? "unknown",
      status: "down" as HealthStatus,
      latencyMs: 0,
      message: c.reason?.message ?? "Check failed",
    };
  });

  // Overall status: worst of all checks
  const statuses = results.map((r) => r.status);
  let overall: HealthStatus = "healthy";
  if (statuses.includes("down")) overall = "down";
  else if (statuses.includes("degraded")) overall = "degraded";

  const report: HealthReport = {
    status: overall,
    timestamp: new Date().toISOString(),
    checks: results,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
  };

  // Log non-healthy states
  if (overall !== "healthy") {
    const failed = results.filter((r) => r.status !== "healthy");
    logger.warn("system", "health_check", `Health: ${overall}`, {
      failed: failed.map((f) => ({ name: f.name, message: f.message })),
    });
  }

  return report;
}

/**
 * Quick health check for load balancers / uptime monitors.
 * Returns 200 if DB is reachable, 503 otherwise.
 */
export async function quickHealthCheck(): Promise<{ ok: boolean; status: number }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("User").select("id").limit(1);
    if (error) return { ok: false, status: 503 };
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 503 };
  }
}
