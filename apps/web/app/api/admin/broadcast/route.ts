import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { message?: string; segment?: string };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const message = (body.message || "").trim();
  const segment = body.segment || "all";

  if (!message || message.length > 500) {
    throw new AppError("Message required (max 500 chars)", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (!["all", "users", "consultants"].includes(segment)) {
    throw new AppError("Invalid segment", 400, ErrorCode.VALIDATION_INPUT);
  }

  let userIds: string[] = [];

  if (segment === "consultants") {
    const data = await safeQuery<Array<{ userId: string }>>(
      admin.from("Consultant").select("userId").eq("status", "VERIFIED").limit(5000),
      "broadcast.consultants",
    );
    userIds = (data ?? []).map((c) => c.userId);
  } else if (segment === "users") {
    const data = await safeQuery<Array<{ id: string }>>(
      admin.from("User").select("id").eq("role", "USER").limit(5000),
      "broadcast.users",
    );
    userIds = (data ?? []).map((u) => u.id);
  } else {
    const data = await safeQuery<Array<{ id: string }>>(
      admin.from("User").select("id").limit(5000),
      "broadcast.all",
    );
    userIds = (data ?? []).map((u) => u.id);
  }

  if (userIds.length === 0) return NextResponse.json({ sent: 0, segment });

  const rows = userIds.map((userId) => ({ userId, type: "system", message, actorId: adminId, read: false }));

  await safeQuery(admin.from("Notification").insert(rows), "broadcast.insert");

  await logAdminAction(admin, {
    adminId, action: "BROADCAST", targetType: "segment", targetId: segment,
    metadata: { message: message.slice(0, 100), sent: userIds.length },
  });

  return NextResponse.json({ sent: userIds.length, segment });
});
