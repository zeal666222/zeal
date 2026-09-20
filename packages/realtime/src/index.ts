// packages/realtime/src/index.ts
// ⚠ No "use client" here. The directive lives only on client.ts and hooks.ts.
export {
  getRealtimeClient, getConnectionState, onConnectionStateChange,
  subscribe, subscribePresence, publish, disconnectAll,
} from "./client";
export { channels } from "./channels";
export { useChannel, useConnection, usePresence } from "./hooks";
export type {
  ConnectionState, BroadcastChange, PresenceHandle,
  UseChannelOptions, UseChannelResult, UsePresenceResult,
} from "./types";
export type { ChannelName } from "./channels";
