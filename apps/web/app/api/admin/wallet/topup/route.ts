import {NextResponse} from "next/server";
import {requireAdminAPI, logAdminAction, hasAPIScope, type GuardSuccess} from "@/lib/auth/api-guard";
import {publishWalletBalance} from "@/lib/realtime/wallet";
import {z} from "zod";

export const dynamic = "force-dynamic";

// Manual wallet credit. Money-critical: the previous version credited the
// acting admin's own wallet (p_user_id: adminId). Now the operator must
// name the target user explicitly and the audit row records who did what
// to whom with IP + user-agent for compliance.
const TopupSchema = z.object({
  userId: z.string().uuid("userId must be the target user's uuid"),
  amount: z.number().positive().max(100_000),
  reason: z.string().trim().min(3).max(240).optional(),
  referenceId: z.string().trim().max(120).optional(),
});

function requestMeta(req: Request) {
  const headers = req.headers;
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    (headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
  const ua = headers.get("user-agent");
  return { ip, ua };
}

export async function POST(req: Request) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const g = guard;
  const {admin, userId: adminId} = g;

  // Scope gate — API keys must carry wallet:credit explicitly. Cookie/JWT
  // sessions bypass scope check (hasAPIScope returns true for them).
  if (!hasAPIScope(g as GuardSuccess, "wallet:credit")) {
    return NextResponse.json(
      { error: "API key missing scope wallet:credit", code: "SCOPE_DENIED" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }
  const parsed = TopupSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const { userId, amount, reason, referenceId } = parsed.data;
  const meta = requestMeta(req);

  // Resolve the target — must exist and be a USER (never silently credit an
  // unknown uuid; admin UIs can typo and it's their money on the line).
  const { data: target } = await admin
    .from("User")
    .select("id, email, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Target user not found", code: "TARGET_NOT_FOUND" }, { status: 404 });
  }

  const refId = referenceId ?? `admin-topup:${adminId}:${Date.now()}`;
  const description = reason
    ? `Admin credit: ${reason}`
    : `Manual wallet credit by ${adminId} (email ${admin.email ?? "?"})`;

  const {data, error} = await admin.rpc("credit_funds_safe", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_reference_id: refId,
  });
  if (error) {
    await logAdminAction(admin, {
      adminId, action: "WALLET_TOPUP_FAILED", targetType: "user", targetId: userId,
      metadata: { amount, error: error.message, ip: meta.ip, ua: meta.ua },
    });
    return NextResponse.json({error: error.message}, {status: 500});
  }

  const result = data as {success?: boolean; error?: string; balance?: number} | null;
  if (result && result.success === false) {
    await logAdminAction(admin, {
      adminId, action: "WALLET_TOPUP_REJECTED", targetType: "user", targetId: userId,
      metadata: { amount, error: result.error, ip: meta.ip, ua: meta.ua },
    });
    return NextResponse.json({error: result.error || "Top-up failed"}, {status: 500});
  }

  await logAdminAction(admin, {
    adminId, action: "WALLET_TOPUP", targetType: "user", targetId: userId,
    metadata: {
      amount, description, referenceId: refId, ip: meta.ip, ua: meta.ua,
      newBalance: result?.balance ?? null,
    },
  });

  const {data: wallet} = await admin.from("Wallet").select("*").eq("userId", userId).maybeSingle();
  void publishWalletBalance(userId);
  return NextResponse.json({ ok: true, targetUserId: userId, wallet, newBalance: result?.balance ?? null });
}
