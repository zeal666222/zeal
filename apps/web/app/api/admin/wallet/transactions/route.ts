import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Uuid = z.string().uuid();

interface TxRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
  referenceId: string | null;
  metadata: Record<string, unknown> | null;
}

// GET /api/admin/wallet/transactions?userId=<uuid>&limit=<n>
//
// Reads the ledger for the acting admin by default, or for an explicit target
// user. The wallet console needs the target form to show the ledger of whoever
// is being credited or debited.
export const GET = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  const url = new URL(req.url);
  const targetParam = url.searchParams.get("userId");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);

  let targetUserId = adminId;
  if (targetParam) {
    const parsed = Uuid.safeParse(targetParam);
    if (!parsed.success) {
      throw new AppError("userId must be a uuid", 400, ErrorCode.VALIDATION_INPUT);
    }
    targetUserId = parsed.data;
  }

  const wallet = await safeQueryOne<{ id: string }>(
    admin.from("Wallet").select("id").eq("userId", targetUserId).maybeSingle(),
    "admin.wallet.transactions.wallet",
  );
  if (!wallet) return NextResponse.json({ items: [], targetUserId, total: 0 });

  const items = await safeQuery<TxRow[]>(
    admin
      .from("Transaction")
      .select("id, type, amount, description, createdAt, referenceId, metadata")
      .eq("walletId", wallet.id)
      .order("createdAt", { ascending: false })
      .limit(limit),
    "admin.wallet.transactions.list",
  );

  return NextResponse.json({ items, targetUserId, total: items.length });
});
