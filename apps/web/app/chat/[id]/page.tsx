import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import { redirect, notFound } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PartnerViewResult {
  ok: boolean;
  partner?: { id: string; name: string; username: string; avatar: string | null; role: string };
  isAI?: boolean;
  rate?: number;
  sessionId?: string | null;
}

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectedFrom=/chat/${conversationId}`);

  const admin = createAdminClient();

  const { data: participant } = await admin
    .from("ConversationParticipant").select("conversationId")
    .eq("conversationId", conversationId).eq("userId", user.id).maybeSingle();
  if (!participant) notFound();

  const { data: viewRaw, error: viewErr } = await supabase.rpc("chat_partner_view", {
    p_conversation_id: conversationId,
  });
  if (viewErr) console.error("[chat/page] view error:", viewErr.message);

  let view = (viewRaw ?? {}) as PartnerViewResult;

  // Fallback: resolve the partner directly if the RPC is unavailable/failed.
  if (!view.ok || !view.partner) {
    const { data: others } = await admin
      .from("ConversationParticipant")
      .select("userId")
      .eq("conversationId", conversationId)
      .neq("userId", user.id)
      .limit(1);
    const partnerId = others?.[0]?.userId;
    if (partnerId) {
      const { data: aiRow } = await admin
        .from("AIConsultant")
        .select("id, name, username, avatar, isPaid, perMinuteRate")
        .eq("id", partnerId)
        .maybeSingle();
      if (aiRow) {
        const a = aiRow as { id: string; name: string; username: string | null; avatar: string | null; isPaid: boolean | null; perMinuteRate: number | null };
        view = {
          ok: true,
          partner: { id: a.id, name: a.name, username: a.username ?? "", avatar: a.avatar, role: "AI" },
          isAI: true,
          rate: a.isPaid ? Number(a.perMinuteRate ?? 0) : 0,
        };
      } else {
        const { data: uRow } = await admin
          .from("User")
          .select("id, name, full_name, username, avatar, avatar_url, role")
          .eq("id", partnerId)
          .maybeSingle();
        const u = uRow as { id: string; name: string | null; full_name: string | null; username: string | null; avatar: string | null; avatar_url: string | null; role: string } | null;
        if (u) {
          const { data: cRow } = await admin
            .from("Consultant")
            .select("chatRate, perMinuteRate")
            .eq("userId", u.id)
            .maybeSingle();
          const c = cRow as { chatRate: number | null; perMinuteRate: number | null } | null;
          view = {
            ok: true,
            partner: {
              id: u.id,
              name: u.name ?? u.full_name ?? u.username ?? "Zeal Member",
              username: u.username ?? "",
              avatar: u.avatar ?? u.avatar_url,
              role: u.role ?? "USER",
            },
            isAI: false,
            rate: Number(c?.chatRate ?? c?.perMinuteRate ?? 0),
          };
        }
      }
    }
  }

  return (
    <ChatInterface
      conversationId={conversationId}
      currentUserId={user.id}
      partnerId={view.partner?.id ?? ""}
      partnerName={view.partner?.name ?? "Chat"}
      partnerAvatar={view.partner?.avatar ?? null}
      isAI={view.isAI === true}
      rate={Number(view.rate ?? 0)}
      activeSessionId={view.sessionId ?? null}
    />
  );
}
