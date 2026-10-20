// apps/admin/app/api/consultant/chat/[id]/read/route.ts
import {NextResponse} from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Scope the write to the caller's own participant row, then confirm it landed.
  // Without the count check a non-participant got `success:true` from a zero-row
  // update, which silently marked a conversation read that was never theirs.
  const { error, count } = await supabase
    .from("ConversationParticipant")
    .update({ lastReadAt: new Date().toISOString() }, { count: "exact" })
    .eq("conversationId", conversationId)
    .eq("userId", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  return NextResponse.json({ success: true });
}
