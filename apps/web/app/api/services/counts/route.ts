import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data, error } = await supabase.rpc("category_counts");

  if (error) {
    return NextResponse.json(
      { error: error.message, categories: [] },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Array<{
    categoryId: string;
    count: number;
    onlineCount: number;
  }>;
  const map = new Map(rows.map((r) => [r.categoryId, r]));

  const categories = Object.entries(CATEGORY_ID_TO_NAME).map(([id, name]) => ({
    id,
    name,
    count:       map.get(id)?.count       ?? 0,
    onlineCount: map.get(id)?.onlineCount ?? 0,
  }));

  return NextResponse.json(
    { categories },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
