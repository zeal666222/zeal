import {redirect} from "next/navigation";
import {createServerClientFromCookies} from "@zeal/database/server";
import {ChatShell} from "@/components/admin/chat/ChatShell";
import {fetchConsultantConversations} from "@/lib/admin/chat/fetch-conversations";

export const dynamic = "force-dynamic";

export default async function ConsultantChatLayout({ children }: { children: React.ReactNode }) {
  const sb = await createServerClientFromCookies();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/admin/login?redirectedFrom=/admin/consultant/chat");
  const conversations = await fetchConsultantConversations(user.id);
  return <ChatShell currentUserId={user.id} initialConversations={conversations}>{children}</ChatShell>;
}
