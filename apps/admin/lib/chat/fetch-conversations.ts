// apps/admin/lib/chat/fetch-conversations.ts
// Typed helper — same shape as web so admin hooks are symmetric.
import { createServerClientFromCookies } from "@zeal/database/server";

export interface ConversationItem {
  sessionId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isOnline: boolean;
  isAI: boolean;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderId: string | null;
}

interface MembershipRow { conversationId: string }
interface ConversationRow {
  id: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
}
interface ParticipantRow { conversationId: string; userId: string }
interface PartnerRow {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_online: boolean | null;
  role: string | null;
}

export async function fetchConsultantConversations(
  consultantUserId: string,
): Promise<ConversationItem[]> {
  const supabase = await createServerClientFromCookies();

  const { data: membershipsRaw } = await supabase
    .from("ConversationParticipant")
    .select("conversationId")
    .eq("userId", consultantUserId);

  const memberships = (membershipsRaw ?? []) as MembershipRow[];
  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const { data: conversationsRaw } = await supabase
    .from("Conversation")
    .select("id, lastMessageAt, lastMessageText")
    .in("id", conversationIds)
    .order("lastMessageAt", { ascending: false });

  const conversations = (conversationsRaw ?? []) as ConversationRow[];

  const { data: partnersRaw } = await supabase
    .from("ConversationParticipant")
    .select("conversationId, userId")
    .in("conversationId", conversationIds)
    .neq("userId", consultantUserId);

  const partners = (partnersRaw ?? []) as ParticipantRow[];
  const partnerIdByConv = new Map<string, string>();
  for (const p of partners) partnerIdByConv.set(p.conversationId, p.userId);

  const partnerIds = Array.from(new Set(partnerIdByConv.values()));

  let users: PartnerRow[] = [];
  if (partnerIds.length > 0) {
    const { data: usersRaw } = await supabase
      .from("User")
      .select("id, name, username, avatar, is_online, role")
      .in("id", partnerIds);
    users = (usersRaw ?? []) as PartnerRow[];
  }

  const userById = new Map<string, PartnerRow>();
  for (const u of users) userById.set(u.id, u);

  return conversations.map((c): ConversationItem => {
    const partnerId = partnerIdByConv.get(c.id) ?? "";
    const partner = userById.get(partnerId);
    return {
      sessionId: c.id,
      partnerId,
      partnerName: partner?.name || partner?.username || "Seeker",
      partnerAvatar: partner?.avatar ?? null,
      isOnline: Boolean(partner?.is_online),
      isAI: partner?.role === "AI",
      lastMessage: c.lastMessageText ?? null,
      lastMessageTime: c.lastMessageAt ?? null,
      lastMessageSenderId: null,
    };
  });
}
