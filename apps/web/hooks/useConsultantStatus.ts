"use client";
// ZEAL_FIX_FE_STATUS_HOOK
// Subscribe to a single consultant's online status via the consultants:live channel.
import { useEffect, useState } from "react";
import { useChannel, channels } from "@zeal/realtime";

interface StatusPayload {
  consultantId?: string;
  is_online?: boolean;
  at?: string;
}

export function useConsultantStatus(
  consultantId: string | null,
  initial = false,
) {
  const [isOnline, setIsOnline] = useState(initial);

  useEffect(() => {
    setIsOnline(initial);
  }, [consultantId, initial]);

  useChannel<StatusPayload>({
    channel: consultantId ? channels.consultantsLive() : null,
    event: "*",
    onMessage: (p) => {
      if (!p?.consultantId || p.consultantId !== consultantId) return;
      if (typeof p.is_online === "boolean") setIsOnline(p.is_online);
    },
  });

  return isOnline;
}
