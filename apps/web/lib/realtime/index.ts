// apps/web/lib/realtime/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Compatibility barrel — re-exports @zeal/realtime and keeps serverPublish
// ═══════════════════════════════════════════════════════════════════════════════

export {
  getRealtimeClient,
  getConnectionState,
  onConnectionStateChange,
  subscribe,
  subscribePresence,
  publish,
  disconnectAll,
  channels,
} from "@zeal/realtime";

export type {
  ConnectionState,
  BroadcastChange,
  ChannelName,
} from "@zeal/realtime";

export { serverPublish } from "./server";
