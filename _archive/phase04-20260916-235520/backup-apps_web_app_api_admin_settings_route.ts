import { NextResponse } from "next/server";
import { redis } from "@/lib/cache";
import { withErrorHandler } from "@/lib/errors";
import { requireRole } from "@/lib/auth/rbac";
import { audit, requestMeta } from "@/lib/audit";
import { z } from "zod";

const SettingsSchema = z.object({
  platformFeePercent: z.number().min(0).max(50).optional(),
  minimumWithdrawal: z.number().min(0).max(100000).optional(),
  maintenanceMode: z.boolean().optional(),
});

const KEYS = {
  platformFeePercent: "platform_fee_percent",
  minimumWithdrawal: "minimum_withdrawal",
  maintenanceMode: "maintenance_mode",
} as const;

export const GET = withErrorHandler(async () => {
  await requireRole("SUPER_ADMIN");

  const [fee, minW, maint] = await Promise.all([
    redis.get<string>(KEYS.platformFeePercent).catch(() => null),
    redis.get<string>(KEYS.minimumWithdrawal).catch(() => null),
    redis.get<string>(KEYS.maintenanceMode).catch(() => null),
  ]);

  return NextResponse.json({
    platformFeePercent: fee ? parseFloat(fee) : 10,
    minimumWithdrawal: minW ? parseFloat(minW) : 100,
    maintenanceMode: maint === "true",
  });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const actor = await requireRole("SUPER_ADMIN");
  const body = await req.json();
  const data = SettingsSchema.parse(body);

  if (data.platformFeePercent !== undefined) {
    await redis.set(KEYS.platformFeePercent, String(data.platformFeePercent));
  }
  if (data.minimumWithdrawal !== undefined) {
    await redis.set(KEYS.minimumWithdrawal, String(data.minimumWithdrawal));
  }
  if (data.maintenanceMode !== undefined) {
    await redis.set(KEYS.maintenanceMode, data.maintenanceMode ? "true" : "false");
  }

  const meta = requestMeta(req);
  await audit({
    userId: actor.userId,
    email: actor.email,
    action: "settings.update",
    targetType: "platform",
    metadata: data,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ success: true });
});

