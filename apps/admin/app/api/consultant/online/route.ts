// apps/admin/app/api/consultant/online/route.ts
import {NextResponse} from "next/server";
import {createServerClientFromCookies, evaluateConsultantProfile} from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { is_online?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.is_online !== "boolean") {
    return NextResponse.json({ error: "is_online must be boolean" }, { status: 400 });
  }

  if (body.is_online === true) {
    const { data: c } = await supabase
      .from("Consultant")
      .select("bio, perMinuteRate, specialties, languages, availability, category, status")
      .eq("userId", user.id).maybeSingle();

    if (!c) return NextResponse.json({ error: "NO_CONSULTANT_PROFILE" }, { status: 403 });
    if (c.status === "SUSPENDED") return NextResponse.json({ error: "SUSPENDED" }, { status: 403 });

    const report = evaluateConsultantProfile(c);
    if (!report.isLive) {
      return NextResponse.json({
        error: "PROFILE_INCOMPLETE",
        message: "Complete your profile to accept sessions",
        score: report.score,
        checks: report.checks,
      }, { status: 403 });
    }
  }

  const { error } = await supabase.from("User").update({ is_online: body.is_online }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { serverPublish } = await import("@/lib/realtime/server");
    await serverPublish(`consultant:${user.id}:status`, "status_updated", {
      consultantId: user.id, is_online: body.is_online,
    });
  } catch { /* best-effort */ }

  return NextResponse.json({ success: true, is_online: body.is_online });
}
