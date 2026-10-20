// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/reconciliation          — run every money-integrity check
// POST /api/admin/reconciliation         — recompute one wallet's pendingOut
// ───────────────────────────────────────────────────────────────────────────────
// The checks live in SQL (20261020180000_reconciliation.sql) because they are
// aggregates over the whole ledger; doing them here would mean pulling every
// transaction into Node. Two of them can only be answered by the database:
//   • a wallet's balance versus its signed ledger, transaction type by type;
//   • a settled booking versus the credit row /api/bookings/[id]/confirm writes.
//
// If the migration has not been applied yet the route says so, and falls back
// to check_billing_reconciliation() — which exists today — so the page still
// shows real numbers instead of inventing them.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { serverPublish } from "@/lib/realtime/server";
import { sendAdminBus } from "@/lib/realtime/admin-bus";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MIGRATION = "20261020180000_reconciliation.sql";

interface RpcError {
  message: string;
  code?: string;
}

/** Postgres has no such function: the migration has not been applied. */
function isMissingFunction(error: RpcError | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202"
    || error.code === "42883"
    || /function .* does not exist/i.test(error.message);
}

export interface ReconciliationItem {
  [key: string]: unknown;
}

export interface ReconciliationCheck {
  key: string;
  label: string;
  help: string;
  severity: "auto" | "review";
  count: number;
  total: number;
  items: ReconciliationItem[];
}

interface ReportShape {
  success?: boolean;
  error?: string;
  generatedAt?: string;
  scanned?: { wallets: number; bookings: number; transactions: number };
  checks?: ReconciliationCheck[];
}

function summarise(checks: ReconciliationCheck[]) {
  let total = 0;
  let auto = 0;
  let value = 0;
  for (const c of checks) {
    total += c.count;
    if (c.severity === "auto") auto += c.count;
    value += Math.abs(c.total);
  }
  return { total, autoCorrectable: auto, manualReview: total - auto, valueAtRisk: Math.round(value * 100) / 100 };
}

const PostSchema = z.object({
  walletId: z.string().uuid(),
});

export const GET = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 10), 200) : 50;

  const { data, error } = await admin.rpc("admin_reconciliation_report", {
    p_actor_id: adminId,
    p_limit: limit,
  });

  if (error && isMissingFunction(error)) {
    const { data: legacy, error: legacyErr } = await admin.rpc("check_billing_reconciliation");
    if (legacyErr || !legacy) {
      throw new AppError(
        `Reconciliation is unavailable: ${legacyErr?.message ?? error.message}`,
        503,
        ErrorCode.INTERNAL_DATABASE,
      );
    }
    const l = legacy as { wallet_drift?: number; missigned_rows?: number; open_discrepancies?: number };
    return NextResponse.json(
      {
        ok: true,
        degraded: MIGRATION,
        generatedAt: new Date().toISOString(),
        scanned: null,
        summary: {
          total: (l.wallet_drift ?? 0) + (l.missigned_rows ?? 0) + (l.open_discrepancies ?? 0),
          autoCorrectable: 0,
          manualReview: (l.wallet_drift ?? 0) + (l.missigned_rows ?? 0) + (l.open_discrepancies ?? 0),
          valueAtRisk: 0,
        },
        checks: [],
        legacy,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error) {
    throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE);
  }

  const report = data as ReportShape | null;
  if (!report || report.success === false) {
    throw new AppError(report?.error ?? "Reconciliation report failed", 500, ErrorCode.INTERNAL_DATABASE);
  }

  const checks = report.checks ?? [];
  return NextResponse.json(
    {
      ok: true,
      degraded: null,
      generatedAt: report.generatedAt,
      scanned: report.scanned,
      summary: summarise(checks),
      checks,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("walletId must be a uuid", 422, ErrorCode.VALIDATION_INPUT);
  }

  const { data, error } = await admin.rpc("admin_reconcile_pending_out", {
    p_wallet_id: parsed.data.walletId,
    p_actor_id: adminId,
  });
  if (error && isMissingFunction(error)) {
    throw new AppError(
      `Repair needs ${MIGRATION} applied first`,
      501,
      ErrorCode.INTERNAL_DATABASE,
    );
  }
  if (error) {
    throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE);
  }

  const result = data as { success?: boolean; error?: string; changed?: boolean; before?: number; after?: number } | null;
  if (!result || result.success === false) {
    throw new AppError(result?.error ?? "Repair failed", 422, ErrorCode.INTERNAL_DATABASE);
  }

  await logAdminAction(admin, {
    adminId,
    action: "RECONCILE_PENDING_OUT",
    targetType: "wallet",
    targetId: parsed.data.walletId,
    metadata: { changed: result.changed ?? false, before: result.before ?? null, after: result.after ?? null },
  });

  void serverPublish("admin:reconciliation", "reconciliation:updated", {
    type: "UPDATE",
    record: { walletId: parsed.data.walletId, changed: result.changed ?? false },
  });
  void sendAdminBus({
    kind: "reconciliation_repair",
    label: result.changed
      ? `Wallet ${parsed.data.walletId.slice(0, 8)} pendingOut recomputed (₹${result.before} → ₹${result.after})`
      : `Wallet ${parsed.data.walletId.slice(0, 8)} already consistent`,
    actor: adminId,
    meta: { walletId: parsed.data.walletId, before: result.before ?? null, after: result.after ?? null },
  });

  return NextResponse.json({ success: true, ...result });
});
