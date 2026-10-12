// packages/realtime/src/index.ts
// ⚠ No "use client" here. The directive lives only on client.ts and hooks.ts.
export {
  getRealtimeClient, getConnectionState, getConnectionQuality,
  onConnectionStateChange, onConnectionQualityChange,
  subscribe, subscribePresence, publish, disconnectAll,
} from "./client";
export { channels } from "./channels";
export { useChannel, useMultiChannel, useConnection, useConnectionQuality, usePresence } from "./hooks";
export type {
  ConnectionState, ConnectionQuality, ConnectionQualityStats,
  BroadcastChange, PresenceHandle,
  UseChannelOptions, UseChannelResult, MultiChannelSubscription,
  UsePresenceResult,
} from "./types";
export type { ChannelName } from "./channels";
