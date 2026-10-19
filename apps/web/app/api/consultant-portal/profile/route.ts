// apps/admin/app/api/consultant/profile/route.ts
import {NextResponse} from "next/server";
import {createServerClientFromCookies, evaluateConsultantProfile} from "@zeal/database/server";
import {z} from "zod";

export const dynamic = "force-dynamic";

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const PatchSchema = z.object({
  category: z.string().min(1).max(64).optional(),
  specialties: z.array(z.string().min(1).max(64)).max(20).optional(),
  bio: z.string().max(1000).optional(),
  perMinuteRate: z.number().int().min(10).max(500).optional(),
  languages: z.array(z.string().min(1).max(64)).max(20).optional(),
  availability: z.record(z.enum(DAYS), z.array(
    z.object({ start: z.string().regex(TimeRe), end: z.string().regex(TimeRe) })
      .refine((b) => b.end > b.start, { message: "end must be after start" })
  ).max(10)).optional(),
}).strict();

export async function PATCH(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message || "Invalid input", path: first?.path }, { status: 422 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: consultant } = await supabase
    .from("Consultant").select("id").eq("userId", user.id).maybeSingle();
  if (!consultant) return NextResponse.json({ error: "NOT_CONSULTANT" }, { status: 404 });

  const { error } = await supabase
    .from("Consultant").update(parsed.data).eq("id", consultant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: updated } = await supabase
    .from("Consultant")
    .select("bio, perMinuteRate, specialties, languages, availability, category")
    .eq("id", consultant.id).maybeSingle();

  const report = evaluateConsultantProfile(updated);
  return NextResponse.json({
    success: true,
    isLive: report.isLive,
    score: report.score,
    checks: report.checks,
  });
}
