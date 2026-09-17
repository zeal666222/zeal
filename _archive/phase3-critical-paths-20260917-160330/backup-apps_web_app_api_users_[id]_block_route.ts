import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const POST = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const me = await getUserId();
    if (!me) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id: targetId } = await params;
    if (targetId === me) throw new AppError("Cannot block yourself", 400, ErrorCode.VALIDATION_INPUT);

    const exists = await prisma.userActivity.findFirst({
      where: { userId: me, consultantId: targetId, type: "block" },
    });
    if (!exists) {
      await prisma.userActivity.create({
        data: { userId: me, consultantId: targetId, type: "block" },
      });
    }
    return NextResponse.json({ blocked: true });
  },
);

export const DELETE = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const me = await getUserId();
    if (!me) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id: targetId } = await params;

    await prisma.userActivity.deleteMany({
      where: { userId: me, consultantId: targetId, type: "block" },
    });
    return NextResponse.json({ blocked: false });
  },
);

