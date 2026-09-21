// ZEAL_FIX_FE_SVC_CATALOG
// Services grouped by category — ideal for pickers and chips.
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SvcRow { id: string; name: string; slug: string; parent_category: string; }
interface CatRow { id: string; display_name: string; sort_order: number; }

export async function GET() {
  try {
    const admin = createAdminClient();

    const [catsRes, svcsRes] = await Promise.all([
      admin.from("Category")
        .select("id, display_name, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      admin.from("Service")
        .select("id, name, slug, parent_category")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    const cats = (catsRes.data ?? []) as CatRow[];
    const svcs = (svcsRes.data ?? []) as SvcRow[];

    const groups = cats.map((c) => ({
      categoryId: c.id,
      categoryName: c.display_name,
      sortOrder: c.sort_order,
      services: svcs.filter((s) => s.parent_category === c.id),
    }));

    return NextResponse.json(
      { groups },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    return NextResponse.json({ groups: [], error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
