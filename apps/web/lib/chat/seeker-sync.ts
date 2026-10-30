// apps/web/lib/chat/seeker-sync.ts
// Keep the chat worker's copy of the seeker's intake correct, and make sure it
// holds a fresh chart.
//
// The worker is the source of truth for what an AI consultant knows about a
// seeker: it reads the profile from D1 under the bearer token's `sub`, so a
// turn can only ever speak for the person who sent it. These helpers are how
// that row gets populated — from the app's saved birth profile on page load,
// and from mid-conversation disclosures the worker parses itself.

import { computeChartSummary } from "@/lib/chat/astro-context";
import { fetchBirthProfile } from "@/lib/birth-profile";
import * as worker from "@/lib/chat/worker";

const EMPTY_INTAKE: worker.WorkerIntakeState = {
  profile: null,
  chartStale: false,
  hasBirthData: false,
  missing: ["name", "dob", "pob"],
};

function toPatch(p: NonNullable<worker.WorkerIntakeState["profile"]>): worker.WorkerProfilePatch {
  return {
    name: p.name ?? undefined,
    dob: p.dob ?? undefined,
    tob: p.tob ?? undefined,
    pob: p.pob ?? undefined,
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    timezone: p.timezone ?? undefined,
    gender: p.gender ?? undefined,
    concern: p.concern ?? undefined,
  };
}

/**
 * Seed the worker from the app's birth profile when the seeker has one and the
 * worker knows nothing yet. Runs on the chat page's intake read, not per turn.
 */
async function seedFromAppProfile(userId: string, accessToken: string): Promise<worker.WorkerIntakeState | null> {
  const bp = await fetchBirthProfile(userId);
  if (!bp?.dateOfBirth || !bp.placeOfBirth) return null;

  return worker
    .putIntake(accessToken, {
      name: bp.fullName || undefined,
      dob: bp.dateOfBirth,
      tob: bp.timeOfBirth || undefined,
      pob: bp.placeOfBirth,
      latitude: bp.latitude ?? undefined,
      longitude: bp.longitude ?? undefined,
      timezone: bp.timezone ?? undefined,
      gender: bp.gender ?? undefined,
      concern: bp.primaryConcern || undefined,
    })
    .catch((err) => {
      console.warn("[seeker-sync] seed failed:", err instanceof Error ? err.message : err);
      return null;
    });
}

/**
 * Read the intake state and guarantee the stored chart matches the stored
 * birth data. Cheap on the steady path: one D1 read, and the compute only runs
 * when the worker reports the chart as stale (first turn, or after an edit).
 */
export async function refreshSeekerState(
  userId: string,
  accessToken: string,
  options: { seed?: boolean } = {},
): Promise<worker.WorkerIntakeState> {
  let state: worker.WorkerIntakeState;
  try {
    state = await worker.getIntake(accessToken);
  } catch (err) {
    console.warn("[seeker-sync] intake read failed:", err instanceof Error ? err.message : err);
    return EMPTY_INTAKE;
  }

  if (options.seed && !state.hasBirthData) {
    const seeded = await seedFromAppProfile(userId, accessToken);
    if (seeded) state = seeded;
  }

  if (state.chartStale && state.profile?.dob && state.profile?.pob) {
    const patch = toPatch(state.profile);
    const summary = await computeChartSummary({
      userId,
      name: patch.name,
      dob: state.profile.dob,
      tob: state.profile.tob,
      pob: state.profile.pob,
      latitude: state.profile.latitude,
      longitude: state.profile.longitude,
    });
    if (summary) {
      try {
        state = await worker.putIntake(accessToken, { ...patch, chartSummary: summary });
      } catch (err) {
        console.warn("[seeker-sync] chart store failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  return state;
}

/**
 * A completed intake form: store the answers in the worker and hand back the
 * resulting state with a chart already in place, so the consultant's opening
 * line can be grounded in it.
 */
export async function saveSeekerIntake(
  userId: string,
  accessToken: string,
  input: { name?: string; dob: string; tob?: string; pob: string; latitude?: number; longitude?: number; timezone?: string; gender?: string; concern?: string },
): Promise<worker.WorkerIntakeState> {
  const summary = await computeChartSummary({
    userId,
    name: input.name,
    dob: input.dob,
    tob: input.tob,
    pob: input.pob,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  return worker.putIntake(accessToken, {
    name: input.name || undefined,
    dob: input.dob,
    tob: input.tob || undefined,
    pob: input.pob,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: input.timezone,
    gender: input.gender || undefined,
    concern: input.concern || undefined,
    chartSummary: summary || undefined,
  });
}
