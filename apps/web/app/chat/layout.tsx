// apps/web/app/chat/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Chat layout — server component
// Auth-gates the route, then hands off to ChatShell with an EMPTY initial list.
// Conversations are loaded client-side so the page renders instantly instead of
// blocking on N+1 Supabase queries + a worker round-trip.
// ═══════════════════════════════════════════════════════════════════════════════

import {redirect} from "next/navigation";
import {createServerClientFromCookies} from "@zeal/database/server";
import {ChatShell} from "./ChatShell";

export const dynamic = "force-dynamic";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/chat");

  return (
    <ChatShell
      currentUserId={user.id}
      initialConversations={[]}
    >
      {children}
    </ChatShell>
  );
}
