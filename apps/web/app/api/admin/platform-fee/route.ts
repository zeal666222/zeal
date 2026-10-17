import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

const DEFAULT_FEE = 10;

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;

  let feePercent = DEFAULT_FEE;
  try {
    const { redis } = await import("@/lib/cache");
    const cached = await redis.get<string>("platform_fee_percent");
    if (typeof cached === "string") {
      const parsed = parseFloat(cached);
      if (!Number.isNaN(parsed)) feePercent = parsed;
    }
  } catch { /* Redis optional */ }

  return NextResponse.json({ feePercent });
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { feePercent?: number };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const fee = Number(body.feePercent);
  if (!Number.isFinite(fee) || fee < 0 || fee > 50) {
    throw new AppError("Fee must be 0–50", 400, ErrorCode.VALIDATION_INPUT);
  }

  try {
    const { redis } = await import("@/lib/cache");
    await redis.set("platform_fee_percent", String(fee));
  } catch {
    throw new AppError("Cache unavailable", 503, ErrorCode.INTERNAL_SERVER);
  }

  await logAdminAction(admin, {
    adminId, action: "PLATFORM_FEE_UPDATE", targetType: "platform", metadata: { feePercent: fee },
  });

  return NextResponse.json({ feePercent: fee });
});
