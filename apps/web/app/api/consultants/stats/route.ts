// ZEAL_FIX_FE_STATS
// Aggregate platform stats for the seeker homepage / explore hero.
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = createAdminClient();

    const [consultants, online, services, categories] = await Promise.all([
      admin.from("Consultant").select("*", { count: "exact", head: true })
        .eq("status", "VERIFIED").eq("isActive", true),
      admin.from("User").select("*", { count: "exact", head: true })
        .eq("is_online", true),
      admin.from("Service").select("*", { count: "exact", head: true })
        .eq("is_active", true),
      admin.from("Category").select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    return NextResponse.json(
      {
        consultants: consultants.count ?? 0,
        online: online.count ?? 0,
        services: services.count ?? 0,
        categories: categories.count ?? 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
