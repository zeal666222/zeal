"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ImpersonationBanner — visible red banner when super-admin acts as another user
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";

interface ImpersonationState {
  targetUserId: string;
  targetName: string;
  expiresAt: string;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [state, setState] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("zeal-impersonate");
        if (!raw) { setState(null); return; }
        const parsed = JSON.parse(raw) as ImpersonationState;
        if (new Date(parsed.expiresAt).getTime() < Date.now()) {
          localStorage.removeItem("zeal-impersonate");
          setState(null);
          return;
        }
        setState(parsed);
      } catch { setState(null); }
    };
    
    // Initial read
    read();
    
    // Listen for storage changes (cross-tab sync - works with localStorage)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "zeal-impersonate") {
        read();
      }
    };
    
    window.addEventListener("storage", handleStorage);
    
    // Check expiry every 30 seconds
    const interval = setInterval(read, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  if (!state) return null;

  const stop = () => {
    localStorage.removeItem("zeal-impersonate");
    router.push("/admin/impersonate");
  };

  return (
    <div className="relative z-[90] bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ShieldAlert size={16} className="animate-pulse" />
          <span>Acting as: {state.targetName}</span>
          <span className="text-white/60 text-xs font-mono hidden md:inline">
            (expires {new Date(state.expiresAt).toLocaleTimeString()})
          </span>
        </div>
        <button onClick={stop}
          className="flex items-center gap-1 text-xs font-bold text-foreground bg-surface-raised hover:bg-surface-overlay px-3 py-1.5 rounded-lg transition-all">
          <X size={13} /> Stop Impersonation
        </button>
      </div>
    </div>
  );
}
