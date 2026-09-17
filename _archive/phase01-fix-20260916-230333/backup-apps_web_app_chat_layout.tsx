// apps/web/app/chat/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Chat layout — server component
// Fetches conversations + user, hands off to ChatShell for responsive UX
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database";
import { ChatShell } from "./ChatShell";
import type { ConversationItem } from "@/hooks/useConversations";

export const dynamic = "force-dynamic";

async function fetchConversations(userId: string): Promise<ConversationItem[]> {
  const supabase = await createServerClientFromCookies();

  const { data: memberships } = await supabase
    .from("ConversationParticipant")
    .select("conversationId")
    .eq("userId", userId);

  const conversationIds = (memberships ?? []).map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const { data: conversations } = await supabase
    .from("Conversation")
    .select("id, lastMessageAt, lastMessageText")
    .in("id", conversationIds)
    .order("lastMessageAt", { ascending: false });

  const { data: partners } = await supabase
    .from("ConversationParticipant")
    .select("conversationId, userId")
    .in("conversationId", conversationIds)
    .neq("userId", userId);

  const partnerIdByConv = new Map<string, string>();
  for (const p of partners ?? []) {
    partnerIdByConv.set(p.conversationId, p.userId);
  }

  const partnerIds = Array.from(new Set(Array.from(partnerIdByConv.values())));
  const { data: users } = partnerIds.length > 0
    ? await supabase
        .from("User")
        .select("id, name, username, avatar, is_online, role")
        .in("id", partnerIds)
    : { data: [] };

  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return (conversations ?? []).map((c) => {
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
}

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/chat");

  const conversations = await fetchConversations(user.id);

  return (
    <ChatShell
      currentUserId={user.id}
      initialConversations={conversations}
    >
      {children}
    </ChatShell>
  );
}