// ZEAL_FIX_PHASE2_CATALOG
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";
import { redis } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_KEY = "zeal:catalog:v1";
const CACHE_TTL_S = 300;

export async function GET() {
  const cached = await redis.get<string>(CACHE_KEY).catch(() => null);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "HIT",
      },
    });
  }
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

  const payload = JSON.stringify({
    categories: cats.data ?? [],
    services: svcs.data ?? [],
  });
  await redis.setex(CACHE_KEY, CACHE_TTL_S, payload).catch(() => null);
  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "X-Cache": "MISS",
    },
  });
}
