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
