"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useNotifications — Realtime notifications
// Subscribes to user:{id}:notifications via @zeal/realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback } from "react";
import { useAppStore } from "@/lib/store/appStore";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface NotificationRow {
  id?: string;
  type?: string;
  message?: string;
  redirectUrl?: string | null;
  actorId?: string;
  actorName?: string | null;
  actorAvatar?: string | null;
}

export function useNotifications() {
  const user = useAppStore((s) => s.user);
  const addNotification = useAppStore((s) => s.addNotification);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const unreadCount = useAppStore((s) => s.unreadCount);

  useChannel<BroadcastChange<NotificationRow>>({
    channel: user?.id ? channels.userNotifications(user.id) : null,
    event: "*",
    onMessage: (payload) => {
      const row = payload?.record;
      if (!row?.message) return;
      addNotification({
        id: row.id || `notif-${Date.now()}`,
        type: (row.type as never) || "system",
        message: row.message,
        redirectUrl: row.redirectUrl ?? null,
        read: false,
        actorId: row.actorId || "system",
        actorName: row.actorName ?? undefined,
        actorAvatar: row.actorAvatar ?? undefined,
      });
    },
  });

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch (err) {
      console.warn("[notifications] markAsRead failed", err);
    }
  }, []);

  return { unreadCount, markAllRead, markAsRead };
}
