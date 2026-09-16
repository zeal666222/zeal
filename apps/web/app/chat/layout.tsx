import { getUserConversations } from "@/actions/inbox";
import { InstagramInboxList } from "@/components/chat/InstagramInboxList";
import { redirect } from "next/navigation";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { success, conversations, currentUserId } = await getUserConversations();

  if (!success || !currentUserId) {
    redirect("/login");
  }

  return (
    <div className="flex-1 min-h-screen-app bg-slate-950 flex overflow-hidden">
      {/* 
        INSTAGRAM SPLIT VIEW ARCHITECTURE:
        - Desktop (md:): Fixed width 360px - 400px left list, remaining space for active chat
        - Mobile: Managed via layout and route transitions
      */}
      <aside className="w-full md:w-80 lg:w-96 shrink-0 h-screen-app md:block">
        <InstagramInboxList
          initialConversations={conversations}
          currentUserId={currentUserId}
        />
      </aside>

      {/* Detail View (Active Chat or Empty State) */}
      <main className="flex-1 h-screen-app hidden md:flex flex-col bg-slate-950">
        {children}
      </main>
    </div>
  );
}
