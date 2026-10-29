"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useRoomIntake — the birth-detail form inside an AI room.
//
// Answers are stored against the authenticated seeker on the chat worker, so a
// consultant remembers them across rooms, devices and visits — and can never see
// a different seeker's. This hook only decides when to ask: it opens the modal
// when the worker reports a gap, and retires it once the gap is closed.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import type { IntakeData } from "@/components/chat/BirthIntakeModal";
import type { ProfileUpdate } from "@/hooks/useChat";

type MissingField = "name" | "dob" | "pob";

interface IntakeResponse {
  intake?: { hasBirthData?: boolean; chartStale?: boolean; missing?: MissingField[] };
  existingProfile?: Partial<IntakeData> | null;
  error?: string;
}

/** Once dismissed in a session the seeker gets the in-chat progressive ask
 *  instead of a second modal on the next room. */
const DISMISS_KEY = "zeal:birth-intake-dismissed";

export interface RoomIntake {
  /** Intake has been read (or failed readably) — safe to open the conversation. */
  ready: boolean;
  /** The form is on screen. */
  open: boolean;
  /** Transitioning from form submission to chat initialization. */
  transitioning: boolean;
  missing: MissingField[];
  prefill: Partial<IntakeData> | null;
  saving: boolean;
  error: string | null;
  dismiss: () => void;
  submit: (data: IntakeData) => Promise<void>;
  /** Fold in what a chat turn just taught the consultant. */
  applyProfileUpdate: (update: ProfileUpdate) => void;
  /** Clear the transitioning state once chat is active. */
  clearTransition: () => void;
}

export function useRoomIntake(enabled: boolean): RoomIntake {
  const [ready, setReady] = useState(!enabled);
  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [prefill, setPrefill] = useState<Partial<IntakeData> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat/intake", { cache: "no-store" });
        if (!res.ok) throw new Error(`intake HTTP ${res.status}`);
        const data = (await res.json()) as IntakeResponse;
        if (cancelled) return;
        const gaps = data.intake?.missing ?? [];
        setMissing(gaps);
        setPrefill(data.existingProfile ?? null);
        // Always show the intake form when starting a chat — even with existing data,
        // the seeker confirms/updates their birth details before the consultation begins.
        setOpen(true);
      } catch (err) {
        // Not fatal: the conversation works, the consultant simply asks for what
        // it needs as the chat goes on.
        console.warn("[useRoomIntake] load failed:", err instanceof Error ? err.message : err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode */ }
  }, []);

  const submit = useCallback(async (data: IntakeData) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/intake", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = (await res.json().catch(() => (null))) as IntakeResponse | null;
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      setMissing(payload?.intake?.missing ?? []);
      setPrefill(payload?.existingProfile ?? data);
      setOpen(false);
      setTransitioning(true);
      try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* private mode */ }
    } catch (err) {
      // Stay on the form with the seeker's answers intact — they only have to
      // press the button again, not retype their whole birth detail.
      setError(
        err instanceof Error && err.message.includes("Unauthorized")
          ? "Please sign in again to save your birth details."
          : "Couldn't save just now — check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }, []);

  const applyProfileUpdate = useCallback((update: ProfileUpdate) => {
    setMissing(update.missing ?? []);
    setOpen((wasOpen) => (wasOpen && (update.missing?.length ?? 0) === 0 ? false : wasOpen));
  }, []);

  const clearTransition = useCallback(() => {
    setTransitioning(false);
  }, []);

  return { ready, open, transitioning, missing, prefill, saving, error, dismiss, submit, applyProfileUpdate, clearTransition };
}
