import { NextResponse } from "next/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { redis } from "@/lib/cache";
import { z } from "zod";

const PLATFORM_FEE_KEY = "platform_fee_percent";
const DEFAULT_FEE = 10;

const FeeSchema = z.object({
  feePercent: z.number().min(0).max(50),
});

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin();
  let feePercent = DEFAULT_FEE;
  try {
    const cached = await redis.get<string>(PLATFORM_FEE_KEY);
    if (typeof cached === "string" && cached.length > 0) {
      const parsed = parseFloat(cached);
      if (!isNaN(parsed)) feePercent = parsed;
    } else {
      try { await redis.set(PLATFORM_FEE_KEY, String(DEFAULT_FEE)); } catch {}
    }
  } catch {}
  return NextResponse.json({ feePercent });
});

export const POST = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();

  const body = await req.json();
  const { feePercent } = FeeSchema.parse(body);

  try {
    await redis.set(PLATFORM_FEE_KEY, String(feePercent));
  } catch (err) {
    throw new AppError(
      "Cache unavailable — cannot update platform fee",
      503,
      ErrorCode.INTERNAL_SERVER,
    );
  }

  console.debug("[Admin] Platform fee updated to " + feePercent + "% by " + adminId);
  return NextResponse.json({ feePercent });
});

