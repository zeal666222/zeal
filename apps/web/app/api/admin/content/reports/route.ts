import {NextResponse} from "next/server";
import {requireAdminAPI, logAdminAction} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin} = guard;

  const {data, error} = await admin
    .from("Post")
    .select('id, content, "mediaUrls", "createdAt", author:User!authorId(id, name, username, avatar)')
    .eq("isFlagged", true)
    .order("createdAt", {ascending: false})
    .limit(200);

  if (error) return NextResponse.json({error: error.message}, {status: 500});
  return NextResponse.json({items: data ?? []});
}

export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;

  let body: {postId?: string; action?: "dismiss" | "delete"};
  try { body = await req.json(); } catch {
    return NextResponse.json({error: "Invalid JSON"}, {status: 400});
  }

  const {postId, action} = body;
  if (!postId || !action || !["dismiss", "delete"].includes(action)) {
    return NextResponse.json({error: "Invalid postId or action"}, {status: 400});
  }

  if (action === "delete") {
    const {error} = await admin.from("Post").delete().eq("id", postId);
    if (error) return NextResponse.json({error: error.message}, {status: 500});
  } else {
    const {error} = await admin.from("Post").update({isFlagged: false}).eq("id", postId);
    if (error) return NextResponse.json({error: error.message}, {status: 500});
  }

  await logAdminAction(admin, {
    adminId,
    action: action === "delete" ? "content.delete_post" : "content.dismiss_report",
    targetType: "post",
    targetId: postId,
  });

  return NextResponse.json({success: true, action});
}
