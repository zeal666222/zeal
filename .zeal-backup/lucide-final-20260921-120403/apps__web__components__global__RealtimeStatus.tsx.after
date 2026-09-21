"use client";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";

export function RealtimeStatus() {
  const { state, isConnected } = useRealtimeStatus();

  const config = {
    connected:    { icon: Wifi,   label: "Live",         color: "text-emerald-400", pulse: true },
    connecting:   { icon: Loader2,label: "Connecting",   color: "text-amber-400",   pulse: false },
    reconnecting: { icon: Loader2,label: "Reconnecting", color: "text-orange-400",  pulse: false },
    disconnected: { icon: WifiOff,label: "Offline",      color: "text-rose-400",    pulse: false },
  }[state];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
      <Icon size={10} className={config.pulse ? "animate-pulse" : ""} />
      {config.label}
    </span>
  );
}
