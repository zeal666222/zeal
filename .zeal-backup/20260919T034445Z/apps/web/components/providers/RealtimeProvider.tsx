"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// Web RealtimeProvider — global channels only
// Component-local channels are subscribed by their own hooks (useChannel)
// ═══════════════════════════════════════════════════════════════════════════════

import { createContext, useContext, type ReactNode } from "react";
import {
  useChannel,
  useConnection,
  channels,
  type BroadcastChange,
  type ConnectionState,
} from "@zeal/realtime";
import { useAppStore } from "@/lib/store/appStore";

interface Ctx {
  connectionState: ConnectionState;
  isConnected: boolean;
}

const RealtimeContext = createContext<Ctx>({
  connectionState: "disconnected",
  isConnected: false,
});

export const useRealtimeContext = () => useContext(RealtimeContext);

interface WalletRow { userId?: string; balance?: number }
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
  const user = useAppStore((s) => s.user);
  const setWallet = useAppStore((s) => s.setWallet);
  const addNotification = useAppStore((s) => s.addNotification);

  // Global — wallet balance updates
  useChannel<BroadcastChange<WalletRow>>({
    channel: user?.id ? channels.userWallet(user.id) : null,
    event: "*",
    onMessage: (payload) => {
      const balance = payload?.record?.balance;
      if (typeof balance === "number") {
        setWallet({ balance } as never);
      }
    },
  });

  // Global — notification fan-in
  useChannel<BroadcastChange<NotificationRow>>({
    channel: user?.id ? channels.userNotifications(user.id) : null,
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
        actorName: row.actorName ?? undefined,
        actorAvatar: row.actorAvatar ?? undefined,
      });
    },
  });

  return (
    <RealtimeContext.Provider
      value={{
        connectionState,
        isConnected: connectionState === "connected",
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
