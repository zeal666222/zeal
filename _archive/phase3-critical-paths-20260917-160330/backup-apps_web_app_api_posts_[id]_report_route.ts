import { NextResponse } from "next/server";
import { prisma } from "@zeal/database/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { z } from "zod";

const ReportSchema = z.object({
  reason: z.enum(["spam", "harassment", "misinformation", "inappropriate", "other"]),
  note: z.string().max(500).optional(),
});

export const POST = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id: postId } = await params;

    const body = await req.json();
    const { reason, note } = ReportSchema.parse(body);

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new AppError("Post not found", 404, ErrorCode.NOT_FOUND);

    await prisma.post.update({
      where: { id: postId },
      data: { isFlagged: true },
    });

    // Log the report as a system notification for admins (best-effort)
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: "system",
          message: "[REPORT] Post " + postId + ": " + reason + (note ? " — " + note : ""),
          actorId: userId,
          read: true,
        },
      });
    } catch { /* ignore */ }

    return NextResponse.json({ success: true });
  },
);

