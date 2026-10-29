"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// usePWA — service worker registration + install prompt handling
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        setSwReady(reg.active !== null);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") setSwReady(true);
          });
        });
      } catch {
        // SW registration failed — non-critical
      }
    };

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    void register();
    setIsOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === "accepted";
  }, [deferredPrompt]);

  const updateServiceWorker = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
      }
    }
  }, []);

  return { isInstallable, isOffline, swReady, promptInstall, updateServiceWorker };
}
