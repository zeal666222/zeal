"use client";
// ZEAL_FIX_FE_DIRECTORY_HOOK
// Subscribes to consultants:live and invalidates the directory query on change.
import { useQueryClient } from "@tanstack/react-query";
import { useChannel, channels } from "@zeal/realtime";

export function useRealtimeDirectory() {
  const qc = useQueryClient();

  useChannel<{ consultantId?: string }>({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: () => {
      void qc.invalidateQueries({ queryKey: ["consultants"] });
      void qc.invalidateQueries({ queryKey: ["explore", "consultants"] });
    },
  });
}
