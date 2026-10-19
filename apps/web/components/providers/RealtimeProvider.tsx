"use client";

import {createContext, useContext, type ReactNode} from "react";
import {useChannel, useConnection, channels, type BroadcastChange, type ConnectionState} from "@zeal/realtime";
import {useAppStore} from "@/lib/store/appStore";

interface Ctx { connectionState: ConnectionState; isConnected: boolean; }
const RealtimeContext = createContext<Ctx>({ connectionState: "disconnected", isConnected: false });
export const useRealtimeContext = () => useContext(RealtimeContext);

interface WalletRow { userId?: string; balance?: number; }
interface NotificationRow {
  id?: string; type?: string; message?: string; redirectUrl?: string | null;
  actorId?: string; actorName?: string | null; actorAvatar?: string | null;
}
interface ProfileRow {
  avatar?: string | null;
  name?: string | null;
  username?: string;
  bio?: string | null;
  sparks?: number;
  isVerified?: boolean;
  role?: string;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const connectionState = useConnection();
  const user = useAppStore((s) => s.user);
  const setWallet = useAppStore((s) => s.setWallet);
  const updateUser = useAppStore((s) => s.updateUser);
  const addNotification = useAppStore((s) => s.addNotification);

  useChannel<BroadcastChange<WalletRow>>({
    channel: user?.id ? channels.userWallet(user.id) : null,
    event: "*",
    onMessage: (payload) => {
      const balance = payload?.record?.balance;
      if (typeof balance === "number") setWallet({ balance } as never);
    },
  });

  // Avatar / name / bio / sparks live-update across mounted icons when the
  // user edits their profile from any tab or from the admin panel.
  // Mirrors the trg_broadcast_user_avatar trigger fired on public."User" UPDATE.
  useChannel<BroadcastChange<ProfileRow>>({
    channel: user?.id ? channels.userProfile(user.id) : null,
    event: "*",
    onMessage: (payload) => {
      const rec = payload?.record;
      if (!rec) return;
      const updates: Parameters<typeof updateUser>[0] = {};
      if ("avatar" in rec) updates.avatar = rec.avatar ?? null;
      if ("name" in rec) updates.name = rec.name ?? null;
      if (typeof rec.username === "string") updates.username = rec.username;
      if ("bio" in rec) updates.bio = rec.bio ?? null;
      if (typeof rec.sparks === "number") updates.sparks = rec.sparks;
      if (typeof rec.isVerified === "boolean") updates.isVerified = rec.isVerified;
      if (Object.keys(updates).length > 0) updateUser(updates);
    },
  });

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
    <RealtimeContext.Provider value={{ connectionState, isConnected: connectionState === "connected" }}>
      {children}
    </RealtimeContext.Provider>
  );
}
