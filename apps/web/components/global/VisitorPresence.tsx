"use client";

import { useVisitorPresence, type VisitorIdentity } from "@/hooks/useVisitorPresence";

interface ProfileShape {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export function VisitorPresence({ profile }: { profile: ProfileShape | null }) {
  const identity: VisitorIdentity | null = profile
    ? { id: profile.id, name: profile.full_name ?? null, avatar: profile.avatar_url ?? null }
    : null;
  useVisitorPresence(identity);
  return null;
}
