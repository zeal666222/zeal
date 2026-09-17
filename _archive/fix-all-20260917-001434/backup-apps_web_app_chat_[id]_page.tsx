// apps/web/app/chat/[id]/page.tsx
import { createServerClientFromCookies } from "@zeal/database";
import { redirect, notFound } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/chat/${conversationId}`);

  // Verify participation
  const { data: participant } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!participant) notFound();

  // Fetch partner
  const { data: partnerRows } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .neq("userId", user.id)
    .limit(1);

  const partnerRow = Array.isArray(partnerRows) ? partnerRows[0] : partnerRows;
  let partnerName = "Chat";
  let partnerAvatar: string | null = null;
  let isAI = false;

  if (partnerRow?.userId) {
    const { data: partner } = await supabase
      .from("User")
      .select("name, username, avatar, role")
      .eq("id", partnerRow.userId)
      .maybeSingle();

    partnerName = partner?.name || partner?.username || "Chat";
    partnerAvatar = partner?.avatar ?? null;
    isAI = partner?.role === "AI";
  }

  return (
    <ChatInterface
      conversationId={conversationId}
      currentUserId={user.id}
      partnerName={partnerName}
      partnerAvatar={partnerAvatar}
      isAI={isAI}
    />
  );
}