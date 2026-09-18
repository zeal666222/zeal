"use client";

import { useConnection, type ConnectionState } from "@zeal/realtime";

const COLOR: Record<ConnectionState, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-400",
  reconnecting: "bg-orange-500",
  disconnected: "bg-red-500",
};

const LABEL: Record<ConnectionState, string> = {
  connected: "Live",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

export function ConnectionBadge() {
  const state = useConnection();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-white/80"
      title={`Realtime: ${state}`}
    >
      <span
        className={
          "inline-block w-2 h-2 rounded-full " +
          COLOR[state] +
          (state === "connected" ? " animate-pulse" : "")
        }
      />
      {LABEL[state]}
    </span>
  );
}
