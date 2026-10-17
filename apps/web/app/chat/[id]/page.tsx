import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import { redirect, notFound } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/chat/${conversationId}`);

  const admin = createAdminClient();

  const { data: participant } = await admin
    .from("ConversationParticipant")
    .select("conversationId")
    .eq("conversationId", conversationId)
    .eq("userId", user.id)
    .maybeSingle();
  if (!participant) notFound();

  const { data: convRow } = await admin
    .from("Conversation")
    .select("id, metadata")
    .eq("id", conversationId)
    .maybeSingle();

  const metadata = (convRow as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};
  const aiConsultantId = typeof metadata.aiConsultantId === "string" ? metadata.aiConsultantId : null;

  let partnerId = "";
  let partnerName = "Chat";
  let partnerAvatar: string | null = null;
  let isAI = false;
  let rate = 0;
  let sessionId: string | null = null;

  if (aiConsultantId) {
    const { data: aiRow } = await admin
      .from("AIConsultant")
      .select("id, name, username, avatar, isPaid, perMinuteRate")
      .eq("id", aiConsultantId)
      .maybeSingle();
    if (aiRow) {
      const a = aiRow as { id: string; name: string; username: string | null; avatar: string | null; isPaid: boolean | null; perMinuteRate: number | null };
      partnerId = a.id;
      partnerName = a.name;
      partnerAvatar = a.avatar;
      isAI = true;
      rate = a.isPaid ? Number(a.perMinuteRate ?? 0) : 0;
    }
  } else {
    const { data: others } = await admin
      .from("ConversationParticipant")
      .select("userId")
      .eq("conversationId", conversationId)
      .neq("userId", user.id)
      .limit(1);
    const partnerUserId = (others as { userId: string }[] | null)?.[0]?.userId;

    if (partnerUserId) {
      const { data: uRow } = await admin
        .from("User")
        .select("id, name, full_name, username, avatar, avatar_url, role")
        .eq("id", partnerUserId)
        .maybeSingle();
      const u = uRow as {
        id: string;
        name: string | null;
        full_name: string | null;
        username: string | null;
        avatar: string | null;
        avatar_url: string | null;
        role: string;
      } | null;

      if (u) {
        partnerId = u.id;
        partnerName = u.name ?? u.full_name ?? u.username ?? "Zeal Member";
        partnerAvatar = u.avatar ?? u.avatar_url;

        const { data: cRow } = await admin
          .from("Consultant")
          .select("chatRate, perMinuteRate")
          .eq("userId", u.id)
          .maybeSingle();
        const c = cRow as { chatRate: number | null; perMinuteRate: number | null } | null;
        rate = Number(c?.chatRate ?? c?.perMinuteRate ?? 0);
      }
    }
  }

  return (
    <ChatInterface
      conversationId={conversationId}
      currentUserId={user.id}
      partnerId={partnerId}
      partnerName={partnerName}
      partnerAvatar={partnerAvatar}
      isAI={isAI}
      rate={rate}
      activeSessionId={sessionId}
    />
  );
}
