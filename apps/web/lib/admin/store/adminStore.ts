import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { playNotificationChime } from "@/lib/sound";

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "VIEWER";

export const ROLE_LEVEL: Record<AdminRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  SUPPORT: 50,
  VIEWER: 10,
};

export type NotificationType =
  | "chat"
  | "call"
  | "booking"
  | "system"
  | "payment"
  | "verification"
  | "reminder"
  | "referral"
  | "quest"
  | "new_post";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  redirectUrl?: string | null;
  read: boolean;
  actorId: string;
  actorName?: string | null;
  actorAvatar?: string | null;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface AdminProfile {
  id: string;
  email: string;
  role: AdminRole;
  name: string;
  avatar?: string | null;
  consultantId?: string;
  createdAt: string;
  mfaEnabled?: boolean;
}

export type IncomingAlertType = "chat" | "call" | "booking";

export interface IncomingAlertData {
  bookingId?: string;
  userId?: string;
  roomName?: string;
  userName?: string;
  clientName?: string;
  rate?: number;
  modality?: "chat" | "audio" | "video" | "physical";
  scheduledAt?: string;
}

export interface IncomingAlert {
  id: string;
  type: IncomingAlertType;
  message: string;
  data?: IncomingAlertData;
  read: boolean;
  createdAt: string;
}

interface AdminState {
  profile: AdminProfile | null;
  notifications: Notification[];
  unreadCount: number;
  isSocketConnected: boolean;
  incomingAlert: IncomingAlert | null;
  isAlertOpen: boolean;
  alertSoundMuted: boolean;
  isSidebarOpen: boolean;
  setProfile: (p: AdminProfile | null) => void;
  hasRole: (m: AdminRole) => boolean;
  addNotification: (n: Omit<Notification, "createdAt"> & { createdAt?: string }) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  setSocketConnected: (c: boolean) => void;
  showIncomingAlert: (a: Omit<IncomingAlert, "createdAt"> & { createdAt?: string }) => void;
  dismissAlert: () => void;
  toggleAlertSound: () => void;
  toggleSidebar: () => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      profile: null,
      notifications: [],
      unreadCount: 0,
      isSocketConnected: false,
      incomingAlert: null,
      isAlertOpen: false,
      alertSoundMuted: false,
      isSidebarOpen: true,

      setProfile: (profile) => set({ profile }),

      hasRole: (min) => {
        const role = get().profile?.role;
        return role ? ROLE_LEVEL[role] >= ROLE_LEVEL[min] : false;
      },

      addNotification: (notif) => {
        const createdAt = notif.createdAt || new Date().toISOString();
        let added = false;
        set((state) => {
          if (notif.id && state.notifications.some((n) => n.id === notif.id)) {
            return state;
          }
          added = true;
          const full = { ...notif, createdAt } as Notification;
          const updated = [full, ...state.notifications].slice(0, 100);
          return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length };
        });
        // Ring only for genuinely new notifications — re-delivered rows stay silent.
        if (added) playNotificationChime();
      },

      markNotificationRead: (id) =>
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        }),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      setSocketConnected: (connected) => set({ isSocketConnected: connected }),

      showIncomingAlert: (alert) =>
        set({
          incomingAlert: {
            ...alert,
            createdAt: alert.createdAt || new Date().toISOString(),
          } as IncomingAlert,
          isAlertOpen: true,
        }),

      dismissAlert: () => set({ isAlertOpen: false, incomingAlert: null }),

      toggleAlertSound: () => set((s) => ({ alertSoundMuted: !s.alertSoundMuted })),

      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("zeal-admin-storage");
          window.location.href = "/admin/login";
        }
      },
    }),
    {
      name: "zeal-admin-storage",
      storage: createJSONStorage(() => localStorage),
      // notifications must persist: read-state has to survive reloads, or
      // realtime re-delivery re-adds every dismissed notification as unread.
      partialize: (s) => ({
        profile: s.profile,
        notifications: s.notifications.slice(0, 50),
        alertSoundMuted: s.alertSoundMuted,
        isSidebarOpen: s.isSidebarOpen,
      }),
    }
  )
);
