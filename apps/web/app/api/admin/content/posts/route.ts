import {NextResponse} from "next/server";
import {requireAdminAPI, logAdminAction} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

const POST_SELECT = 'id, content, "mediaUrls", "isFlagged", "isArchived", "cheerCount", "commentCount", "createdAt", "updatedAt", author:User!authorId(id, name, username, avatar)';

export async function GET(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const filter = url.searchParams.get("filter") || "all"; // all | flagged | archived
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(5, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));

  let query = guard.admin
    .from("Post")
    .select(POST_SELECT, {count: "exact"});

  if (filter === "flagged") query = query.eq("isFlagged", true);
  else if (filter === "archived") query = query.eq("isArchived", true);
  else query = query.eq("isArchived", false);

  // PostgREST .or() treats commas/parens as syntax — strip them from user input.
  const safeQ = q.replace(/[,()]/g, "").trim();
  if (safeQ) {
    query = query.or(`content.ilike.%${safeQ}%,author.name.ilike.%${safeQ}%,author.username.ilike.%${safeQ}%`);
  }

  const from = (page - 1) * pageSize;
  const {data, error, count} = await query
    .order("createdAt", {ascending: false})
    .range(from, from + pageSize - 1);

  if (error) return NextResponse.json({error: error.message}, {status: 500});
  const total = count ?? 0;
  return NextResponse.json({
    items: data ?? [],
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function PATCH(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  let body: {postId?: string; content?: string};
  try { body = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }
  const {postId, content} = body;
  if (!postId || typeof content !== "string" || !content.trim() || content.length > 5000) {
    return NextResponse.json({error: "postId and content (1-5000 chars) required"}, {status: 400});
  }

  const {error} = await admin.from("Post")
    .update({content: content.trim(), updatedAt: new Date().toISOString()})
    .eq("id", postId);
  if (error) return NextResponse.json({error: error.message}, {status: 500});

  await logAdminAction(admin, {
    adminId,
    action: "content.edit_post",
    targetType: "post",
    targetId: postId,
  });
  return NextResponse.json({success: true});
}

export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  let body: {postId?: string; action?: "dismiss" | "archive" | "restore"};
  try { body = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }
  const {postId, action} = body;
  if (!postId || !action || !["dismiss", "archive", "restore"].includes(action)) {
    return NextResponse.json({error: "Invalid postId or action"}, {status: 400});
  }

  const updates = action === "dismiss"
    ? {isFlagged: false}
    : action === "archive"
      ? {isArchived: true}
      : {isArchived: false};

  const {error} = await admin.from("Post").update(updates).eq("id", postId);
  if (error) return NextResponse.json({error: error.message}, {status: 500});

  await logAdminAction(admin, {
    adminId,
    action: `content.${action}_post`,
    targetType: "post",
    targetId: postId,
  });
  return NextResponse.json({success: true, action});
}

export async function DELETE(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  let body: {postId?: string};
  try { body = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }
  const {postId} = body;
  if (!postId) return NextResponse.json({error: "postId required"}, {status: 400});

  const {error} = await admin.from("Post").delete().eq("id", postId);
  if (error) return NextResponse.json({error: error.message}, {status: 500});

  await logAdminAction(admin, {
    adminId,
    action: "content.delete_post",
    targetType: "post",
    targetId: postId,
  });
  return NextResponse.json({success: true});
}
