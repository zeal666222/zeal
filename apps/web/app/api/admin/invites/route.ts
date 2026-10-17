import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery } from "@/lib/infra/guards";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["VIEWER", "SUPPORT", "ADMIN", "SUPER_ADMIN"] as const;

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId, email: adminEmail } = guard;

  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const email = (body.email || "").toLowerCase().trim();
  const role = body.role;

  if (!email || !email.includes("@")) throw new AppError("Invalid email", 400, ErrorCode.VALIDATION_INPUT);
  if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    throw new AppError("Invalid role", 400, ErrorCode.VALIDATION_INPUT);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  await safeQuery(
    admin.from("AdminInvite").update({ revokedAt: new Date().toISOString() })
      .eq("email", email).is("acceptedAt", null).is("revokedAt", null),
    "admin.invites.revoke-previous",
  );

  await safeQuery(
    admin.from("AdminInvite").insert({ email, role, tokenHash, invitedBy: adminId, expiresAt }),
    "admin.invites.insert",
  );

  await logAdminAction(admin, {
    adminId, action: "INVITE_CREATE", targetType: "admin_invite", targetId: email, metadata: { role },
  });

  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";
  return NextResponse.json({ success: true, inviteUrl: `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`, expiresAt, invitedBy: adminEmail });
});
