// Seeker profile — the intake form's answers, stored in D1 against the
// authenticated user id.
//
// This table is why a consultant can no longer read one seeker's birth details
// to another: turns used to carry an `astro` object in the request body, and
// whatever the client sent was injected into the system prompt verbatim. Now
// the only identity a turn can speak for is `jwt.sub`, and the profile is read
// from the database under that id.
import type { Env } from "./env";

export interface SeekerProfileRow {
  user_id: string;
  name: string | null;
  dob: string | null;
  tob: string | null;
  pob: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  gender: string | null;
  concern: string | null;
  chart_summary: string | null;
  chart_key: string | null;
  updated_at: string;
}

export interface SeekerPatch {
  name?: string | null;
  dob?: string | null;
  tob?: string | null;
  pob?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  gender?: string | null;
  concern?: string | null;
  /** Computed by the worker from the shared @zeal/astrology ephemeris. */
  chartSummary?: string | null;
}

/**
 * Signature of the birth data a chart was computed from. The key is always
 * stamped by the worker over the row it just stored, so the web never has to
 * reproduce this string — it only sends the summary.
 */
export function chartSignatureOf(p: {
  dob?: string | null; tob?: string | null; pob?: string | null;
  latitude?: number | null; longitude?: number | null; timezone?: string | null;
}): string {
  return [
    p.dob ?? "", p.tob ?? "", p.pob ?? "",
    p.latitude ?? "", p.longitude ?? "", p.timezone ?? "",
  ].join("|");
}

export async function readSeekerProfile(env: Env, userId: string): Promise<SeekerProfileRow | null> {
  return await env.DB.prepare(
    `SELECT user_id, name, dob, tob, pob, latitude, longitude, timezone, gender, concern,
            chart_summary, chart_key, updated_at
     FROM seeker_profile WHERE user_id = ?`
  ).bind(userId).first<SeekerProfileRow>();
}

/**
 * Merge-only upsert: an omitted field keeps its stored value, so the intake
 * form can send a partial correction without erasing the rest of the profile.
 *
 * When a birth input moves and no fresh chart arrives with it, the stored
 * ephemeris is dropped rather than quietly kept — a chart of the wrong birth
 * time is worse than no chart, and staleness here would be invisible.
 */
export async function saveSeekerProfile(
  env: Env,
  userId: string,
  patch: SeekerPatch,
): Promise<SeekerProfileRow | null> {
  await env.DB.prepare(
    `INSERT INTO seeker_profile (user_id, name, dob, tob, pob, latitude, longitude, timezone, gender, concern)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT(user_id) DO UPDATE SET
       name      = COALESCE(excluded.name, name),
       dob       = COALESCE(excluded.dob, dob),
       tob       = COALESCE(excluded.tob, tob),
       pob       = COALESCE(excluded.pob, pob),
       latitude  = COALESCE(excluded.latitude, latitude),
       longitude = COALESCE(excluded.longitude, longitude),
       timezone  = COALESCE(excluded.timezone, timezone),
       gender    = COALESCE(excluded.gender, gender),
       concern   = COALESCE(excluded.concern, concern),
       updated_at = datetime('now')`,
  ).bind(
    userId,
    patch.name ?? null,
    patch.dob ?? null,
    patch.tob ?? null,
    patch.pob ?? null,
    patch.latitude ?? null,
    patch.longitude ?? null,
    patch.timezone ?? null,
    patch.gender ?? null,
    patch.concern ?? null,
  ).run();

  const merged = await readSeekerProfile(env, userId);
  if (!merged) return null;

  const key = chartSignatureOf(merged);
  if (patch.chartSummary) {
    await env.DB.prepare(
      `UPDATE seeker_profile SET chart_summary = ?, chart_key = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).bind(patch.chartSummary, key, userId).run();
  } else if (merged.chart_summary && merged.chart_key !== key) {
    await env.DB.prepare(
      `UPDATE seeker_profile SET chart_summary = NULL, chart_key = NULL, updated_at = datetime('now')
       WHERE user_id = ?`
    ).bind(userId).run();
  }

  return readSeekerProfile(env, userId);
}

export interface ProfileState {
  profile: SeekerProfileRow | null;
  /** True when birth data exists but no chart is stored, or the chart predates the current birth data. */
  chartStale: boolean;
  /** Enough intake for a grounded reading: date and place of birth. */
  hasBirthData: boolean;
  /** Fields the intake form still needs, in display order. */
  missing: Array<"name" | "dob" | "pob">;
}

export function describeProfile(profile: SeekerProfileRow | null): ProfileState {
  const hasBirthData = Boolean(profile?.dob && profile?.pob);
  return {
    profile,
    chartStale: hasBirthData && (!profile?.chart_summary || profile.chart_key !== chartSignatureOf(profile)),
    hasBirthData,
    missing: [
      ...(profile?.name ? [] : ["name" as const]),
      ...(profile?.dob ? [] : ["dob" as const]),
      ...(profile?.pob ? [] : ["pob" as const]),
    ],
  };
}
