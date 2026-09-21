"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ImpersonationBanner — visible red banner when super-admin acts as another user
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

interface ImpersonationState {
  targetUserId: string;
  targetName: string;
  expiresAt: string;
}

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem("zeal-impersonate");
        if (!raw) { setState(null); return; }
        const parsed = JSON.parse(raw) as ImpersonationState;
        if (new Date(parsed.expiresAt).getTime() < Date.now()) {
          sessionStorage.removeItem("zeal-impersonate");
          setState(null);
          return;
        }
        setState(parsed);
      } catch { setState(null); }
    };
    read();
    const interval = setInterval(read, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!state) return null;

  const stop = () => {
    sessionStorage.removeItem("zeal-impersonate");
    window.location.href = "/impersonate";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ShieldAlert size={16} className="animate-pulse" />
          <span>Acting as: {state.targetName}</span>
          <span className="text-white/60 text-xs font-mono hidden md:inline">
            (expires {new Date(state.expiresAt).toLocaleTimeString()})
          </span>
        </div>
        <button onClick={stop}
          className="flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all">
          <X size={13} /> Stop Impersonation
        </button>
      </div>
    </div>
  );
}
