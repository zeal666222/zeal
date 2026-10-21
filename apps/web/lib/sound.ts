// ═══════════════════════════════════════════════════════════════════════════════
// Zeal sound engine — synthesized UI audio, zero audio assets.
// ───────────────────────────────────────────────────────────────────────────────
// Everything is generated with the Web Audio API on demand: no files to
// download, no network cost, and tones only play after the browser's autoplay
// policy allows it (first user gesture unlocks the context).
// Preference is persisted in localStorage under "zeal-sound" and broadcast via
// a custom event + the storage event so every toggle stays in sync.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

const PREF_KEY = "zeal-sound";
export const SOUND_CHANGE_EVENT = "zeal:sound-change";

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
let unlockBound = false;

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* private mode — preference won't persist, still apply for this session */
  }
  window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT, { detail: on }));
  if (on) getCtx();
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Browsers keep an AudioContext suspended until a user gesture. Bind one-time
// unlock listeners the first time any sound is requested; every navigation
// click or keypress afterwards silently warms the context.
function bindUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => getCtx();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}

interface ToneOpts {
  freq: number;
  startAt: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  sweepTo?: number;
}

function tone(ac: AudioContext, o: ToneOpts): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.startAt);
  if (o.sweepTo) osc.frequency.exponentialRampToValueAtTime(o.sweepTo, o.startAt + o.dur);
  g.gain.setValueAtTime(0.0001, o.startAt);
  g.gain.exponentialRampToValueAtTime(o.gain, o.startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, o.startAt + o.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(o.startAt);
  osc.stop(o.startAt + o.dur + 0.05);
}

// Notification arrival: a two-note temple bell (A5 → E6, a fifth up) with a
// faint octave shimmer. Long soft decay so it reads as a chime, not an alarm.
export function playNotificationChime(): void {
  if (!isSoundEnabled()) return;
  bindUnlock();
  const ac = getCtx();
  if (!ac) return;
  try {
    const t = ac.currentTime + 0.01;
    tone(ac, { freq: 880, startAt: t, dur: 0.9, gain: 0.10 });
    tone(ac, { freq: 1760, startAt: t, dur: 0.5, gain: 0.025 });
    tone(ac, { freq: 1318.51, startAt: t + 0.11, dur: 1.1, gain: 0.09 });
    tone(ac, { freq: 2637.02, startAt: t + 0.11, dur: 0.4, gain: 0.015 });
  } catch {
    /* audio unavailable — never break the app for a sound */
  }
}

// Route-transition loader: a soft rising sweep that mirrors the lockup draw
// animation. Kept quiet (≤0.045 gain) so frequent navigations never grate.
export function playLoaderTone(): void {
  if (!isSoundEnabled()) return;
  bindUnlock();
  const ac = getCtx();
  if (!ac) return;
  try {
    const t = ac.currentTime + 0.01;
    tone(ac, { freq: 320, sweepTo: 640, startAt: t, dur: 0.4, gain: 0.045 });
    tone(ac, { freq: 640, sweepTo: 960, startAt: t + 0.18, dur: 0.35, gain: 0.022 });
  } catch {
    /* audio unavailable — never break the app for a sound */
  }
}

export function useSoundEnabled(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(isSoundEnabled);

  useEffect(() => {
    const sync = () => setOn(isSoundEnabled());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREF_KEY) sync();
    };
    window.addEventListener(SOUND_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SOUND_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [on, setSoundEnabled];
}
