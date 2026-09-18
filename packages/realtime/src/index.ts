"use client";

export {
  getRealtimeClient,
  getConnectionState,
  onConnectionStateChange,
  subscribe,
  subscribePresence,
  publish,
  disconnectAll,
  type ConnectionState,
  type BroadcastChange,
  type PresenceHandle,
} from "./client";

export { channels, type ChannelName } from "./channels";

export {
  useChannel,
  useConnection,
  usePresence,
  type UseChannelOptions,
  type UseChannelResult,
  type UsePresenceResult,
} from "./hooks";
