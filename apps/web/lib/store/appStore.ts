import {create} from 'zustand';
import {persist, devtools, createJSONStorage} from 'zustand/middleware';
import {immer} from 'zustand/middleware/immer';
export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  sparks: number;
  role: 'USER' | 'HEALER' | 'ADMIN' | 'SUPER_ADMIN';
  isVerified: boolean;
  consultantId?: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
}

export interface Notification {
  id: string;
  type:
    | "chat"
    | "call"
    | "booking"
    | "system"
    | "referral"
    | "quest"
    | "new_post"
    | "payment"
    | "verification"
    | "reminder";
  message: string;
  redirectUrl: string | null;
  read: boolean;
  actorId: string;
  actorName?: string;
  actorAvatar?: string;
  createdAt: string;
}

interface AppState {
  user: User | null;
  wallet: Wallet | null;
  notifications: Notification[];
  isSocketConnected: boolean;
  isOnline: boolean;
  activeCallSession: string | null;
  lastActivity: string | null;

  get unreadCount(): number;
  get totalBalance(): number;
  get isAuthenticated(): boolean;
  get isConsultant(): boolean;
  get isAdmin(): boolean;

  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  setWallet: (wallet: Wallet | null) => void;
  updateWallet: (updates: Partial<Wallet>) => void;
  addNotification: (notif: Omit<Notification, 'createdAt'>) => void;
  markAllRead: () => void;
  markNotificationRead: (id: string) => void;
  setSocketConnected: (connected: boolean) => void;
  setOnline: (online: boolean) => void;
  setActiveCall: (sessionId: string | null) => void;
  updateLastActivity: () => void;
  logout: () => void;
  reset: () => void;
}

const initialState = {
  user: null,
  wallet: null,
  notifications: [],
  isSocketConnected: false,
  isOnline: false,
  activeCallSession: null,
  lastActivity: null,
};

export const useAppStore = create<AppState>()(
  persist(
    devtools(
      immer((set, get) => ({
        ...initialState,

        get unreadCount() {
          return get().notifications.filter((n) => !n.read).length;
        },
        get totalBalance() {
          const wallet = get().wallet;
          return wallet ? wallet.balance + wallet.escrow + wallet.pendingIn : 0;
        },
        get isAuthenticated() {
          return !!get().user;
        },
        get isConsultant() {
          return get().user?.role === 'HEALER';
        },
        get isAdmin() {
          const role = get().user?.role;
          return role === 'ADMIN' || role === 'SUPER_ADMIN';
        },

        setUser: (user) => set((state) => { state.user = user; }),
        updateUser: (updates) => set((state) => { if (state.user) Object.assign(state.user, updates); }),
        setWallet: (wallet) => set((state) => { state.wallet = wallet; }),
        updateWallet: (updates) => set((state) => { if (state.wallet) Object.assign(state.wallet, updates); }),

        addNotification: (notif) => {
          set((state) => {
            const createdAt = new Date().toISOString();
            state.notifications.unshift({ ...notif, createdAt } as Notification);
            if (state.notifications.length > 100) state.notifications = state.notifications.slice(0, 100);
          });
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Zeal', { body: notif.message, icon: '/favicon.ico' });
          }
        },

        markAllRead: () => set((state) => { state.notifications.forEach((n) => n.read = true); }),
        markNotificationRead: (id) => set((state) => {
          const notif = state.notifications.find((n) => n.id === id);
          if (notif) notif.read = true;
        }),

        setSocketConnected: (connected) => set((state) => { state.isSocketConnected = connected; }),
        setOnline: (online) => set((state) => { state.isOnline = online; }),
        setActiveCall: (sessionId) => set((state) => { state.activeCallSession = sessionId; }),
        updateLastActivity: () => set((state) => { state.lastActivity = new Date().toISOString(); }),

        logout: () => {
          localStorage.removeItem('zeal-storage');
          set(() => ({ ...initialState }));
          if (typeof window !== 'undefined') window.location.href = '/auth/login';
        },

        reset: () => set(() => ({ ...initialState })),
      })),
      { name: 'app-store', enabled: process.env.NODE_ENV === 'development' }
    ),
    {
      name: 'zeal-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: AppState) => ({
        user: state.user,
        wallet: state.wallet,
        notifications: state.notifications.slice(0, 50),
        isOnline: state.isOnline,
      }),
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0 || version === 1) {
          return { ...(persistedState as Record<string, unknown>), activeCallSession: null, lastActivity: null };
        }
        return persistedState;
      },
    }
  )
);

export const selectUser = (state: AppState) => state.user;
export const selectWallet = (state: AppState) => state.wallet;
export const selectNotifications = (state: AppState) => state.notifications;
export const selectUnreadCount = (state: AppState) => state.unreadCount;
export const selectIsAuthenticated = (state: AppState) => state.isAuthenticated;
export const selectIsConsultant = (state: AppState) => state.isConsultant;
export const selectIsAdmin = (state: AppState) => state.isAdmin;

import {useShallow} from 'zustand/react/shallow';
export const useAppStoreShallow = <T>(selector: (state: AppState) => T) => {
  return useAppStore(useShallow(selector));
};

// BATCH1_APPLIED

// ─── Cross-tab profile sync ──────────────────────────────────────────────────
// The Zustand persist middleware writes to localStorage, but other tabs do
// not rehydrate automatically. A user updating their avatar in tab A expects
// the header chip in tab B to reflect it in the same frame. We broadcast the
// persisted slice over a BroadcastChannel and re-apply it in the receiving
// tabs. Falls back to the `storage` event on browsers where the channel is
// unavailable (Safari in a private window).
const SYNC_CHANNEL = "zeal-store-sync";
type SyncSlice = { user: User | null; wallet: Wallet | null };

let __channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (__channel) return __channel;
  if (typeof BroadcastChannel === "undefined") return null;
  __channel = new BroadcastChannel(SYNC_CHANNEL);
  __channel.onmessage = (ev: MessageEvent<SyncSlice>) => {
    const { user, wallet } = ev.data || ({} as SyncSlice);
    // Never overwrite a signed-out tab with a signed-in one, and vice versa.
    const current = useAppStore.getState().user;
    if (user && current && current.id !== user.id) return;
    if (user) useAppStore.setState({ user });
    if (wallet) useAppStore.setState({ wallet });
  };
  return __channel;
}

if (typeof window !== "undefined") {
  getChannel();

  useAppStore.subscribe((state, prev) => {
    if (state.user === prev.user && state.wallet === prev.wallet) return;
    const ch = getChannel();
    if (ch) {
      ch.postMessage({ user: state.user, wallet: state.wallet } satisfies SyncSlice);
      return;
    }
    // Fallback: storage event fires in the OTHER tabs when we write localStorage.
    try {
      localStorage.setItem(
        "zeal-storage:cross-tab",
        JSON.stringify({ t: Date.now(), user: state.user, wallet: state.wallet }),
      );
    } catch { /* quota — non-fatal */ }
  });

  if (typeof BroadcastChannel === "undefined") {
    window.addEventListener("storage", (ev) => {
      if (ev.key !== "zeal-storage:cross-tab" || !ev.newValue) return;
      try {
        const { user, wallet } = JSON.parse(ev.newValue) as SyncSlice;
        const current = useAppStore.getState().user;
        if (user && current && current.id !== user.id) return;
        if (user) useAppStore.setState({ user });
        if (wallet) useAppStore.setState({ wallet });
      } catch { /* malformed — ignore */ }
    });
  }
}
