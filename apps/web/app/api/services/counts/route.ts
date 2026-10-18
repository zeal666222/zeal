import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { CATEGORY_ID_TO_NAME } from "@/lib/services/slug";
import { redis } from "@/lib/cache";

export const dynamic = "force-dynamic";

const CACHE_KEY = "zeal:services:counts:v1";
const CACHE_TTL_S = 60;

export async function GET() {
  const cached = await redis.get<string>(CACHE_KEY).catch(() => null);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "X-Cache": "HIT",
      },
    });
  }
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

  const payload = JSON.stringify({ categories });
  await redis.setex(CACHE_KEY, CACHE_TTL_S, payload).catch(() => null);
  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      "X-Cache": "MISS",
    },
  });
}
