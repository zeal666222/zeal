import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction, hasAPIScope, type GuardSuccess } from "@/lib/auth/api-guard";
import { publishWalletBalance } from "@/lib/realtime/wallet";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Manual wallet debit. Money-critical mirror of the topup route:
//   • target user is explicit, validated uuid, must exist
//   • API-key callers need the `wallet:debit` scope
//   • audit row records who debited whom, amount, IP, UA, prior/new balance
//   • insufficient-balance is surfaced as 402 (not swallowed as a 200)
const DebitSchema = z.object({
  userId: z.string().uuid("userId must be the target user's uuid"),
  amount: z.number().positive().max(100_000),
  reason: z.string().trim().min(3).max(240),
  referenceId: z.string().trim().max(120).optional(),
});

function requestMeta(req: Request) {
  const h = req.headers;
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    (h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
  return { ip, ua: h.get("user-agent") };
}

export async function POST(req: Request) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const g = guard as GuardSuccess;

  if (!hasAPIScope(g, "wallet:debit")) {
    return NextResponse.json(
      { error: "API key missing scope wallet:debit", code: "SCOPE_DENIED" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = DebitSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const { userId, amount, reason, referenceId } = parsed.data;
  const meta = requestMeta(req);

  const { data: target } = await g.admin
    .from("User")
    .select("id, email, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Target user not found", code: "TARGET_NOT_FOUND" }, { status: 404 });
  }

  const refId = referenceId ?? `admin-debit:${g.userId}:${Date.now()}`;
  const description = `Admin debit: ${reason}`;

  const { data: prior } = await g.admin
    .from("Wallet").select("balance").eq("userId", userId).maybeSingle();
  const balanceBefore = (prior as { balance?: number } | null)?.balance ?? null;

  const { data, error } = await g.admin.rpc("process_wallet_deduction_safe", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_reference_id: refId,
  });

  if (error) {
    await logAdminAction(g.admin, {
      adminId: g.userId, action: "WALLET_DEBIT_FAILED", targetType: "user", targetId: userId,
      metadata: { amount, error: error.message, ip: meta.ip, ua: meta.ua, balanceBefore },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as
    | { success?: boolean; error?: string; code?: string; balance?: number }
    | null;

  if (result && result.success === false) {
    await logAdminAction(g.admin, {
      adminId: g.userId, action: "WALLET_DEBIT_REJECTED", targetType: "user", targetId: userId,
      metadata: { amount, error: result.error, code: result.code, ip: meta.ip, ua: meta.ua, balanceBefore },
    });
    const status = result.code === "INSUFFICIENT_FUNDS" ? 402 : 500;
    return NextResponse.json(
      { error: result.error || "Debit failed", code: result.code ?? null },
      { status },
    );
  }

  await logAdminAction(g.admin, {
    adminId: g.userId, action: "WALLET_DEBIT", targetType: "user", targetId: userId,
    metadata: {
      amount, description, referenceId: refId, ip: meta.ip, ua: meta.ua,
      balanceBefore, balanceAfter: result?.balance ?? null,
    },
  });

  const { data: wallet } = await g.admin.from("Wallet").select("*").eq("userId", userId).maybeSingle();
  void publishWalletBalance(userId);
  return NextResponse.json({
    ok: true, targetUserId: userId, wallet,
    balanceBefore, newBalance: result?.balance ?? null,
  });
}
