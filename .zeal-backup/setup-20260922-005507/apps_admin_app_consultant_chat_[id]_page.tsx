import {createServerClientFromCookies} from "@zeal/database/server";
import {redirect, notFound} from "next/navigation";
import {ChatRoom} from "@/components/chat/ChatRoom";

export const dynamic = "force-dynamic";
interface PRow { userId: string; }
interface URow { name: string | null; username: string; avatar: string | null; is_online: boolean | null; }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createServerClientFromCookies();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/consultant/chat/${id}`);

  const { data: part } = await sb.from("ConversationParticipant").select("userId").eq("conversationId", id).eq("userId", user.id).maybeSingle();
  if (!part) notFound();

  const { data: pRaw } = await sb.from("ConversationParticipant").select("userId").eq("conversationId", id).neq("userId", user.id).limit(1);
  const pid = ((pRaw ?? []) as PRow[])[0]?.userId ?? "";

  let pName = "Seeker", pAvatar: string | null = null, pOnline = false;
  if (pid) {
    const { data: uRaw } = await sb.from("User").select("name, username, avatar, is_online").eq("id", pid).maybeSingle();
    const u = uRaw as URow | null;
    if (u) { pName = u.name || u.username || "Seeker"; pAvatar = u.avatar ?? null; pOnline = Boolean(u.is_online); }
  }

  return <ChatRoom conversationId={id} currentUserId={user.id} partnerId={pid} partnerName={pName} partnerAvatar={pAvatar} partnerIsOnline={pOnline} />;
}
