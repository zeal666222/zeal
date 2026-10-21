"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { usePresence, channels } from "@zeal/realtime";

export interface VisitorPresenceState extends Record<string, unknown> {
  path: string;
  name: string | null;
  avatar: string | null;
  onlineAt: string;
}

export interface VisitorIdentity {
  id: string;
  name?: string | null;
  avatar?: string | null;
}

// Tracks the current tab on the site-wide presence channel. Presence state is
// replaced (not appended) on every route change, so `onlineAt` doubles as the
// visitor's last-activity timestamp — no heartbeat timers needed.
export function useVisitorPresence(identity: VisitorIdentity | null): void {
  const pathname = usePathname();
  const keyRef = useRef<string>("");
  const identityRef = useRef(identity);
  identityRef.current = identity;

  if (!keyRef.current && typeof window !== "undefined") {
    keyRef.current = identity?.id
      ?? sessionStorage.getItem("zeal-visitor-key")
      ?? `anon-${Math.random().toString(36).slice(2, 10)}`;
    if (!identity?.id) sessionStorage.setItem("zeal-visitor-key", keyRef.current);
  }

  const { track } = usePresence<VisitorPresenceState>(
    channels.sitePresence(),
    keyRef.current || "anon-ssr",
    () => {},
  );

  useEffect(() => {
    track({
      path: pathname,
      name: identity?.name ?? null,
      avatar: identity?.avatar ?? null,
      onlineAt: new Date().toISOString(),
    });
  }, [pathname, track, identity?.name, identity?.avatar, identity?.id]);

  // Presence auto-expires when the socket closes, but a hidden tab keeps the
  // socket open forever — untrack on hidden so "active" means actually looking.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        track({
          path: pathname,
          name: identityRef.current?.name ?? null,
          avatar: identityRef.current?.avatar ?? null,
          onlineAt: new Date().toISOString(),
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pathname, track]);
}
