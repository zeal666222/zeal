export interface ConversationItem {
  sessionId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isOnline: boolean;
  isAI: boolean;
  lastMessage: string | null;
  lastMessageTime: string | null;
  lastMessageSenderId: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  createdAt: string;
  _optimistic?: boolean;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  referenceId?: string | null;
  createdAt: string;
}

export interface WalletState {
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
}

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface BroadcastChange<T = unknown> {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: T;
  old_record?: T | null;
}

export interface PresenceHandle<T> {
  unsubscribe: () => void;
  track: (state: T) => void;
  untrack: () => void;
}

export interface UseChannelOptions<T> {
  channel: string | null;
  event?: string;
  onMessage: (payload: T) => void;
  enabled?: boolean;
}

export interface UseChannelResult {
  isLive: boolean;
}

export interface UsePresenceResult<T extends Record<string, unknown>> {
  track: (state: T) => void;
  untrack: () => void;
}
