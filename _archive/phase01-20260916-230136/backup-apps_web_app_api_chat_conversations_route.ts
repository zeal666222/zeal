import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const conversations = await prisma.$queryRaw<Array<{
    id: string;
    userAId: string;
    userBId: string;
    lastMessageAt: Date;
    lastMessageText: string | null;
  }>>`
    SELECT c.id, c."userAId", c."userBId", c."lastMessageAt", c."lastMessageText"
    FROM "Conversation" c
    WHERE c."userAId" = ${userId} OR c."userBId" = ${userId}
    ORDER BY c."lastMessageAt" DESC
    LIMIT 100
  `;

  const otherIds = conversations.map((c: any) => (c.userAId === userId ? c.userBId : c.userAId));
  const users = otherIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, name: true, username: true, avatar: true },
      })
    : [];

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const items = conversations.map((c: any) => {
    const otherId = c.userAId === userId ? c.userBId : c.userAId;
    return {
      id: c.id,
      otherUser: userMap.get(otherId) || null,
      lastMessageAt: c.lastMessageAt,
      lastMessageText: c.lastMessageText,
    };
  });

  return NextResponse.json({ items });
});

export const POST = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const body = await req.json();
  const { otherUserId } = body as { otherUserId?: string };
  if (!otherUserId || otherUserId === userId) {
    throw new AppError("Invalid otherUserId", 400, ErrorCode.VALIDATION_INPUT);
  }

  // Deterministic ordering without array destructuring (avoids noUncheckedIndexedAccess)
  const userAId = userId < otherUserId ? userId : otherUserId;
  const userBId = userId < otherUserId ? otherUserId : userId;

  const existing = await prisma.conversation.findFirst({
    where: { userAId, userBId },
  });
  if (existing) return NextResponse.json({ conversation: existing });

  const conversation = await prisma.conversation.create({
    data: { userAId, userBId },
  });

  return NextResponse.json({ conversation });
});
