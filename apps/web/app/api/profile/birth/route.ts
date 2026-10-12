// apps/web/app/api/profile/birth/route.ts
// GET  → fetch the authenticated user's birth profile
// PUT  → upsert birth details (from intake form or onboarding)
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_birth_profile", {
    p_user_id: user.id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { success?: boolean; profile?: unknown } | null;
  return NextResponse.json(
    { success: true, profile: result?.profile ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const GenderValues = ["male", "female", "non-binary", "other", "prefer-not"] as const;

export async function PUT(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const dateOfBirth = typeof b.dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dateOfBirth)
    ? b.dateOfBirth
    : null;
  const timeOfBirth = typeof b.timeOfBirth === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(b.timeOfBirth)
    ? b.timeOfBirth
    : null;
  const placeOfBirth = typeof b.placeOfBirth === "string" ? b.placeOfBirth.trim() : "";
  const latitude = typeof b.latitude === "number" ? b.latitude : null;
  const longitude = typeof b.longitude === "number" ? b.longitude : null;
  const gender = typeof b.gender === "string" && (GenderValues as readonly string[]).includes(b.gender)
    ? b.gender
    : null;
  const primaryConcern = typeof b.primaryConcern === "string" ? b.primaryConcern.trim() : "";

  const { data, error } = await supabase.rpc("upsert_birth_profile", {
    p_user_id: user.id,
    p_full_name: fullName,
    p_date_of_birth: dateOfBirth,
    p_time_of_birth: timeOfBirth,
    p_place_of_birth: placeOfBirth,
    p_latitude: latitude,
    p_longitude: longitude,
    p_gender: gender,
    p_primary_concern: primaryConcern,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { success?: boolean; profile?: unknown } | null;
  return NextResponse.json({
    success: result?.success ?? true,
    profile: result?.profile ?? null,
  });
}
