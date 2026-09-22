import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "PENDING";

  const { data, error } = await admin
    .from("PricingChangeRequest")
    .select(`
      *,
      consultant:Consultant!PricingChangeRequest_consultantId_fkey(
        id, category, "perMinuteRate", "chatRate", "audioRate", "videoRate",
        user:User!Consultant_userId_fkey(id, name, email, avatar_url)
      ),
      requester:User!PricingChangeRequest_requestedBy_fkey(id, name, email)
    `)
    .eq("status", status)
    .order("createdAt", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { requestId?: string; action?: "APPROVE" | "REJECT"; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { requestId, action, reason } = body;
  if (!requestId || (action !== "APPROVE" && action !== "REJECT")) {
    return NextResponse.json({ error: "Invalid requestId or action" }, { status: 400 });
  }

  const rpc = action === "APPROVE" ? "approve_pricing_change" : "reject_pricing_change";
  const args = action === "APPROVE"
    ? { p_request_id: requestId, p_note: reason ?? null }
    : { p_request_id: requestId, p_reason: reason ?? "" };

  const { data, error } = await admin.rpc(rpc, args);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(admin, {
    adminId,
    action: `PRICING_${action}`,
    targetType: "pricing_request",
    targetId: requestId,
    metadata: { reason },
  });

  return NextResponse.json(data);
}
