// apps/web/lib/birth-profile.ts
// Fetches the user's birth profile and converts it to seekerContext for AI persona.
import type { PersonaInput } from "./ai/engine/persona-engine";

export interface BirthProfile {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth: string | null;
  timeOfBirth: string | null;
  placeOfBirth: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  gender: string | null;
  primaryConcern: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch the user's birth profile via the admin client (server-side only).
 * Returns null if not found or on error.
 */
export async function fetchBirthProfile(
  userId: string,
): Promise<BirthProfile | null> {
  try {
    const { createAdminClient } = await import("@zeal/database/server");
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("get_birth_profile", {
      p_user_id: userId,
    });

    if (error) {
      console.warn("[birth-profile] fetch failed:", error.message);
      return null;
    }

    const result = data as { success?: boolean; profile?: BirthProfile } | null;
    return result?.profile ?? null;
  } catch (err) {
    console.warn("[birth-profile] fetch error:", err);
    return null;
  }
}

/**
 * Convert a BirthProfile to the seekerContext shape expected by PersonaEngine.
 * Only includes fields that are actually set (non-empty).
 */
export function toSeekerContext(
  profile: BirthProfile | null,
): PersonaInput["seekerContext"] | undefined {
  if (!profile) return undefined;

  const ctx: PersonaInput["seekerContext"] = {};
  if (profile.fullName) ctx.name = profile.fullName;
  if (profile.dateOfBirth) ctx.dob = profile.dateOfBirth;
  if (profile.timeOfBirth) ctx.tob = profile.timeOfBirth;
  if (profile.placeOfBirth) ctx.pob = profile.placeOfBirth;
  if (profile.primaryConcern) ctx.concern = profile.primaryConcern;

  return Object.keys(ctx).length > 0 ? ctx : undefined;
}

/**
 * Check if a birth profile has enough data for astrology consultation.
 * Minimum: name + date of birth.
 */
export function isProfileComplete(profile: BirthProfile | null): boolean {
  if (!profile) return false;
  return Boolean(profile.fullName && profile.dateOfBirth);
}

/**
 * Get a list of missing fields for progressive enrichment.
 * Returns field keys the AI should ask about conversationally.
 */
export function getMissingFields(
  profile: BirthProfile | null,
): Array<"name" | "dob" | "tob" | "pob" | "concern"> {
  const missing: Array<"name" | "dob" | "tob" | "pob" | "concern"> = [];
  if (!profile) {
    return ["name", "dob", "tob", "pob", "concern"];
  }
  if (!profile.fullName) missing.push("name");
  if (!profile.dateOfBirth) missing.push("dob");
  if (!profile.timeOfBirth) missing.push("tob");
  if (!profile.placeOfBirth) missing.push("pob");
  if (!profile.primaryConcern) missing.push("concern");
  return missing;
}
