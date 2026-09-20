"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// useRealtimeStatus — exposes connection state + reconnect metadata
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useConnection, type ConnectionState } from "@zeal/realtime";

interface RealtimeStatus {
  state: ConnectionState;
  isConnected: boolean;
  lastChangeAt: number;
  offlineSince: number | null;
  reconnectCount: number;
}

export function useRealtimeStatus(): RealtimeStatus {
  const state = useConnection();
  const [lastChangeAt, setLastChangeAt] = useState(Date.now());
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const prevRef = useRef<ConnectionState>(state);

  useEffect(() => {
    if (state === prevRef.current) return;
    setLastChangeAt(Date.now());

    if (state === "disconnected" || state === "reconnecting") {
      if (offlineSince === null) setOfflineSince(Date.now());
    } else if (state === "connected") {
      if (offlineSince !== null) setReconnectCount((c) => c + 1);
      setOfflineSince(null);
    }
    prevRef.current = state;
  }, [state, offlineSince]);

  return {
    state,
    isConnected: state === "connected",
    lastChangeAt,
    offlineSince,
    reconnectCount,
  };
}
