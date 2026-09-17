import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { z } from "zod";

const CommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().optional(),
});

export const GET = withErrorHandler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: postId } = await params;
  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      author: { select: { id: true, username: true, name: true, avatar: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
      },
    },
  });
  return NextResponse.json({ comments });
});

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  const { id: postId } = await params;

  const body = await req.json();
  const { content, parentId } = CommentSchema.parse(body);

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new AppError("Post not found", 404, ErrorCode.NOT_FOUND);

  const comment = await prisma.comment.create({
    data: { content, postId, authorId: userId, parentId: parentId || null },
    include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
  });

  await prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

  return NextResponse.json({ comment });
});

