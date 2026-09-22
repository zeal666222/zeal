// ═══════════════════════════════════════════════════════════════════════════════
// GET  /api/ai/health  — provider health snapshot (ADMIN+)
// POST /api/ai/health  — reset all circuit breakers (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import {
  allGateStats,
  allLimiterSnapshots,
  allBreakerHealth,
  resetAllBreakers,
} from "@/lib/ai/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    gates: allGateStats(),
    limiters: allLimiterSnapshots(),
    breakers: allBreakerHealth(),
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;

  resetAllBreakers();
  return NextResponse.json({
    success: true,
    message: "All circuit breakers reset",
    timestamp: new Date().toISOString(),
  });
}
