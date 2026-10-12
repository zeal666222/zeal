// apps/web/components/chat/BirthIntakeModal.tsx
// Pre-chat intake form — collects birth details before consultation starts.
// Industry-standard pattern: gate the chat room behind a quick form that
// saves to BirthProfile so the AI/human consultant has context immediately.
"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@zeal/ui";

export interface IntakeData {
  fullName: string;
  dateOfBirth: string;
  timeOfBirth: string | null;
  placeOfBirth: string;
  latitude: number | null;
  longitude: number | null;
  primaryConcern: string;
}

interface BirthIntakeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantName: string;
  existingProfile?: Partial<IntakeData> | null;
  onSubmit: (data: IntakeData) => void;
  isLoading?: boolean;
}

const CONCERN_SUGGESTIONS = [
  "Career & Finance",
  "Love & Relationships",
  "Health & Wellness",
  "Spiritual Growth",
  "Family & Home",
  "Life Purpose",
] as const;

export function BirthIntakeModal({
  open,
  onOpenChange,
  consultantName,
  existingProfile,
  onSubmit,
  isLoading = false,
}: BirthIntakeModalProps) {
  const [step, setStep] = useState<"form" | "saving">("form");
  const [fullName, setFullName] = useState(existingProfile?.fullName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(existingProfile?.dateOfBirth ?? "");
  const [timeUnknown, setTimeUnknown] = useState(!existingProfile?.timeOfBirth);
  const [timeOfBirth, setTimeOfBirth] = useState(existingProfile?.timeOfBirth ?? "");
  const [placeOfBirth, setPlaceOfBirth] = useState(existingProfile?.placeOfBirth ?? "");
  const [primaryConcern, setPrimaryConcern] = useState(existingProfile?.primaryConcern ?? "");

  const canSubmit = fullName.trim() && dateOfBirth && placeOfBirth.trim();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStep("saving");

    const data: IntakeData = {
      fullName: fullName.trim(),
      dateOfBirth,
      timeOfBirth: timeUnknown ? null : timeOfBirth || null,
      placeOfBirth: placeOfBirth.trim(),
      latitude: null,
      longitude: null,
      primaryConcern: primaryConcern.trim(),
    };

    onSubmit(data);
  }, [canSubmit, fullName, dateOfBirth, timeUnknown, timeOfBirth, placeOfBirth, primaryConcern, onSubmit]);

  const handleTimeToggle = useCallback(() => {
    setTimeUnknown((prev) => {
      if (!prev) setTimeOfBirth("");
      return !prev;
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            Before you begin with {consultantName}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--color-muted-foreground)]">
            Share a few details so your consultation is personalised and accurate.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-2"
            >
              {/* Name */}
              <Field label="Your Name" required>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className={inputClass}
                  autoFocus
                />
              </Field>

              {/* Date of Birth */}
              <Field label="Date of Birth" required>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className={inputClass}
                />
              </Field>

              {/* Time of Birth */}
              <Field label="Time of Birth">
                <div className="space-y-2">
                  {timeUnknown ? (
                    <button
                      type="button"
                      onClick={handleTimeToggle}
                      className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.03] border border-border hover:border-[var(--color-primary)]/40 transition-all text-sm text-[var(--color-muted-foreground)]"
                    >
                      I don&apos;t know my exact time — tap to enter it
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={timeOfBirth}
                        onChange={(e) => setTimeOfBirth(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={handleTimeToggle}
                        className="px-3 py-2 rounded-xl text-xs bg-surface-raised border border-border hover:border-rose-500/40 text-[var(--color-muted-foreground)] transition-all"
                      >
                        Don&apos;t know
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Exact time gives deeper insights, but it&apos;s okay if you don&apos;t know it.
                  </p>
                </div>
              </Field>

              {/* Place of Birth */}
              <Field label="Place of Birth" required>
                <input
                  type="text"
                  value={placeOfBirth}
                  onChange={(e) => setPlaceOfBirth(e.target.value)}
                  placeholder="City, State, Country"
                  className={inputClass}
                />
              </Field>

              {/* Primary Concern */}
              <Field label="What brings you here?">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={primaryConcern}
                    onChange={(e) => setPrimaryConcern(e.target.value)}
                    placeholder="Describe what's on your mind…"
                    className={inputClass}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CONCERN_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPrimaryConcern(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all active:scale-95 ${
                          primaryConcern === s
                            ? "bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]"
                            : "bg-surface-raised border-border hover:border-[var(--color-primary)]/30 text-[var(--color-muted-foreground)]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>

              {/* Submit */}
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                whileTap={canSubmit ? { scale: 0.98 } : {}}
                className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all ${
                  canSubmit && !isLoading
                    ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-lg shadow-[var(--color-primary-hover)]/20 hover:opacity-95"
                    : "bg-surface-raised text-[var(--color-muted-foreground)] cursor-not-allowed"
                }`}
              >
                {isLoading ? "Starting consultation…" : "Start Consultation"}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="saving"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 gap-3"
            >
              <div className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Setting up your consultation…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[var(--color-foreground)]">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-border text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]/50 focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20 transition-all";
