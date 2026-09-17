import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, username: true, name: true, avatar: true } },
      _count: { select: { cheers: true, comments: true } },
    },
  });
  if (!post) throw new AppError("Post not found", 404, ErrorCode.NOT_FOUND);
  return NextResponse.json({
    post: {
      id: post.id,
      content: post.content,
      imageUrl: post.mediaUrls?.[0] || null,
      author: post.author,
      cheerCount: post._count.cheers,
      commentCount: post._count.comments,
      shareCount: post.shareCount,
      createdAt: post.createdAt,
    },
  });
});

