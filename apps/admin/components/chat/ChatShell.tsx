// apps/admin/components/chat/ChatShell.tsx
"use client";

import { usePathname } from "next/navigation";
import { InboxList } from "./InboxList";
import type { ConversationItem } from "@/lib/chat/fetch-conversations";
import { cn } from "@zeal/ui";

interface ChatShellProps {
  currentUserId: string;
  initialConversations: ConversationItem[];
  children: React.ReactNode;
}

export function ChatShell({ currentUserId, initialConversations, children }: ChatShellProps) {
  const pathname = usePathname();
  const isRoomOpen = pathname !== "/consultant/chat";

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-slate-950 overflow-hidden rounded-3xl border border-white/5">
      <aside
        className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 h-full border-r border-white/5",
          isRoomOpen && "hidden md:block",
        )}
      >
        <InboxList currentUserId={currentUserId} initialConversations={initialConversations} />
      </aside>

      <main
        className={cn(
          "flex-1 h-full flex-col bg-slate-950",
          isRoomOpen ? "flex" : "hidden md:flex",
        )}
      >
        {children}
      </main>
    </div>
  );
}
