import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "40"), 200);

  const cheers = await prisma.cheer.findMany({
    where: { post: { authorId: userId } },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
      post: { select: { id: true, content: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const activities = cheers.map((c: any) => ({
    id: c.id,
    type: "cheer" as const,
    actor: { id: c.user.id, username: c.user.username, avatar: c.user.avatar },
    target: { id: c.post.id, content: c.post.content },
    sparksEarned: 2,
    createdAt: c.createdAt,
  }));

  return NextResponse.json(activities);
});

