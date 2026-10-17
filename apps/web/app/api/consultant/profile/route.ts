import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");
const TimeBlockSchema = z.object({ start: TimeSchema, end: TimeSchema }).refine((b) => b.end > b.start, { message: "End must be after start" });
const AvailabilitySchema = z.record(z.enum(DAY_KEYS), z.array(TimeBlockSchema).max(10));

const PatchSchema = z.object({
  category: z.string().min(1).max(64).optional(),
  specialties: z.array(z.string().min(1).max(64)).max(20).optional(),
  bio: z.string().max(1000).optional(),
  perMinuteRate: z.number().int().min(10).max(500).optional(),
  languages: z.array(z.string().min(1).max(64)).max(20).optional(),
  availability: AvailabilitySchema.optional(),
}).strict();

export const PATCH = withErrorHandler(async (req: Request) => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid input", 422, ErrorCode.VALIDATION_INPUT);
  }

  if (Object.keys(parsed.data).length === 0) {
    throw new AppError("No fields to update", 400, ErrorCode.VALIDATION_INPUT);
  }

  const consultant = await safeQueryOne<{ id: string }>(
    admin.from("Consultant").select("id").eq("userId", userId).maybeSingle(),
    "profile.consultant",
  );
  if (!consultant) {
    throw new AppError("No consultant profile", 404, ErrorCode.NOT_FOUND);
  }

  await safeQuery(
    admin.from("Consultant").update(parsed.data).eq("id", consultant.id),
    "profile.update",
  );

  const updated = await safeQueryOne<{
    bio: string | null; perMinuteRate: number; specialties: string[] | null;
    languages: string[] | null; availability: unknown; category: string;
  }>(
    admin.from("Consultant")
      .select('bio, "perMinuteRate", specialties, languages, availability, category')
      .eq("id", consultant.id)
      .maybeSingle(),
    "profile.readback",
  );

  const report = evaluateConsultantProfile(updated);

  return NextResponse.json({
    success: true, isLive: report.isLive, score: report.score, checks: report.checks,
  });
});
