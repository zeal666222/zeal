// apps/web/lib/chat/astro-context.ts
// Server-side: turn the seeker's saved BirthProfile into a deterministic,
// kundali-grounded context blob that is handed to the Cloudflare chat worker
// on every AI turn. The chart is COMPUTED here (the worker has no ephemeris);
// the worker only renders it into the persona prompt.
//
// Design notes:
//   • The chart is deterministic for a given (dob, tob, pob) triple, so we
//     memoise the formatted block per-isolate for a few hours. This keeps a
//     per-minute billed chat from recomputing the ephemeris on every turn.
//   • Time-of-birth is optional in intake; when absent we compute at local
//     noon and let the engine's own confidence score flag the reduced
//     precision — better a grounded reading than none.

import { fetchBirthProfile } from "@/lib/birth-profile";
import { resolvePlace, timezoneFromLng, type ResolvedPlace } from "@/lib/kundali/geocoder";
import { computeKundali, formatKundaliForPrompt } from "@/lib/kundali/engine";

export interface AstroContext {
  name?: string;
  dob?: string;
  tob?: string;
  pob?: string;
  concern?: string;
  /** Formatted deterministic chart block; null when the birth data is
   *  incomplete enough that a chart cannot be trusted. */
  chartSummary?: string | null;
}

interface CacheEntry {
  summary: string | null;
  at: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const chartCache = new Map<string, CacheEntry>();

async function resolvedFromProfile(
  placeOfBirth: string,
  latitude: number | null,
  longitude: number | null,
): Promise<ResolvedPlace | null> {
  // Gazetteer / Nominatim give us an IANA timezone, which the ephemeris needs.
  const resolved = await resolvePlace(placeOfBirth, { timeoutMs: 3000 });
  if (resolved) return resolved;

  // Saved coordinates without a resolvable tz → derive a civil approximation.
  if (latitude != null && longitude != null) {
    return {
      lat: latitude,
      lng: longitude,
      timezone: timezoneFromLng(longitude),
      canonicalName: placeOfBirth,
      country: "",
      source: "nominatim",
    };
  }
  return null;
}

async function buildChartSummary(
  name: string,
  dob: string,
  tob: string,
  pob: string,
  latitude: number | null,
  longitude: number | null,
): Promise<string | null> {
  const key = `${dob}|${tob}|${pob}|${latitude ?? ""}|${longitude ?? ""}`;
  const hit = chartCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.summary;

  let summary: string | null = null;
  try {
    const resolved = await resolvedFromProfile(pob, latitude, longitude);
    if (resolved) {
      summary = formatKundaliForPrompt(
        computeKundali(name || "Seeker", dob, tob, pob, resolved),
      );
    }
  } catch (err) {
    console.warn("[astro-context] chart compute failed:", err instanceof Error ? err.message : err);
    summary = null;
  }

  chartCache.set(key, { summary, at: Date.now() });
  return summary;
}

/**
 * Load the seeker's saved birth profile and compute the kundali block.
 * Returns an AstroContext that is safe to forward to the worker verbatim.
 */
export async function buildAstroContext(userId: string): Promise<AstroContext> {
  const profile = await fetchBirthProfile(userId);
  if (!profile) return {};

  const ctx: AstroContext = {
    name: profile.fullName || undefined,
    dob: profile.dateOfBirth || undefined,
    tob: profile.timeOfBirth || undefined,
    pob: profile.placeOfBirth || undefined,
    concern: profile.primaryConcern || undefined,
  };

  // A chart needs at least a birth date and a place.
  if (!profile.dateOfBirth || !profile.placeOfBirth) {
    ctx.chartSummary = null;
    return ctx;
  }

  ctx.chartSummary = await buildChartSummary(
    profile.fullName ?? "",
    profile.dateOfBirth,
    profile.timeOfBirth || "12:00",
    profile.placeOfBirth,
    profile.latitude,
    profile.longitude,
  );

  return ctx;
}
