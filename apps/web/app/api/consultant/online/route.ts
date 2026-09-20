// ZEAL_FIX_PHASE1_ONLINE
// Allow consultants to toggle online even with incomplete profiles.
// The directory query filters by completeness, so this is safe.
import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  evaluateConsultantProfile,
} from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { is_online?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.is_online !== "boolean") {
    return NextResponse.json(
      { error: "is_online must be boolean" },
      { status: 400 },
    );
  }

  // ZEAL_FIX_ALLOW_INCOMPLETE — never block going online; return a warning
  // payload so the UI can still show the checklist.
  let completenessWarning: Record<string, unknown> = {};

  if (body.is_online === true) {
    const { data: c } = await supabase
      .from("Consultant")
      .select(
        'bio, "perMinuteRate", specialties, languages, availability, category, status',
      )
      .eq("userId", user.id)
      .maybeSingle();

    if (!c) {
      return NextResponse.json(
        {
          error: "NO_CONSULTANT_PROFILE",
          message: "Sign up as a consultant first.",
        },
        { status: 403 },
      );
    }
    if (c.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "SUSPENDED", message: "Account suspended." },
        { status: 403 },
      );
    }

    const report = evaluateConsultantProfile(c);
    if (!report.isLive) {
      completenessWarning = {
        warning: "PROFILE_INCOMPLETE",
        message:
          "You're online, but you won't appear in the directory until your profile is complete.",
        score: report.score,
        checks: report.checks,
      };
    }
  }

  const { error } = await supabase
    .from("User")
    .update({ is_online: body.is_online })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort realtime fanout
  try {
    const { serverPublish } = await import("@/lib/realtime/server");
    await serverPublish(`consultant:${user.id}:status`, "status_updated", {
      consultantId: user.id,
      is_online: body.is_online,
    });
    await serverPublish("consultants:live", "status_changed", {
      consultantId: user.id,
      is_online: body.is_online,
      at: new Date().toISOString(),
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    success: true,
    is_online: body.is_online,
    ...completenessWarning,
  });
}
