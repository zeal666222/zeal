"use client";
import {usePathname} from "next/navigation";
import {InboxList} from "./InboxList";
import type { ConversationItem } from "@/hooks/useConversations";
import {cn} from "@zeal/ui";

interface Props { currentUserId: string; initialConversations: ConversationItem[]; children: React.ReactNode; }

export function ChatShell({ currentUserId, initialConversations, children }: Props) {
  const pathname = usePathname();
  const roomOpen = pathname !== "/consultant/chat";
  return (
    <div className="flex h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] bg-slate-950 overflow-hidden rounded-2xl lg:rounded-3xl border border-white/5">
      <aside className={cn("w-full md:w-80 lg:w-96 shrink-0 h-full border-r border-white/5", roomOpen && "hidden md:block")}>
        <InboxList currentUserId={currentUserId} initialConversations={initialConversations} />
      </aside>
      <main className={cn("flex-1 h-full flex-col bg-slate-950", roomOpen ? "flex" : "hidden md:flex")}>
        {children}
      </main>
    </div>
  );
}
