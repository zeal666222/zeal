"use client";
import {createContext, useContext, useEffect, type ReactNode} from "react";
import {useChannel, useConnection, channels, type BroadcastChange, type ConnectionState} from "@zeal/realtime";
import {useAdminStore} from "@/lib/store/adminStore";

interface Ctx { connectionState: ConnectionState; isConnected: boolean; }
const RealtimeContext = createContext<Ctx>({ connectionState: "disconnected", isConnected: false });
export const useAdminRealtimeCtx = () => useContext(RealtimeContext);

interface NotifRow { id?: string; type?: string; message?: string; redirectUrl?: string | null; actorId?: string; actorName?: string | null; actorAvatar?: string | null; }

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const cs = useConnection();
  const profile = useAdminStore((s) => s.profile);
  const setConnected = useAdminStore((s) => s.setSocketConnected);
  const addNotification = useAdminStore((s) => s.addNotification);
  const showIncoming = (useAdminStore as any)((s: any) => s.showIncomingAlert);

  useEffect(() => { setConnected(cs === "connected"); }, [cs, setConnected]);

  useChannel<BroadcastChange<NotifRow>>({
    channel: profile?.id ? channels.userNotifications(profile.id) : null,
    event: "*",
    onMessage: (p) => {
      const r = p?.record;
      if (!r?.message) return;
      addNotification({
        id: r.id ?? `notif-${Date.now()}`, type: (r.type as never) ?? "system",
        message: r.message, redirectUrl: r.redirectUrl ?? null, read: false,
        actorId: r.actorId ?? "system", actorName: r.actorName ?? null, actorAvatar: r.actorAvatar ?? null,
      });
      if (r.type === "chat" || r.type === "call" || r.type === "booking") {
        try { showIncoming?.({ id: r.id ?? `alert-${Date.now()}`, type: r.type, message: r.message, read: false }); } catch {}
      }
    },
  });

  return <RealtimeContext.Provider value={{ connectionState: cs, isConnected: cs === "connected" }}>{children}</RealtimeContext.Provider>;
}
