import {NextResponse} from "next/server";
import {requireAdminAPI} from "@/lib/auth/api-guard";
import {createAdminClient} from "@zeal/database/server";
import {snapshotAi} from "@/lib/monitoring/ai-metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Live operations snapshot for /admin/operations: AI engine metrics from the
// in-process ring buffer, a direct database probe, the chat worker's health
// endpoint, and the newest admin-audit entries as the ops activity feed.
export async function GET() {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const t0 = Date.now();

  // ─── Database probe ─────────────────────────────────────────────────────
  const dbStart = Date.now();
  let db: { status: "ok" | "down"; latencyMs: number; error?: string };
  try {
    const probe = createAdminClient();
    const {error} = await probe.from("User").select("id", {count: "exact", head: true}).limit(1);
    db = error
      ? {status: "down", latencyMs: Date.now() - dbStart, error: error.message}
      : {status: "ok", latencyMs: Date.now() - dbStart};
  } catch (err) {
    db = {
      status: "down",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "probe failed",
    };
  }

  // ─── Chat worker probe ──────────────────────────────────────────────────
  const workerBase = process.env.CHAT_WORKER_URL;
  let worker: {
    configured: boolean;
    status: "ok" | "down" | "unconfigured";
    latencyMs: number;
    error?: string;
    detail?: unknown;
  } = {configured: !!workerBase, status: "unconfigured", latencyMs: 0};
  if (workerBase) {
    const wStart = Date.now();
    try {
      const res = await fetch(`${workerBase.replace(/\/+$/, "")}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      let detail: unknown;
      try { detail = await res.json(); } catch { /* non-JSON health is fine */ }
      worker = {
        configured: true,
        status: res.ok ? "ok" : "down",
        latencyMs: Date.now() - wStart,
        detail,
      };
    } catch (err) {
      worker = {
        configured: true,
        status: "down",
        latencyMs: Date.now() - wStart,
        error: err instanceof Error ? err.message : "worker unreachable",
      };
    }
  }

  // ─── Recent admin audit entries (ops feed) ──────────────────────────────
  const {data: audit} = await guard.admin
    .from("AdminAuditLog")
    .select("id, action_name, actor_email, actor_role, target_type, target_id, success, created_at")
    .order("created_at", {ascending: false})
    .limit(20);

  return NextResponse.json(
    {
      ts: new Date().toISOString(),
      tookMs: Date.now() - t0,
      ai: snapshotAi(),
      db,
      worker,
      audit: audit ?? [],
    },
    {headers: {"Cache-Control": "no-store"}},
  );
}
