// ZEAL_FIX_PHASE2_CATALOG
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const admin = createAdminClient();

  const [cats, svcs] = await Promise.all([
    admin
      .from("Category")
      .select("id, name, display_name, icon, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("Service")
      .select("id, name, slug, parent_category")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  return NextResponse.json(
    {
      categories: cats.data ?? [],
      services: svcs.data ?? [],
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
