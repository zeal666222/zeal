"use client";
import { usePWA } from "@/hooks/usePWA";
import { Download, X } from "lucide-react";
import { useState } from "react";

export function PWAInstallBanner() {
  const { isInstallable, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 z-[60] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-surface-raised border border-border rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center shrink-0">
          <Download size={18} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Install Zeal app</p>
          <p className="text-xs text-muted-foreground mt-0.5">Get instant access from your home screen</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => void promptInstall()}
              className="px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold active:scale-95 transition-all"
            >
              Install
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 rounded-lg bg-surface-overlay text-muted-foreground text-xs font-medium active:scale-95 transition-all"
            >
              Later
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 rounded-lg hover:bg-surface-overlay text-muted-foreground" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
