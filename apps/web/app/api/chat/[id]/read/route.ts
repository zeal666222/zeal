// apps/web/app/api/chat/[id]/read/route.ts
// POST → marks the conversation as read for the current user
// GET  → returns every participant's lastReadAt (drives "Seen" receipts)
import { NextResponse } from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";
import { isAiConversationId } from "@/lib/chat/worker";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  if (isAiConversationId(conversationId)) {
    return NextResponse.json({ participants: [] });
  }

  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ConversationParticipant")
    .select("userId, lastReadAt")
    .eq("conversationId", conversationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ participants: data ?? [] });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  // AI rooms live in the worker's D1 and have exactly one human participant, so
  // there is no unread state to record — and the Supabase update below would
  // fail on the uuid cast alone.
  if (isAiConversationId(conversationId)) {
    return NextResponse.json({ success: true });
  }

  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("ConversationParticipant")
    .update({ lastReadAt: new Date().toISOString() })
    .eq("conversationId", conversationId)
    .eq("userId", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
