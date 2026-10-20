import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne, rpcWithLiveSignatures, isMissingFunctionError } from "@/lib/infra/guards";
import { createServerClientFromCookies } from "@zeal/database/server";
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(consultantId)) {
    throw new AppError("Missing consultantId or invalid action", 400, ErrorCode.VALIDATION_INPUT);
  }

  // Production only exposes verify_consultant(p_consultant_id uuid), so the four
  // argument call answers 404 and the button is dead. That function authorises
  // through auth_is_admin(), which reads the "User" row of auth.uid() — NULL on
  // the service-role client, so it refuses every admin request made this way.
  // The wide shape is tried first because 20261020160000_rpc_alignment.sql
  // installs it with an explicit actor and a reason; the fallback reviews on the
  // admin's own session, where auth.uid() resolves. Rejection has no function to
  // call at all, so it is an explicit status write, guarded by the pending state
  // so two admins can't both record a decision.
  const { data, error } = await rpcWithLiveSignatures<{ success?: boolean; error?: string }>(
    "verify_consultant",
    [
      () => admin.rpc("verify_consultant", {
        p_consultant_id: consultantId, p_admin_id: adminId, p_action: action, p_reason: reason ?? null,
      }),
      async () => {
        if (action === "REJECT") {
          const { data: rows, error: writeErr } = await admin
            .from("Consultant")
            .update({ status: "REJECTED", isVerified: false, updatedAt: new Date().toISOString() })
            .eq("id", consultantId)
            .eq("status", "PENDING")
            .select("id");
          if (writeErr) return { data: null, error: writeErr };
          const settled = (rows ?? []).length > 0;
          return { data: { success: settled, error: settled ? undefined : "not_pending" }, error: null };
        }
        const session = await createServerClientFromCookies();
        return session.rpc("verify_consultant", { p_consultant_id: consultantId });
      },
    ],
  );

  if (isMissingFunctionError(error)) {
    throw new AppError(
      "Consultant review needs 20261020160000_rpc_alignment.sql applied",
      501, ErrorCode.INTERNAL_DATABASE,
    );
  }
  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE);

  const outcome = data as { success?: boolean; error?: string } | null;
  if (outcome?.success === false) {
    if (outcome.error === "not_pending") {
      throw new AppError("This consultant is no longer awaiting review", 404, ErrorCode.NOT_FOUND);
    }
    if (outcome.error === "forbidden") {
      throw new AppError(
        "The database refused this review decision: the live verify_consultant checks the signed-in user's role in the User table, so sign in again as an admin — or apply 20261020160000_rpc_alignment.sql to record the acting admin explicitly.",
        403, ErrorCode.AUTH_FORBIDDEN,
      );
    }
    throw new AppError(outcome.error || "RPC failed", 500, ErrorCode.INTERNAL_DATABASE);
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
