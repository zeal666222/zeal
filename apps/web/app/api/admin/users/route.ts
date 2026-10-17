import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = ["VERIFY", "UNVERIFY", "PROMOTE_ADMIN", "DEMOTE", "BAN", "UNBAN"] as const;

export const GET = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const role = url.searchParams.get("role");
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const from = (page - 1) * limit;

  let q = admin
    .from("User")
    .select("id, email, username, name, avatar, role, sparks, isVerified, is_online, createdAt", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(from, from + limit - 1);

  if (role) q = q.eq("role", role);
  if (search) q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%,username.ilike.%${search}%`);

  const { data, error, count } = await q;
  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE, { context: "admin.users.list" });

  return NextResponse.json({
    users: data ?? [],
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { userId?: string; action?: string };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { userId, action } = body;
  if (!userId || !action || !ALLOWED_ACTIONS.includes(action as typeof ALLOWED_ACTIONS[number])) {
    throw new AppError("Invalid userId or action", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (userId === adminId && action === "DEMOTE") {
    throw new AppError("Cannot demote yourself", 400, ErrorCode.AUTH_FORBIDDEN);
  }

  let update: Record<string, unknown> = {};
  switch (action) {
    case "VERIFY": update = { isVerified: true }; break;
    case "UNVERIFY": update = { isVerified: false }; break;
    case "PROMOTE_ADMIN": update = { role: "ADMIN" }; break;
    case "DEMOTE": update = { role: "USER" }; break;
    case "BAN": update = { isVerified: false }; break;
    case "UNBAN": update = { isVerified: true }; break;
  }

  const result = await safeQuery<{ id: string; role: string; isVerified: boolean }>(
    admin.from("User").update(update).eq("id", userId).select("id, role, isVerified").single(),
    "admin.users.update",
  );

  if (["PROMOTE_ADMIN", "DEMOTE", "BAN", "UNBAN"].includes(action)) {
    try {
      const meta: Record<string, unknown> = {};
      if (action === "PROMOTE_ADMIN") meta.role = "ADMIN";
      else meta.role = "USER";

      const authPayload: Record<string, unknown> = { app_metadata: meta };
      if (action === "BAN") authPayload.ban_duration = "876000h";
      if (action === "UNBAN") authPayload.ban_duration = "none";

      await admin.auth.admin.updateUserById(userId, authPayload);

      await admin.from("AdminAuditLog").insert({
        userId: adminId, action: "UPDATE",
        action_name: `user_${action.toLowerCase()}`,
        targetType: "user", targetId: userId,
        metadata: { role: meta.role ?? null, action }, success: true,
      } as never);
    } catch (syncErr) {
      console.warn("[admin/users] role sync failed:", syncErr);
    }
  }

  await logAdminAction(admin, { adminId, action, targetType: "user", targetId: userId });

  return NextResponse.json({ user: result, action });
});
