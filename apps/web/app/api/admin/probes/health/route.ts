// GET /api/admin/probes/health — measured service health for the admin panels.
// Every number here is a real round trip: lib/monitoring/health-check.ts probes
// PostgREST, Supabase realtime, the AI provider chain and the astrology worker.
import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { runHealthChecks } from "@/lib/monitoring/health-check";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  database: "Database",
  realtime: "Realtime",
  ai_provider: "AI Engine",
  astro_worker: "Astro Worker",
  admin_bus: "Live admin bus",
};

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;

  const started = Date.now();
  const report = await runHealthChecks();
  const portalMs = Date.now() - started;

  return NextResponse.json({
    overall: report.status,
    timestamp: report.timestamp,
    uptimeSeconds: report.uptime,
    portalMs,
    services: report.checks.map((c) => ({
      key: c.name,
      label: LABELS[c.name] ?? c.name,
      status: c.status,
      latencyMs: c.latencyMs,
      message: c.message,
    })),
  });
});
