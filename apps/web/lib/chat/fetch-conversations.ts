import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import type { ConversationItem } from "@/hooks/useConversations";

interface MembershipRow { conversationId: string }
interface ConversationRow {
  id: string;
  metadata: Record<string, unknown> | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function fetchUserConversations(userId: string): Promise<ConversationItem[]> {
  const supabase = await createServerClientFromCookies();
  const admin = createAdminClient();

  const { data: memberRaw, error: memberErr } = await supabase
    .from("ConversationParticipant")
    .select("conversationId")
    .eq("userId", userId);
  if (memberErr) {
    console.error("[fetch-conversations] memberships:", memberErr.message);
    return [];
  }
  const ids = ((memberRaw ?? []) as MembershipRow[]).map((m) => m.conversationId);
  if (ids.length === 0) return [];

  const { data: convRaw, error: convErr } = await supabase
    .from("Conversation")
    .select("id, metadata, lastMessageAt, lastMessageText")
    .in("id", ids)
    .order("lastMessageAt", { ascending: false });
  if (convErr) {
    console.error("[fetch-conversations] conversations:", convErr.message);
    return [];
  }
  const convs = (convRaw ?? []) as ConversationRow[];

  const items = await Promise.all(
    convs.map(async (c): Promise<ConversationItem> => {
      const metadata = c.metadata ?? {};
      const aiConsultantId = typeof metadata.aiConsultantId === "string" ? metadata.aiConsultantId : null;

      if (aiConsultantId) {
        const { data: aiRow } = await admin
          .from("AIConsultant")
          .select("id, name, username, avatar")
          .eq("id", aiConsultantId)
          .maybeSingle();
        const ai = aiRow as { id: string; name: string; username: string | null; avatar: string | null } | null;
        return {
          sessionId: c.id,
          partnerId: ai?.id ?? aiConsultantId,
          partnerName: ai?.name ?? "AI Consultant",
          partnerAvatar: ai?.avatar ?? null,
          isOnline: true,
          isAI: true,
          lastMessage: c.lastMessageText ?? null,
          lastMessageTime: iso(c.lastMessageAt),
          lastMessageSenderId: null,
        };
      }

      const { data: others } = await supabase
        .from("ConversationParticipant")
        .select("userId")
        .eq("conversationId", c.id)
        .neq("userId", userId)
        .limit(1);
      const partnerId = (others as { userId: string }[] | null)?.[0]?.userId;

      if (!partnerId) {
        return {
          sessionId: c.id,
          partnerId: "",
          partnerName: "Zeal Member",
          partnerAvatar: null,
          isOnline: false,
          isAI: false,
          lastMessage: c.lastMessageText ?? null,
          lastMessageTime: iso(c.lastMessageAt),
          lastMessageSenderId: null,
        };
      }

      const { data: uRow } = await admin
        .from("User")
        .select("id, name, full_name, username, avatar, avatar_url, is_online")
        .eq("id", partnerId)
        .maybeSingle();
      const u = uRow as {
        id: string;
        name: string | null;
        full_name: string | null;
        username: string | null;
        avatar: string | null;
        avatar_url: string | null;
        is_online: boolean | null;
      } | null;

      return {
        sessionId: c.id,
        partnerId: u?.id ?? partnerId,
        partnerName: u?.name ?? u?.full_name ?? u?.username ?? "Zeal Member",
        partnerAvatar: u?.avatar ?? u?.avatar_url ?? null,
        isOnline: Boolean(u?.is_online),
        isAI: false,
        lastMessage: c.lastMessageText ?? null,
        lastMessageTime: iso(c.lastMessageAt),
        lastMessageSenderId: null,
      };
    }),
  );

  return items;
}
