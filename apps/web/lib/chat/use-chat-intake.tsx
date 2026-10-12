// apps/web/lib/chat/use-chat-intake.ts
// Hook that wraps startChatFlow with a pre-chat intake modal.
// Usage:
//   const { startChat, IntakeModal } = useChatIntake();
//   <button onClick={() => startChat(consultantId, consultantName)}>Start Chat</button>
//   <IntakeModal />
"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startChatFlow, type StartChatOptions } from "./start-chat-flow";
import { BirthIntakeModal, type IntakeData } from "@/components/chat/BirthIntakeModal";

interface IntakeState {
  open: boolean;
  consultantId: string;
  consultantName: string;
}

export function useChatIntake(
  options?: Pick<StartChatOptions, "onLowBalance" | "onError" | "onOffline">,
) {
  const router = useRouter();
  const [intake, setIntake] = useState<IntakeState | null>(null);
  const [existingProfile, setExistingProfile] = useState<Partial<IntakeData> | null>(null);
  const [saving, setSaving] = useState(false);

  const startChat = useCallback(
    async (consultantId: string, consultantName: string) => {
      try {
        const res = await fetch("/api/profile/birth", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { profile?: Partial<IntakeData> | null };
          if (data.profile?.fullName && data.profile?.dateOfBirth && data.profile?.placeOfBirth) {
            setExistingProfile(data.profile);
          }
        }
      } catch {
        // Non-critical — just skip pre-population
      }

      setIntake({ open: true, consultantId, consultantName });
    },
    [],
  );

  const handleSubmit = useCallback(
    async (data: IntakeData) => {
      if (!intake) return;
      setSaving(true);

      try {
        await fetch("/api/profile/birth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch {
        // Non-fatal — continue to chat even if save fails
      }

      setIntake(null);
      setSaving(false);

      await startChatFlow(intake.consultantId, {
        router,
        onLowBalance: options?.onLowBalance,
        onError: options?.onError,
        onOffline: options?.onOffline,
      });
    },
    [intake, router, options],
  );

  const IntakeModal = useCallback((): ReactNode => {
    if (!intake) return null;
    return (
      <BirthIntakeModal
        open={intake.open}
        onOpenChange={(open) => { if (!open) setIntake(null); }}
        consultantName={intake.consultantName}
        existingProfile={existingProfile}
        onSubmit={handleSubmit}
        isLoading={saving}
      />
    );
  }, [intake, existingProfile, handleSubmit, saving]);

  useEffect(() => {
    if (!intake) {
      setExistingProfile(null);
    }
  }, [intake]);

  return { startChat, IntakeModal };
}
