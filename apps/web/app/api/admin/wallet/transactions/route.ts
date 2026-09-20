import {NextResponse} from "next/server";
import {requireAdminAPI} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  const {data: wallet} = await admin.from("Wallet").select("id").eq("userId", adminId).maybeSingle();
  if (!wallet) return NextResponse.json({items: []});

  const {data: items} = await admin
    .from("Transaction")
    .select("*")
    .eq("walletId", wallet.id)
    .order("createdAt", {ascending: false})
    .limit(limit);

  return NextResponse.json({items: items ?? []});
}
