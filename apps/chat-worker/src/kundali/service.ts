// ============================================================================
// Kundali Service — compute the chart in-worker, on the shared ephemeris.
// ============================================================================
// Until now the chart summary was computed by the web app and handed to the
// worker as a blob of text. That meant two copies of the engine could silently
// diverge, and the worker could not chart a birth it received mid-conversation
// (the intake form's job, but also the birth-data detector's when a seeker
// types their DOB into chat).
//
// Now the worker owns the computation end-to-end: it resolves the birth place
// via the shared gazetteer, picks a timezone (stored tz > gazetteer tz >
// longitude heuristic), runs computeKundaliBrief, and persists the formatted
// summary back into seeker_profile. The per-isolve memo keeps repeat turns
// cheap — one chart per user per 10 minutes.
// ============================================================================

import {
  computeKundaliBrief,
  formatKundaliBrief,
  lookupGazetteerPlace,
  normalizeBirthTime,
  timezoneFromLng,
} from "@zeal/astrology";
import type { BirthData } from "@zeal/astrology";
import type { Env } from "../env";
import {
  chartSignatureOf,
  readSeekerProfile,
  saveSeekerProfile,
  type SeekerProfileRow,
} from "../seeker-profile";

interface ResolvedBirth {
  birthData: BirthData;
  place: string;
  name?: string;
}

const memo = new Map<string, { summary: string; at: number }>();
const MEMO_TTL_MS = 10 * 60 * 1000;
const MEMO_MAX = 200;

function memoKey(userId: string, signature: string): string {
  return `${userId}|${signature}`;
}

function memoGet(key: string): string | null {
  const hit = memo.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MEMO_TTL_MS) {
    memo.delete(key);
    return null;
  }
  return hit.summary;
}

function memoSet(key: string, summary: string): void {
  if (memo.size >= MEMO_MAX) {
    // Drop the oldest entry (Map iteration order is insertion order).
    const oldest = memo.keys().next().value;
    if (oldest) memo.delete(oldest);
  }
  memo.set(key, { summary, at: Date.now() });
}

/**
 * Resolve a birth place string to coordinates + timezone. Gazetteer first
 * (offline, exact IANA zone), then the longitude heuristic (civil approx).
 */
function resolvePlace(pob: string, lat: number | null, lng: number | null, tz: string | null): {
  lat: number;
  lng: number;
  timezone: string;
  place: string;
} | null {
  // Prefer stored coords if finite.
  if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const gaz = lookupGazetteerPlace(pob);
    const timezone = tz && isValidTimezone(tz) ? tz : gaz?.timezone ?? timezoneFromLng(lng);
    return { lat, lng, timezone, place: gaz?.canonicalName ?? pob };
  }
  // Fall back to gazetteer lookup.
  const gaz = lookupGazetteerPlace(pob);
  if (gaz) {
    return { lat: gaz.lat, lng: gaz.lng, timezone: tz && isValidTimezone(tz) ? tz : gaz.timezone, place: gaz.canonicalName };
  }
  return null;
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a BirthData from the stored profile row. Returns null if the row lacks
 * the minimum (dob + pob, or dob + lat/lng).
 */
function birthDataFrom(row: SeekerProfileRow): ResolvedBirth | null {
  if (!row.dob || !row.pob) return null;
  const resolved = resolvePlace(row.pob, row?.latitude ?? null, row?.longitude ?? null, row?.timezone ?? null);
  if (!resolved) return null;
  const tob = row.tob ?? "12:00";
  let normalizedTob: string;
  try {
    normalizedTob = normalizeBirthTime(tob);
  } catch {
    normalizedTob = "12:00";
  }
  const birthData: BirthData = {
    birthDate: row.dob,
    birthTime: normalizedTob,
    birthPlace: { lat: resolved.lat, lng: resolved.lng },
    timezone: resolved.timezone,
  };
  return { birthData, place: resolved.place, name: row.name ?? undefined };
}

/**
 * Ensure the seeker has a chart summary. If the stored chart matches the
 * current birth signature, return it; otherwise recompute, persist, and return
 * the fresh summary. Returns null if the profile lacks enough to chart.
 */
export async function ensureChart(
  env: Env,
  userId: string,
  row: SeekerProfileRow | null,
): Promise<{ summary: string; stale: boolean } | null> {
  const currentRow = row ?? (await readSeekerProfile(env, userId));
  if (!currentRow) return null;
  const resolved = birthDataFrom(currentRow);
  if (!resolved) return null;

  const signature = chartSignatureOf(currentRow);
  const key = memoKey(userId, signature);

  // Memo hit: cheap path.
  const cached = memoGet(key);
  if (
    cached &&
    currentRow.chart_summary === cached &&
    currentRow.chart_key === signature
  ) {
    return { summary: cached, stale: false };
  }

  // Compute.
  let summary: string;
  try {
    const brief = computeKundaliBrief(resolved.birthData, {
      name: resolved.name,
      place: resolved.place,
    });
    summary = formatKundaliBrief(brief);
  } catch (err) {
    console.warn("[kundali] compute failed:", err instanceof Error ? err.message : err);
    return null;
  }

  // Persist.
  const updated = await saveSeekerProfile(env, userId, { chartSummary: summary });
  if (updated) {
    memoSet(key, summary);
    return { summary, stale: false };
  }
  // Persist failed (shouldn't happen, but don't lose the chart).
  memoSet(key, summary);
  return { summary, stale: true };
}

/**
 * Recompute the chart from fresh birth data (e.g. after the intake form or a
 * mid-conversation disclosure). Always recomputes, never reads memo.
 */
export async function recomputeChart(
  env: Env,
  userId: string,
  patch: {
    name?: string;
    dob?: string;
    tob?: string;
    pob?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  },
): Promise<string | null> {
  // Merge patch into a synthetic row for birthDataFrom.
  const current = await readSeekerProfile(env, userId);
  const synthetic: SeekerProfileRow = {
    user_id: userId,
    name: patch.name ?? current?.name ?? null,
    dob: patch.dob ?? current?.dob ?? null,
    tob: patch.tob ?? current?.tob ?? null,
    pob: patch.pob ?? current?.pob ?? null,
    latitude: patch?.latitude ?? current?.latitude ?? null,
    longitude: patch?.longitude ?? current?.longitude ?? null,
    timezone: patch?.timezone ?? current?.timezone ?? null,
    gender: current?.gender ?? null,
    concern: current?.concern ?? null,
    chart_summary: null,
    chart_key: null,
    updated_at: new Date().toISOString(),
  };
  const resolved = birthDataFrom(synthetic);
  if (!resolved) return null;

  let summary: string;
  try {
    const brief = computeKundaliBrief(resolved.birthData, {
      name: resolved.name,
      place: resolved.place,
    });
    summary = formatKundaliBrief(brief);
  } catch (err) {
    console.warn("[kundali] recompute failed:", err instanceof Error ? err.message : err);
    return null;
  }

  // Persist the patch + chart together.
  await saveSeekerProfile(env, userId, {
    name: patch.name,
    dob: patch.dob,
    tob: patch.tob,
    pob: patch.pob,
    latitude: patch?.latitude,
    longitude: patch?.longitude,
    timezone: patch?.timezone,
    chartSummary: summary,
  });

  // Memoize.
  const signature = chartSignatureOf(synthetic);
  memoSet(memoKey(userId, signature), summary);

  return summary;
}
