import { createServerClientFromCookies } from "@zeal/database/server";
import { redirect, notFound } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PartnerViewResult {
  ok: boolean;
  partner?: { id: string; name: string; username: string; avatar: string | null; role: string };
  isAI?: boolean;
}

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/chat/${conversationId}`);

  const { data: participant } = await supabase
    .from("ConversationParticipant").select("conversationId")
    .eq("conversationId", conversationId).eq("userId", user.id).maybeSingle();
  if (!participant) notFound();

  const { data: viewRaw, error: viewErr } = await supabase.rpc("chat_partner_view", {
    p_conversation_id: conversationId,
  });
  if (viewErr) console.error("[chat/page] view error:", viewErr.message);

  const view = (viewRaw ?? {}) as PartnerViewResult;

  return (
    <ChatInterface
      conversationId={conversationId}
      currentUserId={user.id}
      partnerId={view.partner?.id ?? ""}
      partnerName={view.partner?.name ?? "Chat"}
      partnerAvatar={view.partner?.avatar ?? null}
      isAI={view.isAI === true}
    />
  );
}
