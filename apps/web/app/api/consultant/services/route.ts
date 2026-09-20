// ZEAL_FIX_PHASE2_SERVICES
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PutSchema = z.object({
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        proficiency: z.number().int().min(1).max(5).default(3),
      }),
    )
    .max(20),
});

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: consultant } = await supabase
    .from("Consultant")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (!consultant) return NextResponse.json({ services: [] });

  const { data } = await supabase
    .from("ConsultantService")
    .select("service_id, proficiency, Service(name, slug, parent_category)")
    .eq("consultant_id", consultant.id);

  return NextResponse.json({ services: data ?? [] });
}

export async function PUT(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid" },
      { status: 422 },
    );
  }

  const { data: consultant } = await supabase
    .from("Consultant")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (!consultant) return NextResponse.json({ error: "Not a consultant" }, { status: 403 });

  await supabase.from("ConsultantService").delete().eq("consultant_id", consultant.id);

  if (parsed.data.services.length > 0) {
    const rows = parsed.data.services.map((s) => ({
      consultant_id: consultant.id,
      service_id: s.serviceId,
      proficiency: s.proficiency,
    }));
    const { error } = await supabase.from("ConsultantService").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try { await supabase.rpc("refresh_consultant_directory"); } catch { /* best-effort */ }

  return NextResponse.json({ success: true, count: parsed.data.services.length });
}
