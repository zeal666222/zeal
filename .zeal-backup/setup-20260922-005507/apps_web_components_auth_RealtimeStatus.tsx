"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type State = "checking" | "online" | "offline";

/** Small non-blocking badge — confirms Supabase Realtime is connected. */
export function RealtimeStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setState("offline");
      return;
    }
    let mounted = true;
    const ch = sb.channel("auth:heartbeat");
    ch.subscribe((status) => {
      if (!mounted) return;
      if (status === "SUBSCRIBED") setState("online");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        setState("offline");
    });
    return () => {
      mounted = false;
      void sb.removeChannel(ch);
    };
  }, []);

  if (state === "checking") return null;

  return (
    <div
      className={[
        "mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
        state === "online"
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-slate-500/10 text-slate-400 border border-slate-500/20",
      ].join(" ")}
    >
      {state === "online" ? <Wifi size={11} /> : <WifiOff size={11} />}
      {state === "online" ? "Realtime connected" : "Realtime offline"}
    </div>
  );
}
