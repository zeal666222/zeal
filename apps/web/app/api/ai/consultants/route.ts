import { NextResponse } from "next/server";
import {createAdminClient} from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    const admin = createAdminClient();
    let query = admin
      .from("AIConsultant")
      .select("*")
      .eq("isActive", true)
      .order("isFeatured", { ascending: false })
      .order("rating", { ascending: false })
      .order("name", { ascending: true });

    if (category) query = query.eq("category", category);

    const { data, error } = await query;

    if (error) {
      console.error("[AI Consultants API] Supabase error:", error);
      return NextResponse.json([], {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    // AIConsultant has no location column; the city lives on the shadow "User"
    // row whose id is the same uuid. Without this join every card rendered
    // without a place, which is the detail that makes an AI profile read human.
    const rows = data ?? [];
    const ids = rows.map((r: { id: string }) => r.id);
    let places: { id: string; location: string | null }[] = [];
    if (ids.length > 0) {
      const { data: userRows } = await admin
        .from("User")
        .select("id, location")
        .in("id", ids);
      places = userRows ?? [];
    }
    const byId = new Map(places.map((u) => [u.id, u.location]));

    return NextResponse.json(
      rows.map((r: { id: string }) => ({ ...r, location: byId.get(r.id) ?? null })),
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    console.error("[AI Consultants API] failed:", err);
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
