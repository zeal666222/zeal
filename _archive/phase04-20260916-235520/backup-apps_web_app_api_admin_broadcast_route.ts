import { NextResponse } from "next/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin, logAdminAction } from "@/lib/auth/admin";
import { NotificationService } from "@/lib/notifications/service";
import { z } from "zod";

const BroadcastSchema = z.object({
  message: z.string().min(1).max(500),
  segment: z.enum(["all", "consultants", "users"]).default("all"),
});

export const POST = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();

  const body = await req.json();
  const { message, segment } = BroadcastSchema.parse(body);

  if (!message.trim()) {
    throw new AppError("Message required", 400, ErrorCode.VALIDATION_INPUT);
  }

  const result = await NotificationService.broadcast({
    message,
    type: "system",
    actorId: adminId,
    segment,
  });

  await logAdminAction({
    adminId,
    action: "BROADCAST",
    targetType: "segment",
    targetId: segment,
    metadata: { message, sent: result.sent },
  });

  return NextResponse.json({ sent: result.sent, segment });
});

// BATCH3_APPLIED
