import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne, safeRpc } from "@/lib/infra/guards";
import { sendAdminBus } from "@/lib/realtime/admin-bus";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const consultants = await safeQuery(
    admin.from("Consultant")
      .select(`id, category, specialties, bio, "perMinuteRate", status, "createdAt", "verificationDocs",
        user:User!userId(id, name, email, username, avatar)`)
      .eq("status", "PENDING")
      .order("createdAt", { ascending: true }),
    "admin.verification.pending",
  );

  return NextResponse.json({ consultants: consultants ?? [] });
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { consultantId?: string; action?: string; reason?: string };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { consultantId, action, reason } = body;
  if (!consultantId || !action || !["APPROVE", "REJECT"].includes(action)) {
    throw new AppError("Missing consultantId or invalid action", 400, ErrorCode.VALIDATION_INPUT);
  }

  const rpcData = await safeRpc<{ success?: boolean; error?: string }>(
    admin.rpc("verify_consultant", { p_consultant_id: consultantId, p_admin_id: adminId, p_action: action, p_reason: reason ?? null }),
    "admin.verification.verify",
  );

  if (rpcData?.success === false) {
    throw new AppError(rpcData.error || "RPC failed", 500, ErrorCode.INTERNAL_DATABASE);
  }

  try {
    const consultantRow = await safeQueryOne<{ userId: string }>(
      admin.from("Consultant").select("userId").eq("id", consultantId).maybeSingle(),
      "admin.verification.lookup",
    );

    if (consultantRow?.userId) {
      const newRole = action === "APPROVE" ? "CLIENT_ADMIN" : "USER";
      await admin.auth.admin.updateUserById(consultantRow.userId, { app_metadata: { role: newRole } });

      await admin.from("AdminAuditLog").insert({
        userId: adminId, action: "UPDATE",
        action_name: action === "APPROVE" ? "consultant_approve" : "consultant_reject",
        targetType: "consultant", targetId: consultantId,
        metadata: { newRole, reason: reason ?? null }, success: true,
      } as never);
    }
  } catch (syncErr) {
    console.warn("[verification] role sync failed:", syncErr);
  }

  await logAdminAction(admin, {
    adminId, action: action === "APPROVE" ? "CONSULTANT_APPROVE" : "CONSULTANT_REJECT",
    targetType: "consultant", targetId: consultantId, metadata: { reason },
  });

  void sendAdminBus({
    kind: action === "APPROVE" ? "consultant_verified" : "consultant_rejected",
    label: `Consultant ${consultantId.slice(0, 8)} ${action === "APPROVE" ? "approved" : "rejected"}`,
    actor: adminId,
    meta: { consultantId, reason: reason ?? null },
  });

  return NextResponse.json({ success: true, action });
});
