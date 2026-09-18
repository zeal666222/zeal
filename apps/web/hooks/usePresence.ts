"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// usePresence — Room presence
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { usePresence as useZealPresence } from "@zeal/realtime";

interface PresenceEntry {
  online_at: string;
}

export interface PresenceInfo {
  onlineUsers: Set<string>;
  isOnline: (id: string) => boolean;
  count: number;
}

export function usePresence(roomId: string | null, userId: string | undefined): PresenceInfo {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useZealPresence<PresenceEntry & Record<string, unknown>>(
    roomId && userId ? `presence:${roomId}` : null,
    userId ?? "",
    (state) => {
      const ids = new Set(Object.keys(state || {}));
      setOnlineUsers(ids);
    },
  );

  return {
    onlineUsers,
    isOnline: (id: string) => onlineUsers.has(id),
    count: onlineUsers.size,
  };
}
