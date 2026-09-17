import { NextResponse } from "next/server";
import { prisma, withTransaction } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { audit, requestMeta } from "@/lib/audit";

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const body = await req.json().catch(() => ({}));
  const confirmation = (body as { confirmation?: string }).confirmation;
  if (confirmation !== "DELETE") {
    throw new AppError("Type DELETE to confirm", 400, ErrorCode.VALIDATION_INPUT);
  }

  await withTransaction(async (tx: any) => {
    await tx.notification.deleteMany({ where: { userId } });
    await tx.cheer.deleteMany({ where: { userId } });
    await tx.comment.deleteMany({ where: { authorId: userId } });
    await tx.post.deleteMany({ where: { authorId: userId } });
    await tx.callSession.deleteMany({ where: { userId } });
    await tx.booking.deleteMany({ where: { userId } });
    await tx.transaction.deleteMany({ where: { wallet: { userId } } });
    await tx.wallet.deleteMany({ where: { userId } });
    await tx.consultant.deleteMany({ where: { userId } });
    await tx.userActivity.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  const meta = requestMeta(req);
  await audit({
    userId,
    action: "user.self_delete",
    targetType: "user",
    targetId: userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    success: true,
  });

  return NextResponse.json({ success: true });
});

