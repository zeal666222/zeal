"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Inbox — user's conversations with partner + preview
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClientFromCookies} from "@zeal/database/server";

export type ConversationItem = {
  sessionId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isOnline: boolean;
  isAI: boolean;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderId: string | null;
  status: string;
};

interface ParticipantRow { conversationId: string; userId: string }
interface ConversationRow { id: string; lastMessageAt: string | null; lastMessageText: string | null }
interface UserRow { id: string; name: string | null; username: string | null; avatar: string | null; is_online: boolean | null; role: string | null }

export async function getUserConversations(): Promise<{
  success: boolean;
  conversations: ConversationItem[];
  currentUserId: string | null;
  error?: string;
}> {
  try {
    const supabase = await createServerClientFromCookies();
    const {data: {user}, error: authError} = await supabase.auth.getUser();
    if (authError || !user) {
      return {success: false, conversations: [], currentUserId: null, error: "Unauthorized"};
    }

    const {data: memberships} = await supabase
      .from("ConversationParticipant")
      .select("conversationId")
      .eq("userId", user.id);

    const conversationIds = (memberships ?? []).map((m: {conversationId: string}) => m.conversationId);
    if (conversationIds.length === 0) {
      return {success: true, conversations: [], currentUserId: user.id};
    }

    const {data: conversations} = await supabase
      .from("Conversation")
      .select("id, lastMessageAt, lastMessageText")
      .in("id", conversationIds)
      .order("lastMessageAt", {ascending: false});

    const {data: partners} = await supabase
      .from("ConversationParticipant")
      .select("conversationId, userId")
      .in("conversationId", conversationIds)
      .neq("userId", user.id);

    const partnerIds = Array.from(new Set(((partners ?? []) as ParticipantRow[]).map(p => p.userId)));

    let users: UserRow[] = [];
    if (partnerIds.length > 0) {
      const {data} = await supabase
        .from("User")
        .select("id, name, username, avatar, is_online, role")
        .in("id", partnerIds);
      users = (data ?? []) as UserRow[];
    }
    const userById = new Map(users.map(u => [u.id, u]));
    const partnerIdByConv = new Map(((partners ?? []) as ParticipantRow[]).map(p => [p.conversationId, p.userId]));

    const items: ConversationItem[] = ((conversations ?? []) as ConversationRow[]).map(c => {
      const pid = partnerIdByConv.get(c.id) ?? "";
      const p = userById.get(pid);
      let previewText = c.lastMessageText ?? "Session initiated";
      if (previewText.startsWith("[WEBRTC_")) previewText = "📹 Video call";

      return {
        sessionId: c.id,
        partnerId: pid,
        partnerName: p?.name || p?.username || "Zeal Member",
        partnerAvatar: p?.avatar ?? null,
        isOnline: Boolean(p?.is_online),
        isAI: p?.role === "AI",
        lastMessage: previewText,
        lastMessageTime: c.lastMessageAt,
        lastMessageSenderId: null,
        status: "active",
      };
    });

    return {success: true, conversations: items, currentUserId: user.id};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {success: false, conversations: [], currentUserId: null, error: message};
  }
}
