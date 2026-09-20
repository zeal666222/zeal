import {NextResponse} from "next/server";
import {requireAdminAPI, logAdminAction} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const {admin} = guard;

  const {data: consultants, error} = await admin
    .from("Consultant")
    .select(`
      id, category, specialties, bio, "perMinuteRate", status, "createdAt",
      "verificationDocs",
      user:User!Consultant_userId_fkey(id, name, email, username, avatar)
    `)
    .eq("status", "PENDING")
    .order("createdAt", {ascending: true});

  if (error) return NextResponse.json({error: error.message}, {status: 500});
  return NextResponse.json({consultants: consultants ?? []});
}

export async function POST(req: Request) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  let body: {consultantId?: string; action?: string; reason?: string};
  try { body = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }

  const {consultantId, action, reason} = body;
  if (!consultantId || !action || !["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({error: "Missing consultantId or invalid action"}, {status: 400});
  }

  const {data: rpcData, error: rpcError} = await admin.rpc("verify_consultant", {
    p_consultant_id: consultantId,
    p_admin_id: adminId,
    p_action: action,
    p_reason: reason ?? null,
  });

  if (rpcError) return NextResponse.json({error: rpcError.message}, {status: 500});
  const result = rpcData as {success?: boolean; error?: string} | null;
  if (result && result.success === false) {
    return NextResponse.json({error: result.error || "RPC failed"}, {status: 500});
  }

  // Sync app_metadata + write canonical audit
  try {
    const {data: consultantRow} = await admin
      .from("Consultant").select("userId").eq("id", consultantId).maybeSingle();

    if (consultantRow?.userId) {
      const newRole = action === "APPROVE" ? "CLIENT_ADMIN" : "USER";
      await admin.auth.admin.updateUserById(consultantRow.userId, {
        app_metadata: {role: newRole},
      });

      await admin.from("AdminAuditLog").insert({
        userId: adminId,
        action: "UPDATE",
        action_name: action === "APPROVE" ? "consultant_approve" : "consultant_reject",
        targetType: "consultant",
        targetId: consultantId,
        metadata: {newRole, reason: reason ?? null},
        success: true,
      } as never);
    }
  } catch (syncErr) {
    console.warn("[verification] role sync failed:", syncErr);
  }

  await logAdminAction(admin, {
    adminId,
    action: action === "APPROVE" ? "CONSULTANT_APPROVE" : "CONSULTANT_REJECT",
    targetType: "consultant",
    targetId: consultantId,
    metadata: {reason},
  });

  return NextResponse.json({success: true, action});
}
