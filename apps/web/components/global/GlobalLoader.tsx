"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// GlobalLoader — the cinematic route-transition splash
// ═══════════════════════════════════════════════════════════════════════════════
// Fires on three signals: (1) app boot, (2) any same-origin <Link>/anchor click,
// (3) browser back/forward via popstate. Hides once the pathname commits and the
// minimum visible window has elapsed, so quick navigations still feel intentional
// and slow ones never flash. Choreography is CSS + SMIL only (never framer) — the
// brand clock in packages/ui/src/tokens.css is what defines motion here.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ZealLockup } from "@zeal/ui";
import { playLoaderTone } from "@/lib/sound";

const BOOT_VISIBLE_MS = 1250;
const MIN_VISIBLE_MS = 520;
const EXIT_MS = 260;

const TAGLINES = [
  "Aligning your chart…",
  "Reading the transits…",
  "Summoning the reading…",
  "Consulting the grahas…",
];

type Phase = "idle" | "showing" | "exiting";

export function GlobalLoader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("showing");
  const [taglineIdx, setTaglineIdx] = useState(0);

  const shownAtRef = useRef<number>(performance.now());
  const lastPathRef = useRef<string>(pathname);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("showing");
  phaseRef.current = phase;

  // Boot: after a fixed window, begin the exit sequence.
  useEffect(() => {
    // The context is almost always still suspended at boot (autoplay policy),
    // so this first attempt is usually silent — it warms the context for the
    // next navigation, which is always triggered by a gesture.
    playLoaderTone();
    const t = setTimeout(() => beginExit(), BOOT_VISIBLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient tagline cycle while visible.
  useEffect(() => {
    if (phase === "idle") return;
    const t = setInterval(
      () => setTaglineIdx((i) => (i + 1) % TAGLINES.length),
      1500,
    );
    return () => clearInterval(t);
  }, [phase]);

  function clearTimers() {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  }

  const beginShow = () => {
    if (phaseRef.current === "showing") return;
    clearTimers();
    shownAtRef.current = performance.now();
    setPhase("showing");
    playLoaderTone();
  };

  const beginExit = () => {
    if (phaseRef.current !== "showing") return;
    const elapsed = performance.now() - shownAtRef.current;
    const holdFor = Math.max(0, MIN_VISIBLE_MS - elapsed);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setPhase("exiting");
      unmountTimerRef.current = setTimeout(() => {
        unmountTimerRef.current = null;
        setPhase("idle");
      }, EXIT_MS);
    }, holdFor);
  };

  // Intercept same-origin navigation. We listen on the capture phase so the
  // loader paints before Next's router commits the new route.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const u = new URL(href, window.location.origin);
        if (u.origin !== window.location.origin) return;
        if (u.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      beginShow();
    };
    const onPopState = () => beginShow();
    const onCustomStart = () => beginShow();
    const onCustomStop = () => beginExit();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("zeal:navigate-start", onCustomStart as EventListener);
    window.addEventListener("zeal:navigate-end", onCustomStop as EventListener);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("zeal:navigate-start", onCustomStart as EventListener);
      window.removeEventListener("zeal:navigate-end", onCustomStop as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route committed → fade out.
  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;
    if (phaseRef.current !== "idle") beginExit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (phase === "idle") return null;

  const exiting = phase === "exiting";

  return (
    <div
      className={`gl-root${exiting ? " gl-root--exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
    >
      <div className="gl-veil" aria-hidden>
        <div className="gl-aurora" />
        <div className="gl-blob gl-blob--a" />
        <div className="gl-blob gl-blob--b" />
        <div className="gl-blob gl-blob--c" />
        <div className="gl-stars" />
        <div className="gl-grid" />
      </div>

      <div className="gl-stage" aria-hidden>
        <div className="gl-halo" />
        <div className="gl-lockup">
          <ZealLockup size={104} detail="full" draw glow showWordmark showRule />
        </div>
        <div className="gl-tagline" key={taglineIdx}>
          {TAGLINES[taglineIdx]}
        </div>
      </div>

      <div className="gl-rail" aria-hidden>
        <div className="gl-rail__track" />
        <div className="gl-rail__sweep" />
        <div className="gl-rail__orbit">
          <span className="gl-rail__planet gl-rail__planet--sun" />
          <span className="gl-rail__planet gl-rail__planet--moon" />
          <span className="gl-rail__planet gl-rail__planet--venus" />
        </div>
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}
