// apps/admin/types/chat.ts
// ⚠ Type-only. NO "use client", NO runtime imports.
// With verbatimModuleSyntax, `export type { … } from "…"` is erased entirely
// by TypeScript before the bundler sees it. This breaks the server/client chain.
export type {
  ConversationItem,
  ChatMessage,
  LedgerEntry,
  WalletState,
} from "./chat-types";

export type {
  ConnectionState,
  BroadcastChange,
  PresenceHandle,
  UseChannelOptions,
  UseChannelResult,
  UsePresenceResult,
} from "./realtime-types";
