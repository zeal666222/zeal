import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { serverPublish } from "@/lib/realtime/server";
import { z } from "zod";

const SendSchema = z.object({
  content: z.string().min(1).max(2000),
});

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

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    return NextResponse.json({ messages });
  },
);

export const POST = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new AppError("Conversation not found", 404, ErrorCode.NOT_FOUND);
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);
    }

    const body = await req.json();
    const { content } = SendSchema.parse(body);

    const message = await prisma.chatMessage.create({
      data: { conversationId: id, senderId: userId, content },
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessageText: content,
        updatedAt: new Date(),
      },
    });

    // Notify the OTHER participant
    const recipientId =
      conversation.userAId === userId ? conversation.userBId : conversation.userAId;

    await serverPublish("chat:" + id, "message:new", {
      conversationId: id,
      messageId: message.id,
      senderId: userId,
    });

    await serverPublish("user:" + recipientId, "message:new", {
      conversationId: id,
      messageId: message.id,
      senderId: userId,
      preview: content.slice(0, 80),
    });

    return NextResponse.json({ message });
  },
);

