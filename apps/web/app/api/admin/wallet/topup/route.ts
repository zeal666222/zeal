import {NextResponse} from "next/server";
import {requireAdminAPI, logAdminAction} from "@/lib/auth/api-guard";
import {z} from "zod";

export const dynamic = "force-dynamic";

const TopupSchema = z.object({amount: z.number().positive().max(100000)});

export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }
  const parsed = TopupSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error: "Invalid amount"}, {status: 422});

  const {amount} = parsed.data;

  const {data, error} = await admin.rpc("credit_funds_safe", {
    p_user_id: adminId,
    p_amount: amount,
    p_description: `Admin top-up by ${adminId}`,
    p_reference_id: `admin-topup:${Date.now()}`,
  });
  if (error) return NextResponse.json({error: error.message}, {status: 500});

  const result = data as {success?: boolean; error?: string} | null;
  if (result && result.success === false) {
    return NextResponse.json({error: result.error || "Top-up failed"}, {status: 500});
  }

  await logAdminAction(admin, {
    adminId, action: "WALLET_TOPUP", targetType: "wallet", targetId: adminId, metadata: {amount},
  });

  const {data: wallet} = await admin.from("Wallet").select("*").eq("userId", adminId).maybeSingle();
  return NextResponse.json({wallet});
}
