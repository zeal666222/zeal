// ZEAL_FIX_PROFILE_V3
// Consultant profile PATCH — bearer + cookie aware.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_KEYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");

const TimeBlockSchema = z
  .object({ start: TimeSchema, end: TimeSchema })
  .refine((b) => b.end > b.start, { message: "End must be after start" });

const AvailabilitySchema = z
  .record(z.enum(DAY_KEYS), z.array(TimeBlockSchema).max(10));

const PatchSchema = z.object({
  category: z.string().min(1).max(64).optional(),
  specialties: z.array(z.string().min(1).max(64)).max(20).optional(),
  bio: z.string().max(1000).optional(),
  perMinuteRate: z.number().int().min(10).max(500).optional(),
  languages: z.array(z.string().min(1).max(64)).max(20).optional(),
  availability: AvailabilitySchema.optional(),
}).strict();

export async function PATCH(req: Request) {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message || "Invalid input", path: first?.path ?? [] },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: consultant } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ error: "No consultant profile" }, { status: 404 });
  }

  const { error: updateErr } = await admin
    .from("Consultant")
    .update(parsed.data)
    .eq("id", (consultant as { id: string }).id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: updated } = await admin
    .from("Consultant")
    .select('bio, "perMinuteRate", specialties, languages, availability, category')
    .eq("id", (consultant as { id: string }).id)
    .maybeSingle();

  const report = evaluateConsultantProfile(updated);

  return NextResponse.json({
    success: true,
    isLive: report.isLive,
    score: report.score,
    checks: report.checks,
  });
}
