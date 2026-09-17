import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerClientFromCookies,
  evaluateConsultantProfile,
} from "@zeal/database/server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const RATE_MIN = 10;
const RATE_MAX = 500;
const BIO_MAX = 1000;
const SPECIALTY_MAX = 20;
const LANG_MAX = 20;
const BLOCKS_PER_DAY_MAX = 10;

// ═══════════════════════════════════════════════════════════════════════
// SCHEMA — Zod v4 (two-arg z.record, exhaustive day keys)
// ═══════════════════════════════════════════════════════════════════════
const DayKeySchema = z.enum(DAY_KEYS);

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");

const TimeBlockSchema = z
  .object({
    start: TimeSchema,
    end: TimeSchema,
  })
  .refine((b) => b.end > b.start, {
    message: "End time must be after start time",
    path: ["end"],
  });

const AvailabilitySchema = z
  .record(DayKeySchema, z.array(TimeBlockSchema).max(BLOCKS_PER_DAY_MAX))
  .superRefine((days, ctx) => {
    for (const [day, blocks] of Object.entries(days)) {
      if (!blocks || blocks.length < 2) continue;
      const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (!prev || !cur) continue;
        if (cur.start < prev.end) {
          ctx.addIssue({
            code: "custom",
            message: `${day}: block ${i + 1} overlaps with block ${i}`,
            path: [day, i],
          });
        }
      }
    }
  });

const PatchSchema = z
  .object({
    category: z.string().min(1).max(64).optional(),
    specialties: z
      .array(z.string().min(1).max(64))
      .max(SPECIALTY_MAX)
      .optional(),
    bio: z.string().max(BIO_MAX).optional(),
    perMinuteRate: z.number().int().min(RATE_MIN).max(RATE_MAX).optional(),
    languages: z.array(z.string().min(1).max(64)).max(LANG_MAX).optional(),
    availability: AvailabilitySchema.optional(),
  })
  .strict();

// ═══════════════════════════════════════════════════════════════════════
// HANDLER — PATCH /api/consultant/profile
// ═══════════════════════════════════════════════════════════════════════
export async function PATCH(req: Request) {
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: first?.message || "Invalid input",
        path: first?.path ?? [],
        issues: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: consultant, error: lookupErr } = await supabase
    .from("Consultant")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!consultant) {
    return NextResponse.json(
      { error: "No consultant profile" },
      { status: 404 },
    );
  }

  const { error: updateErr } = await supabase
    .from("Consultant")
    .update(patch)
    .eq("id", consultant.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("Consultant")
    .select(
      'bio, "perMinuteRate", specialties, languages, availability, category',
    )
    .eq("id", consultant.id)
    .maybeSingle();

  const report = evaluateConsultantProfile(updated);

  return NextResponse.json({
    success: true,
    isLive: report.isLive,
    score: report.score,
    checks: report.checks,
  });
}
