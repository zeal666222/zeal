"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// Admin RealtimeProvider — global channels + connection state
// ═══════════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  useChannel,
  useConnection,
  channels,
  type BroadcastChange,
  type ConnectionState,
} from "@zeal/realtime";
import { useAdminStore } from "@/lib/store/adminStore";

interface Ctx {
  connectionState: ConnectionState;
  isConnected: boolean;
}

const RealtimeContext = createContext<Ctx>({
  connectionState: "disconnected",
  isConnected: false,
});

export const useAdminRealtimeCtx = () => useContext(RealtimeContext);

interface NotificationRow {
  id?: string;
  type?: string;
  message?: string;
  redirectUrl?: string | null;
  actorId?: string;
  actorName?: string | null;
  actorAvatar?: string | null;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const connectionState = useConnection();
  const profile = useAdminStore((s) => s.profile);
  const setSocketConnected = useAdminStore((s) => s.setSocketConnected);
  const addNotification = useAdminStore((s) => s.addNotification);

  useEffect(() => {
    setSocketConnected(connectionState === "connected");
  }, [connectionState, setSocketConnected]);

  useChannel<BroadcastChange<NotificationRow>>({
    channel: profile?.id ? channels.userNotifications(profile.id) : null,
    event: "*",
    onMessage: (payload) => {
      const row = payload?.record;
      if (!row?.message) return;
      addNotification({
        id: row.id ?? `notif-${Date.now()}`,
        type: (row.type as never) ?? "system",
        message: row.message,
        redirectUrl: row.redirectUrl ?? null,
        read: false,
        actorId: row.actorId ?? "system",
        actorName: row.actorName ?? null,
        actorAvatar: row.actorAvatar ?? null,
      });
    },
  });

  return (
    <RealtimeContext.Provider
      value={{ connectionState, isConnected: connectionState === "connected" }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
