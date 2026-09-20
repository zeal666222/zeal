// apps/admin/app/api/consultant/availability/route.ts
import {NextResponse} from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";
import {z} from "zod";

export const dynamic = "force-dynamic";

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const BlockSchema = z.object({ start: TimeSchema, end: TimeSchema })
  .refine((b) => b.end > b.start, { message: "end must be after start" });
const AvailabilitySchema = z.object({
  availability: z.record(z.enum(DAYS), z.array(BlockSchema).max(10)).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
}).strict();

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: c } = await supabase
    .from("Consultant").select("availability, bufferMinutes").eq("userId", user.id).maybeSingle();
  if (!c) return NextResponse.json({ error: "NOT_CONSULTANT" }, { status: 403 });

  return NextResponse.json({
    availability: c.availability ?? {},
    bufferMinutes: c.bufferMinutes ?? 10,
  });
}

export async function PUT(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = AvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues[0]?.message || "Invalid",
      path: parsed.error.issues[0]?.path,
    }, { status: 400 });
  }

  const { data: consultant } = await supabase
    .from("Consultant").select("id").eq("userId", user.id).maybeSingle();
  if (!consultant) return NextResponse.json({ error: "NOT_CONSULTANT" }, { status: 403 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.availability !== undefined) patch.availability = parsed.data.availability;
  if (parsed.data.bufferMinutes !== undefined) patch.bufferMinutes = parsed.data.bufferMinutes;

  const { data: updated, error } = await supabase
    .from("Consultant").update(patch).eq("id", consultant.id)
    .select("availability, bufferMinutes").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
