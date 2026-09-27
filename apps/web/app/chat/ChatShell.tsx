"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ChatShell — mobile-first responsive wrapper
// Mobile  (< md) : shows list OR room, never both
// Desktop (≥ md) : split view (list + room)
// ═══════════════════════════════════════════════════════════════════════════════

import {usePathname} from "next/navigation";
import {InstagramInboxList} from "@/components/chat/InstagramInboxList";
import type { ConversationItem } from "@/hooks/useConversations";
import {cn} from "@zeal/ui";

interface ChatShellProps {
  currentUserId: string;
  initialConversations: ConversationItem[];
  children: React.ReactNode;
}

export function ChatShell({
  currentUserId,
  initialConversations,
  children,
}: ChatShellProps) {
  const pathname = usePathname();
  const isRoomOpen = pathname !== "/chat";

  return (
    <div className="flex h-screen-app bg-background overflow-hidden">
      {/* Inbox list */}
      <aside
        className={cn(
          "w-full md:w-80 lg:w-96 shrink-0 h-full border-r border-border",
          isRoomOpen && "hidden md:block"
        )}
      >
        <InstagramInboxList
          currentUserId={currentUserId}
          initialConversations={initialConversations}
        />
      </aside>

      {/* Room / empty state */}
      <main
        className={cn(
          "flex-1 h-full flex-col bg-background",
          isRoomOpen ? "flex" : "hidden md:flex"
        )}
      >
        {children}
      </main>
    </div>
  );
}
