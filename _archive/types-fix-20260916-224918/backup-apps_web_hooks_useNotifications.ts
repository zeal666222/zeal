"use client";

import { useEffect } from "react";
import { useAppStore, type Notification } from "@/lib/store/appStore";
import { useSocket } from "./useSocket";

export function useNotifications() {
  const addNotification = useAppStore((s) => s.addNotification);
  const markAllRead = useAppStore((s) => s.markAllRead);
  const unreadCount = useAppStore((s) => s.unreadCount);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const handler = (raw: unknown) => {
      const data = raw as Omit<Notification, "createdAt"> & { createdAt?: string };
      addNotification(data);
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Zeal", { body: data.message });
      }
    };
    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [socket, addNotification]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications/" + id + "/read", { method: "POST" });
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  return { unreadCount, markAllRead, markAsRead };
}

