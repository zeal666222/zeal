// apps/web/app/api/chat/conversations/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// GET   → list conversations (typed via shared helper)
// POST  → get_or_create_conversation with a partner
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {createServerClientFromCookies, createAdminClient} from "@zeal/database/server";
import {fetchUserConversations} from "@/lib/chat/fetch-conversations";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await fetchUserConversations(user.id);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { partnerId?: string; isAI?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partnerId = body.partnerId;
  if (!partnerId || partnerId === user.id) {
    return NextResponse.json({ error: "Invalid partnerId" }, { status: 400 });
  }

  // AI consultants don't have User records — create a solo conversation
  if (body.isAI) {
    const admin = createAdminClient();
    
    // Check if conversation already exists for this user + AI consultant
    const { data: existing } = await admin
      .from("ConversationParticipant")
      .select("conversationId, Conversation!inner(id, metadata)")
      .eq("userId", user.id)
      .eq("Conversation.metadata->>aiConsultantId", partnerId)
      .maybeSingle();
    
    if (existing?.conversationId) {
      return NextResponse.json({ conversationId: existing.conversationId });
    }
    
    // Create new conversation for AI chat
    const { data: newConv, error: convError } = await admin
      .from("Conversation")
      .insert({
        isGroup: false,
        metadata: { aiConsultantId: partnerId, type: "ai" },
      })
      .select("id")
      .single();
    
    if (convError || !newConv) {
      return NextResponse.json({ error: convError?.message ?? "Failed to create conversation" }, { status: 500 });
    }
    
    // Add user as participant
    const { error: partError } = await admin
      .from("ConversationParticipant")
      .insert({
        conversationId: newConv.id,
        userId: user.id,
      });
    
    if (partError) {
      return NextResponse.json({ error: partError.message }, { status: 500 });
    }
    
    return NextResponse.json({ conversationId: newConv.id });
  }

  // Human-to-human conversation
  const { data: conversationId, error } = await supabase.rpc(
    "get_or_create_conversation",
    { p_user_a: user.id, p_user_b: partnerId }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId });
}
