import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    platformFeePercent: 10,
    minimumWithdrawal: 100,
    maintenanceMode: false,
  });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  await logAdminAction(admin, {
    adminId, action: "SETTINGS_UPDATE", targetType: "platform", metadata: body,
  });

  return NextResponse.json({ success: true, applied: body });
});
