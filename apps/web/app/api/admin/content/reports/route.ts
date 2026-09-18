// apps/web/app/api/admin/content/reports/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireRole } from "@/lib/auth/rbac";
import { audit, requestMeta } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface PostRow {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  createdAt: string;
  author: { id: string; name: string | null; username: string; avatar: string | null } | null;
}

export const GET = withErrorHandler(async () => {
  await requireRole("SUPPORT");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Post")
    .select(`
      id, content, "mediaUrls", "createdAt",
      author:User!Post_authorId_fkey(id, name, username, avatar)
    `)
    .eq("isFlagged", true)
    .order("createdAt", { ascending: false })
    .limit(200);

  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);

  const items: PostRow[] = ((data ?? []) as Array<{
    id: string;
    content: string;
    mediaUrls: string[] | null;
    createdAt: string;
    author: PostRow["author"] | PostRow["author"][];
  }>).map((p) => ({
    id: p.id,
    content: p.content,
    mediaUrls: p.mediaUrls ?? null,
    createdAt: p.createdAt,
    author: Array.isArray(p.author) ? (p.author[0] ?? null) : (p.author ?? null),
  }));

  return NextResponse.json({ items });
});

export const POST = withErrorHandler(async (req: Request) => {
  const actor = await requireRole("SUPPORT");

  let body: { postId?: string; action?: "dismiss" | "delete" };
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { postId, action } = body;
  if (!postId || !action || !["dismiss", "delete"].includes(action)) {
    throw new AppError("Invalid postId or action", 400, ErrorCode.VALIDATION_INPUT);
  }

  const admin = createAdminClient();

  if (action === "delete") {
    const { error } = await admin.from("Post").delete().eq("id", postId);
    if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  } else {
    const { error } = await admin.from("Post").update({ isFlagged: false }).eq("id", postId);
    if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
  }

  const meta = requestMeta(req);
  await audit({
    userId: actor.userId,
    email: actor.email,
    action: action === "delete" ? "content.delete_post" : "content.dismiss_report",
    targetType: "post",
    targetId: postId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    success: true,
  });

  return NextResponse.json({ success: true, action });
});
