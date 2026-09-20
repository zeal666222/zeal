"use client";
// ZEAL_FIX_PHASE2_HEARTBEAT_HOOK
// Pings every 25s while visible. Server cleanup runs at 120s stale.
import { useEffect, useRef } from "react";

const HEARTBEAT_MS = 25_000;

export function useConsultantHeartbeat(enabled: boolean) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const ping = async () => {
      if (cancelled || document.hidden) return;
      try {
        await fetch("/api/consultant/heartbeat", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        });
      } catch { /* best-effort */ }
    };

    void ping();
    timer.current = setInterval(ping, HEARTBEAT_MS);

    const onVisible = () => { if (!document.hidden) void ping(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}
