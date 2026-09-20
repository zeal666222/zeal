import {createServerClientFromCookies} from "@zeal/database/server";
import type { ConversationItem } from "@/types/chat";

interface Membership { conversationId: string; }
interface ConversationRow { id: string; lastMessageAt: string | null; lastMessageText: string | null; }
interface Participant { conversationId: string; userId: string; }
interface Partner { id: string; name: string | null; username: string | null; avatar: string | null; is_online: boolean | null; role: string | null; }

export async function fetchConsultantConversations(userId: string): Promise<ConversationItem[]> {
  const sb = await createServerClientFromCookies();
  const { data: memberRaw } = await sb.from("ConversationParticipant").select("conversationId").eq("userId", userId);
  const member = (memberRaw ?? []) as Membership[];
  const ids = member.map((m) => m.conversationId);
  if (ids.length === 0) return [];

  const { data: convRaw } = await sb.from("Conversation").select("id, lastMessageAt, lastMessageText").in("id", ids).order("lastMessageAt", { ascending: false });
  const convs = (convRaw ?? []) as ConversationRow[];

  const { data: partRaw } = await sb.from("ConversationParticipant").select("conversationId, userId").in("conversationId", ids).neq("userId", userId);
  const parts = (partRaw ?? []) as Participant[];
  const pidByConv = new Map<string, string>();
  for (const p of parts) pidByConv.set(p.conversationId, p.userId);
  const pids = Array.from(new Set(pidByConv.values()));

  let users: Partner[] = [];
  if (pids.length > 0) {
    const { data: uRaw } = await sb.from("User").select("id, name, username, avatar, is_online, role").in("id", pids);
    users = (uRaw ?? []) as Partner[];
  }
  const uMap = new Map<string, Partner>();
  for (const u of users) uMap.set(u.id, u);

  return convs.map((c): ConversationItem => {
    const pid = pidByConv.get(c.id) ?? "";
    const p = uMap.get(pid);
    return {
      sessionId: c.id, partnerId: pid,
      partnerName: p?.name || p?.username || "Seeker",
      partnerAvatar: p?.avatar ?? null,
      isOnline: Boolean(p?.is_online),
      isAI: p?.role === "AI",
      lastMessage: c.lastMessageText ?? null,
      lastMessageTime: c.lastMessageAt ?? null,
      lastMessageSenderId: null,
    };
  });
}
