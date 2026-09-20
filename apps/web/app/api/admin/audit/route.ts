import {NextResponse} from "next/server";
import {requireAdminAPI} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const {admin} = guard;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

  let q = admin.from("AdminAuditLog").select("*").order("createdAt", {ascending: false}).limit(limit);
  if (action) q = q.eq("action", action);

  const {data, error} = await q;
  if (error) return NextResponse.json({error: error.message}, {status: 500});
  return NextResponse.json({items: data ?? []});
}
