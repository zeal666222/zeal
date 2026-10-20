import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/admin/auth/api-guard";
import { sendAdminBus } from "@/lib/realtime/admin-bus";

export const dynamic = "force-dynamic";

// RPC error codes -> copy an admin can act on.
const RPC_ERRORS: Record<string, string> = {
  forbidden: "Your role cannot approve pricing changes.",
  request_not_found: "This request no longer exists. Reload the queue.",
  not_pending: "Someone already decided this request. Reload the queue.",
  reason_too_short: "A rejection needs at least 10 characters of reason.",
  internal_error: "The database refused the change. Try again in a moment.",
};

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
      consultant:Consultant!consultantId(
        id, category, "perMinuteRate", "chatRate", "audioRate", "videoRate",
        user:User!userId(id, name, email, avatar_url)
      ),
      requester:User!requestedBy(id, name, email)
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
  // The RPC takes a uuid; an arbitrary client string would otherwise come back
  // as a 500 from Postgres instead of a clean 400.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return NextResponse.json({ error: "Invalid requestId" }, { status: 400 });
  }

  const rpc = action === "APPROVE" ? "approve_pricing_change" : "reject_pricing_change";
  const args = action === "APPROVE"
    ? { p_request_id: requestId, p_note: reason ?? null, p_actor_id: adminId }
    : { p_request_id: requestId, p_reason: reason ?? "", p_actor_id: adminId };

  const { data, error } = await admin.rpc(rpc, args);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    const code = result.error ?? "";
    const message = RPC_ERRORS[code] ?? "The decision could not be recorded. Reload the queue and try again.";
    return NextResponse.json({ error: message, code }, { status: code === "forbidden" ? 403 : 400 });
  }

  await logAdminAction(admin, {
    adminId,
    action: `PRICING_${action}`,
    targetType: "pricing_request",
    targetId: requestId,
    metadata: { reason },
  });

  void sendAdminBus({
    kind: action === "APPROVE" ? "pricing_approved" : "pricing_rejected",
    label: `Pricing request ${requestId.slice(0, 8)} ${action === "APPROVE" ? "approved" : "rejected"}`,
    actor: adminId,
    meta: { requestId, reason: reason ?? null },
  });

  return NextResponse.json(data);
}
