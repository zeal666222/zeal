// apps/admin/components/admin/RealtimeIndicator.tsx
"use client";

import {useConnection, type ConnectionState} from "@zeal/realtime";
import {cn} from "@zeal/ui";

const STYLE: Record<ConnectionState, { dot: string; label: string; text: string }> = {
  connected:    { dot: "bg-emerald-500",  label: "Live",         text: "text-emerald-400" },
  connecting:   { dot: "bg-amber-400",    label: "Connecting",   text: "text-amber-400" },
  reconnecting: { dot: "bg-orange-500",   label: "Reconnecting", text: "text-orange-400" },
  disconnected: { dot: "bg-rose-500",     label: "Offline",      text: "text-rose-400" },
};

export function RealtimeIndicator({ className }: { className?: string }) {
  const state = useConnection();
  const s = STYLE[state];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-bold", s.text, className)}
      title={`Realtime: ${state}`}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot, state === "connected" && "animate-pulse")} />
      {s.label}
    </span>
  );
}
