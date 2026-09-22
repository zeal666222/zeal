import { createServerClientFromCookies } from "@zeal/database/server";
import type { ConversationItem } from "@/hooks/useConversations";

interface MembershipRow { conversationId: string }
interface ConversationRow {
  id: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
}
interface PartnerViewResult {
  ok: boolean;
  partner?: { id: string; name: string; username: string; avatar: string | null; role: string };
  isAI?: boolean;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function fetchUserConversations(userId: string): Promise<ConversationItem[]> {
  const supabase = await createServerClientFromCookies();
  const { data: memberRaw, error: memberErr } = await supabase
    .from("ConversationParticipant").select("conversationId").eq("userId", userId);
  if (memberErr) { console.error("[fetch-conversations] memberships:", memberErr.message); return []; }
  const ids = ((memberRaw ?? []) as MembershipRow[]).map((m) => m.conversationId);
  if (ids.length === 0) return [];

  const { data: convRaw, error: convErr } = await supabase
    .from("Conversation").select("id, lastMessageAt, lastMessageText")
    .in("id", ids).order("lastMessageAt", { ascending: false });
  if (convErr) { console.error("[fetch-conversations] conversations:", convErr.message); return []; }
  const convs = (convRaw ?? []) as ConversationRow[];

  const partnerViews = await Promise.all(convs.map(async (c) => {
    try {
      const { data } = await supabase.rpc("chat_partner_view", { p_conversation_id: c.id });
      return { id: c.id, view: (data ?? {}) as PartnerViewResult };
    } catch { return { id: c.id, view: { ok: false } as PartnerViewResult }; }
  }));
  const viewByConv = new Map(partnerViews.map((p) => [p.id, p.view]));

  return convs.map((c): ConversationItem => {
    const v = viewByConv.get(c.id);
    const partner = v?.partner;
    return {
      sessionId: c.id,
      partnerId: partner?.id ?? "",
      partnerName: partner?.name ?? "Zeal Member",
      partnerAvatar: partner?.avatar ?? null,
      isOnline: false,
      isAI: v?.isAI === true,
      lastMessage: c.lastMessageText ?? null,
      lastMessageTime: iso(c.lastMessageAt),
      lastMessageSenderId: null,
    };
  });
}
