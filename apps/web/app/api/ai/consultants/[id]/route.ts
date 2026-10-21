import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const admin = createAdminClient();

    // An AI row can be addressed by uuid, exact username, or a slug derived
    // from the username. Each step only runs when the previous one found
    // nothing, and every step is a real column comparison — `id` is a uuid, so
    // ILIKE on it used to raise and the whole lookup collapsed into a 404.
    const attempts = [
      () => admin.from("AIConsultant").select("*").eq("id", id).maybeSingle(),
      () => admin.from("AIConsultant").select("*").eq("username", id).maybeSingle(),
      () => admin.from("AIConsultant").select("*").ilike("username", id).maybeSingle(),
      () => admin
        .from("AIConsultant")
        .select("*")
        .ilike("username", `%${id.replace(/-/g, "_").toLowerCase()}%`)
        .limit(1)
        .maybeSingle(),
    ];

    let data = null as Record<string, unknown> | null;
    for (const attempt of attempts) {
      const res = await attempt();
      if (res.error) {
        console.warn("[AI Detail API] lookup failed:", res.error.message);
        continue;
      }
      if (res.data) {
        data = res.data as Record<string, unknown>;
        break;
      }
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The city lives on the shadow "User" row sharing this id, not on
    // AIConsultant — the profile page renders it, so it has to be joined here.
    const { data: userRow } = await admin
      .from("User")
      .select("location")
      .eq("id", data.id as string)
      .maybeSingle();

    return NextResponse.json(
      { ...data, location: userRow?.location ?? null },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    console.warn("[AI Detail API] failed:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
