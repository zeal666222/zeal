// apps/web/app/api/chat/intake/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// The AI chat's birth-detail intake, stored on the chat worker.
//
//   GET  → what the consultant currently knows, and what it still needs
//   PUT  → the completed form: store it, compute the chart, hand back the state
//
// The answers are keyed by the authenticated user's id and live in the worker's
// D1, which is what makes a consultant able to remember them next time — on
// another device, with another consultant — without ever being handed another
// seeker's details through the request body.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { resolveWorkerAuth } from "@/lib/auth/access-token";
import { refreshSeekerState, saveSeekerIntake } from "@/lib/chat/seeker-sync";
import type { WorkerIntakeState } from "@/lib/chat/worker";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Shape BirthIntakeModal prefills from. */
function prefill(profile: WorkerIntakeState["profile"]) {
  if (!profile) return null;
  return {
    fullName: profile.name ?? "",
    dateOfBirth: profile.dob ?? "",
    timeOfBirth: profile.tob ?? null,
    placeOfBirth: profile.pob ?? "",
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    primaryConcern: profile.concern ?? "",
  };
}

async function auth() {
  const resolved = await resolveWorkerAuth();
  if (!resolved.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (!resolved.accessToken) {
    return {
      error: NextResponse.json(
        { error: "Session is warming up — please try again in a moment." },
        { status: 503 },
      ),
    } as const;
  }
  return { userId: resolved.userId, accessToken: resolved.accessToken } as const;
}

export async function GET() {
  const ctx = await auth();
  if ("error" in ctx) return ctx.error;

  const intake = await refreshSeekerState(ctx.userId, ctx.accessToken, { seed: true });
  return NextResponse.json(
    { success: true, intake, existingProfile: prefill(intake.profile) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const ctx = await auth();
  if ("error" in ctx) return ctx.error;

  let body: Record<string, unknown>;
  try {
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("bad body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (key: string, max: number): string => {
    const v = body[key];
    return typeof v === "string" ? v.trim().slice(0, max) : "";
  };
  const coord = (key: string, limit: number): number | undefined => {
    const v = body[key];
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > limit) return undefined;
    return v;
  };

  const fullName = str("fullName", 80);
  const dateOfBirth = str("dateOfBirth", 10);
  const rawTime = str("timeOfBirth", 5);
  const placeOfBirth = str("placeOfBirth", 120);
  const timezone = str("timezone", 60);

  if (!fullName) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!DATE_RE.test(dateOfBirth)) {
    return NextResponse.json({ error: "Birth date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!placeOfBirth) {
    return NextResponse.json({ error: "Birth place is required" }, { status: 400 });
  }
  // "I don't know my birth time" is a legitimate answer; a malformed one isn't.
  const timeOfBirth = rawTime && !TIME_RE.test(rawTime) ? "" : rawTime;
  if (rawTime && !timeOfBirth) {
    return NextResponse.json({ error: "Birth time must be HH:MM" }, { status: 400 });
  }

  const input = {
    name: fullName,
    dob: dateOfBirth,
    tob: timeOfBirth || undefined,
    pob: placeOfBirth,
    latitude: coord("latitude", 90),
    longitude: coord("longitude", 180),
    timezone: timezone || undefined,
    concern: str("primaryConcern", 500) || undefined,
  };

  let intake: WorkerIntakeState;
  try {
    intake = await saveSeekerIntake(ctx.userId, ctx.accessToken, input);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[chat-intake] worker save failed:", reason);
    return NextResponse.json(
      { error: "Could not save your birth details just now — please try again." },
      { status: reason.includes("Unauthorized") ? 401 : 502 },
    );
  }

  // Mirror into the app's birth profile so the kundali page, onboarding and a
  // later human consultation see the same answers. Best-effort: the AI chat is
  // already correctly grounded by the time this runs.
  try {
    const { createServerClientFromCookies } = await import("@zeal/database/server");
    const supabase = await createServerClientFromCookies();
    await supabase.rpc("upsert_birth_profile", {
      p_user_id: ctx.userId,
      p_full_name: fullName,
      p_date_of_birth: dateOfBirth,
      p_time_of_birth: timeOfBirth || null,
      p_place_of_birth: placeOfBirth,
      p_latitude: input.latitude ?? null,
      p_longitude: input.longitude ?? null,
      p_timezone: input.timezone ?? null,
      p_gender: null,
      p_primary_concern: input.concern ?? "",
    });
  } catch (err) {
    console.warn("[chat-intake] app profile mirror failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json(
    { success: true, intake, existingProfile: prefill(intake.profile) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
