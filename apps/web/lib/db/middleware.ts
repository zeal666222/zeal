// ═══════════════════════════════════════════════════════════════════════════════
// DB Pool Middleware — wraps API routes with connection pool monitoring
// ═══════════════════════════════════════════════════════════════════════════════
// Attach to Next.js API routes to automatically track DB connection health,
// log slow queries, and inject pool stats into response headers.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getPoolManager } from "./pool";
import { logger } from "@/lib/logger";

type RouteHandler = (
  req: Request,
  context?: unknown,
) => Promise<Response>;

interface MiddlewareOptions {
  /** Log slow queries above this threshold in ms. Default: 2000 */
  slowQueryThresholdMs?: number;
  /** Include pool stats in response headers. Default: true */
  includePoolHeaders?: boolean;
  /** Label for this route in logs. */
  label?: string;
}

/**
 * Wrap a Next.js route handler with DB pool monitoring.
 *
 * Usage:
 *   import { withPoolMonitoring } from "@/lib/db/middleware";
 *
 *   export const GET = withPoolMonitoring(
 *     async (req) => { ... },
 *     { label: "GET /api/users" }
 *   );
 */
export function withPoolMonitoring(
  handler: RouteHandler,
  options?: MiddlewareOptions,
): RouteHandler {
  const {
    slowQueryThresholdMs = 2000,
    includePoolHeaders = true,
    label = "unknown",
  } = options ?? {};

  return async (req: Request, context?: unknown): Promise<Response> => {
    const pool = getPoolManager();
    const startTime = Date.now();

    try {
      const response = await handler(req, context);
      const elapsed = Date.now() - startTime;

      // Log slow responses
      if (elapsed > slowQueryThresholdMs) {
        logger.warn("db", "slow_route", `${label} took ${elapsed}ms`, {
          route: label,
          elapsedMs: elapsed,
          method: req.method,
          url: req.url,
        });
      }

      // Inject pool stats headers
      if (includePoolHeaders) {
        const stats = pool.getStats();
        const headers = new Headers(response.headers);
        headers.set("X-Pool-Active", String(stats.active));
        headers.set("X-Pool-Idle", String(stats.idle));
        headers.set("X-Pool-Waiting", String(stats.waiting));
        headers.set("X-Pool-Utilization", `${pool.getUtilization()}%`);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }

      return response;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      logger.error("db", "route_error", `${label} failed after ${elapsed}ms`, err, {
        route: label,
        elapsedMs: elapsed,
        method: req.method,
        url: req.url,
      });
      throw err;
    }
  };
}

/**
 * Create a health check endpoint for the DB pool.
 */
export function createPoolHealthHandler(): RouteHandler {
  return async () => {
    const pool = getPoolManager();
    const stats = pool.getStats();
    const healthy = pool.isHealthy();

    return NextResponse.json(
      {
        healthy,
        pool: stats,
        utilization: `${pool.getUtilization()}%`,
      },
      { status: healthy ? 200 : 503 },
    );
  };
}
