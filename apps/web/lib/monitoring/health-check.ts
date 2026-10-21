// ═══════════════════════════════════════════════════════════════════════════════
// Health Check — measured probe of PostgREST, Supabase Realtime, AI providers
// ─────────────────────────────────────────────────────────────────────────────
// Every status/latency here is a real round trip. Consumed by
// GET /api/admin/probes/health, which backs the admin "Platform Status" panel.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
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
    const { error } = await admin.from("User").select("id").limit(1);
    if (error) throw new Error(error.message);

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      name: "realtime",
      status: "degraded",
      latencyMs: 0,
      message: "NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY not set",
    };
  }

  // A HEAD to the REST root is not realtime: it proved nothing about the socket
  // tier and Supabase answers it 401 anyway, so the panel reported "degraded"
  // while everything was fine. Joining a channel is the real signal.
  // "system:health" is on the public allow-list, so RLS cannot reject the join.
  let sb: ReturnType<typeof createClient> | null = null;
  try {
    sb = createClient(url, key, { auth: { persistSession: false } });
    const joined = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      const channel = sb!.channel("system:health", {
        config: { broadcast: { self: false } },
      });
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(true); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); resolve(false); }
      });
    });

    return {
      name: "realtime",
      status: joined ? "healthy" : "down",
      latencyMs: Date.now() - start,
      message: joined ? undefined : "Channel join failed or timed out",
    };
  } catch (err) {
    return {
      name: "realtime",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Connection failed",
    };
  } finally {
    try { await sb?.removeAllChannels(); } catch { /* ignore */ }
  }
}

async function checkAIEngine(): Promise<HealthCheck> {
  const start = Date.now();
  // The chat worker is what actually answers AI replies in production, so its
  // /api/health reports the live provider state instead of one hardcoded vendor.
  const workerUrl = process.env.CHAT_WORKER_URL ?? "https://zeal-chat.zeal666-app.workers.dev";

  try {
    const res = await fetch(`${workerUrl}/api/health`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return {
        name: "ai_provider",
        status: "down",
        latencyMs: Date.now() - start,
        message: `Chat worker HTTP ${res.status}`,
      };
    }

    const body = (await res.json().catch(() => null)) as {
      providers?: Record<string, unknown>;
    } | null;

    // Shape from the worker: { providers: { cloudflareAi: true, groqPro: true,
    // zhipu: false, keylessFallbacks: ["pollinations", ...] } }. The keyless
    // list is an array, so the `=== true` filter below skips it.
    const ready = Object.entries(body?.providers ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const keylessRaw = body?.providers?.keylessFallbacks;
    const fallbacks = Array.isArray(keylessRaw) ? keylessRaw.length : 0;

    if (ready.length === 0 && fallbacks === 0) {
      return {
        name: "ai_provider",
        status: "degraded",
        latencyMs: Date.now() - start,
        message: "Worker reports no configured providers",
      };
    }

    return {
      name: "ai_provider",
      status: ready.length > 0 ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      message: ready.length > 0
        ? `${ready.join(", ")} ready${fallbacks ? ` + ${fallbacks} keyless fallbacks` : ""}`
        : `Only ${fallbacks} keyless fallbacks ready`,
      details: { ready, fallbacks },
    };
  } catch (err) {
    return {
      name: "ai_provider",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Chat worker unreachable",
    };
  }
}

async function checkAdminBus(): Promise<HealthCheck> {
  const start = Date.now();
  // The worker is deployed regardless of what apps/web is configured to do, so
  // probe the known deployment and report ingest wiring separately — that was
  // the difference between "live panel works" and "panel silently empty".
  const workerUrl = process.env.ADMIN_BUS_URL ?? "https://zeal-admin-realtime.zeal666-app.workers.dev";

  try {
    const res = await fetch(`${workerUrl}/api/health`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return {
        name: "admin_bus",
        status: "down",
        latencyMs: Date.now() - start,
        message: `Admin bus HTTP ${res.status}`,
      };
    }

    const body = (await res.json().catch(() => null)) as { operators?: number } | null;
    const operators = typeof body?.operators === "number" ? body.operators : 0;

    if (!process.env.ADMIN_BUS_URL) {
      return {
        name: "admin_bus",
        status: "degraded",
        latencyMs: Date.now() - start,
        message: `Worker live (${operators} operator${operators === 1 ? "" : "s"}) but ADMIN_BUS_URL is unset, so nothing is ingesting`,
      };
    }

    return {
      name: "admin_bus",
      status: "healthy",
      latencyMs: Date.now() - start,
      message: `${operators} operator${operators === 1 ? "" : "s"} connected`,
    };
  } catch (err) {
    return {
      name: "admin_bus",
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Admin bus unreachable",
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
    // The worker serves /api/health; probing /health returned 404 and the panel
    // showed this as permanently degraded.
    const res = await fetch(`${workerUrl}/api/health`, {
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
  const CHECK_NAMES = ["database", "realtime", "ai_provider", "astro_worker", "admin_bus"] as const;
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkSupabaseRealtime(),
    checkAIEngine(),
    checkAstroWorker(),
    checkAdminBus(),
  ]);

  const results: HealthCheck[] = checks.map((c, i) => {
    if (c.status === "fulfilled") return c.value;
    return {
      name: CHECK_NAMES[i] ?? "unknown",
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
