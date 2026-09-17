// apps/web/app/api/chat/conversations/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Conversations API — GET (list) + POST (create/get with partner)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Memberships for this user
  const { data: memberships } = await supabase
    .from("ConversationParticipant")
    .select("conversationId")
    .eq("userId", user.id);

  const conversationIds = (memberships ?? []).map((m) => m.conversationId);
  if (conversationIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // 2. Conversation metadata
  const { data: conversations } = await supabase
    .from("Conversation")
    .select("id, lastMessageAt, lastMessageText")
    .in("id", conversationIds)
    .order("lastMessageAt", { ascending: false });

  // 3. Partner IDs
  const { data: partners } = await supabase
    .from("ConversationParticipant")
    .select("conversationId, userId")
    .in("conversationId", conversationIds)
    .neq("userId", user.id);

  const partnerIdByConv = new Map<string, string>();
  for (const p of partners ?? []) {
    partnerIdByConv.set(p.conversationId, p.userId);
  }

  const partnerIds = Array.from(new Set(Array.from(partnerIdByConv.values())));

  // 4. Partner user rows
  const { data: users } = partnerIds.length > 0
    ? await supabase
        .from("User")
        .select("id, name, username, avatar, is_online, role")
        .in("id", partnerIds)
    : { data: [] };

  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  // 5. Assemble items
  const items = (conversations ?? []).map((c) => {
    const partnerId = partnerIdByConv.get(c.id) ?? "";
    const partner = userById.get(partnerId);
    return {
      sessionId: c.id,
      partnerId,
      partnerName: partner?.name || partner?.username || "Zeal Member",
      partnerAvatar: partner?.avatar ?? null,
      isOnline: Boolean(partner?.is_online),
      isAI: partner?.role === "AI" || false,
      lastMessage: c.lastMessageText ?? null,
      lastMessageTime: c.lastMessageAt ?? null,
      lastMessageSenderId: null,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { partnerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partnerId = body.partnerId;
  if (!partnerId || partnerId === user.id) {
    return NextResponse.json({ error: "Invalid partnerId" }, { status: 400 });
  }

  const { data: conversationId, error } = await supabase.rpc(
    "get_or_create_conversation",
    { p_user_a: user.id, p_user_b: partnerId }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId });
}