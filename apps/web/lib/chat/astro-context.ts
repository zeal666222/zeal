// apps/web/lib/chat/astro-context.ts
// Server-side: turn the seeker's birth details into a deterministic,
// kundali-grounded chart block. The chart is COMPUTED here (the worker has no
// ephemeris) and stored in the worker's D1 against the seeker's user id.
//
// Design notes:
//   • The chart is deterministic for a given (dob, tob, pob) triple, so we
//     memoise the formatted block per-isolate for a few hours. This keeps a
//     long chat from recomputing the ephemeris on every turn.
//   • The memo key includes the user id. Keying it on birth data alone meant
//     two seekers sharing a birthday, birth minute and birth place collided,
//     and one of them got the other's cached kundali in their prompt.
//   • Time-of-birth is optional in intake; when absent we compute at local
//     noon and let the engine's own confidence score flag the reduced
//     precision — better a grounded reading than none.

import { resolvePlace, timezoneFromLng, type ResolvedPlace } from "@/lib/kundali/geocoder";
import { computeKundali, formatKundaliForPrompt } from "@/lib/kundali/engine";

export interface ChartInput {
  /** Scopes the memo — always the authenticated user's id. */
  userId: string;
  name?: string | null;
  dob: string;
  /** 24h HH:MM. Defaults to local noon when the seeker doesn't know it. */
  tob?: string | null;
  pob: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface CacheEntry {
  summary: string | null;
  at: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
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

/**
 * The formatted chart block, or null when it could not be computed.
 * A failed computation is cached too — otherwise every turn re-attempts a
 * geo lookup that is going to fail again, on the seeker's critical path.
 */
export async function computeChartSummary(input: ChartInput): Promise<string | null> {
  const tob = input.tob || "12:00";
  const key = `${input.userId}|${input.dob}|${tob}|${input.pob}|${input.latitude ?? ""}|${input.longitude ?? ""}`;
  const hit = chartCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.summary;

  let summary: string | null = null;
  try {
    const resolved = await resolvedFromProfile(input.pob, input.latitude ?? null, input.longitude ?? null);
    if (resolved) {
      summary = formatKundaliForPrompt(
        computeKundali(input.name || "Seeker", input.dob, tob, input.pob, resolved),
      );
    }
  } catch (err) {
    console.warn("[astro-context] chart compute failed:", err instanceof Error ? err.message : err);
    summary = null;
  }

  if (chartCache.size > CACHE_MAX) {
    for (const [k, v] of chartCache) if (Date.now() - v.at > CACHE_TTL_MS) chartCache.delete(k);
  }
  chartCache.set(key, { summary, at: Date.now() });
  return summary;
}
