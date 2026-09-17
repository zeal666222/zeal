import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new AppError("Conversation not found", 404, ErrorCode.NOT_FOUND);
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);
    }

    const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    const otherUser = await prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, name: true, username: true, avatar: true },
    });

    return NextResponse.json({ conversation, otherUser });
  },
);

