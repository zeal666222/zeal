// packages/realtime/src/types.ts — types only, no "use client", no runtime imports
export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export type ConnectionQuality = "excellent" | "good" | "poor" | "offline";

export interface ConnectionQualityStats {
  quality: ConnectionQuality;
  latencyMs: number;
  activeChannels: number;
  totalListeners: number;
  eventsReceived: number;
  eventsSent: number;
  eventsDropped: number;
  reconnectCount: number;
  uptimeMs: number;
  lastEventAt: number | null;
}

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

export interface UseChannelResult { isLive: boolean; }

export interface MultiChannelSubscription {
  channel: string;
  event?: string;
}

export interface UsePresenceResult<T extends Record<string, unknown>> {
  track: (state: T) => void;
  untrack: () => void;
}
