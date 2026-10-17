// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Place autocomplete (GET /api/geo/suggest)
// ─────────────────────────────────────────────────────────────────────────────
// Free, keyless place suggestions for birth-place inputs:
//   1. Offline gazetteer prefix matches first (instant, zero network).
//   2. OpenStreetMap Nominatim tops it up when thin — 24h-cached and
//      client-side paced to ≤1 req/s per its fair-use policy; when the pace
//      window is busy we return the gazetteer set instead of queueing.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { suggestPlaces } from "@/lib/kundali/geocoder";
import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await checkRateLimit(generalLimiter, `geo:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Please pause a moment and try again.", code: "RATE_LIMIT" },
      { status: 429, headers: rl.headers },
    );
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) {
    return NextResponse.json({ suggestions: [] }, { headers: rl.headers });
  }

  const suggestions = await suggestPlaces(q, { limit: 6 });

  const headers = new Headers(rl.headers);
  headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return NextResponse.json({ suggestions }, { headers });
}
