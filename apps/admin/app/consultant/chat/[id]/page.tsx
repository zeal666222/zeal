// apps/admin/app/consultant/chat/[id]/page.tsx
import { createServerClientFromCookies } from "@zeal/database/server";
import { redirect, notFound } from "next/navigation";
import { ChatRoom } from "@/components/chat/ChatRoom";

export const dynamic = "force-dynamic";

interface PartnerRow { userId: string }
interface UserRow {
  name: string | null;
  username: string;
  avatar: string | null;
  is_online: boolean | null;
}

export default async function ConsultantChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/consultant/chat/${conversationId}`);

  const { data: participant } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();

  if (!participant) notFound();

  const { data: partnerRaw } = await supabase
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .neq("userId", user.id)
    .limit(1);

  const partnerArr = (partnerRaw ?? []) as PartnerRow[];
  const partnerId = partnerArr[0]?.userId ?? "";

  let partnerName = "Seeker";
  let partnerAvatar: string | null = null;
  let partnerIsOnline = false;

  if (partnerId) {
    const { data: partnerUserRaw } = await supabase
      .from("User")
      .select("name, username, avatar, is_online")
      .eq("id", partnerId)
      .maybeSingle();
    const partnerUser = partnerUserRaw as UserRow | null;
    if (partnerUser) {
      partnerName = partnerUser.name || partnerUser.username || "Seeker";
      partnerAvatar = partnerUser.avatar ?? null;
      partnerIsOnline = Boolean(partnerUser.is_online);
    }
  }

  return (
    <ChatRoom
      conversationId={conversationId}
      currentUserId={user.id}
      partnerId={partnerId}
      partnerName={partnerName}
      partnerAvatar={partnerAvatar}
      partnerIsOnline={partnerIsOnline}
    />
  );
}
