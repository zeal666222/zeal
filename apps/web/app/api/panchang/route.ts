// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Daily Panchang API (GET /api/panchang)
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic almanac for any date + place:
//   1. Rate-limit (generalLimiter, key "panchang:<ip>") — same pattern as /geo/suggest.
//   2. Params: ?date=YYYY-MM-DD&place=<str>  OR  ?date=…&lat=…&lng=…&tz=…
//      Fallback chain: exact lat/lng/tz params → resolvePlace (gazetteer →
//      Nominatim) → friendly Hinglish error asking to pick a suggestion.
//   3. Pure engine (lib/panchang/engine) computes everything in UTC and renders
//      via timeZone-aware Intl. No AI, no randomness — same input, same JSON.
//   4. Edge-cache: past dates s-maxage 7d, today 1h, future 30m.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";
import { resolvePlace, suggestPlaces, timezoneFromLng } from "@/lib/kundali/geocoder";
import {
  PanchangInputError,
  computeDayPanchang,
  validatePanchangDate,
  validateLat,
  validateLng,
  validateTimezone,
  type PanchangDayResult,
} from "@/lib/panchang/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLACE_MAX_LEN = 120;

function cacheDirective(dateStr: string): string {
  // Compare against UTC "today"; panchang for past days can never change.
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr < today) return "public, s-maxage=604800, stale-while-revalidate=2592000";
  if (dateStr === today) return "public, s-maxage=3600, stale-while-revalidate=86400";
  return "public, s-maxage=1800, stale-while-revalidate=86400";
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await checkRateLimit(generalLimiter, `panchang:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please pause a moment and try again.", code: "RATE_LIMIT" },
      { status: 429, headers: rl.headers },
    );
  }

  try {
    const url = new URL(req.url);
    const date = validatePanchangDate(url.searchParams.get("date"), Date.now());

    const placeRaw = (url.searchParams.get("place") ?? "").trim();
    const latRaw = url.searchParams.get("lat");
    const lngRaw = url.searchParams.get("lng");
    const tzRaw = url.searchParams.get("tz");

    let lat: number;
    let lng: number;
    let timezone: string;
    let placeLabel: string;
    let tzSource: "param" | "gazetteer" | "nominatim" | "longitude-heuristic";

    if (latRaw !== null && lngRaw !== null) {
      // 1. Exact coordinates supplied (LocationAutocomplete onSelect sends these).
      lat = validateLat(latRaw);
      lng = validateLng(lngRaw);
      if (tzRaw) {
        timezone = validateTimezone(tzRaw);
        tzSource = "param";
      } else {
        timezone = timezoneFromLng(lng);
        tzSource = "longitude-heuristic";
      }
      placeLabel = placeRaw.slice(0, PLACE_MAX_LEN) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    } else if (placeRaw) {
      // 2. Free-text place → gazetteer → Nominatim (same resolver as kundali).
      if (placeRaw.length > PLACE_MAX_LEN) {
        throw new PanchangInputError("Place is too long — keep it as city + state (max 120 characters).");
      }
      const resolved = await resolvePlace(placeRaw, { allowNetwork: true, timeoutMs: 3500 });
      if (!resolved) {
        // 3. Unknown place → friendly error + top suggestions to pick from.
        const suggestions = await suggestPlaces(placeRaw, { limit: 3 });
        return NextResponse.json(
          {
            success: false,
            code: "PLACE_UNKNOWN",
            error: `We couldn't locate "${placeRaw}" — please pick the exact city from the suggestions, or try a "City, State" format.`,
            suggestions,
          },
          { status: 400, headers: rl.headers },
        );
      }
      lat = resolved.lat;
      lng = resolved.lng;
      timezone = resolved.timezone || timezoneFromLng(resolved.lng);
      tzSource = resolved.source === "gazetteer" ? "gazetteer" : "nominatim";
      placeLabel = resolved.canonicalName || placeRaw;
    } else {
      throw new PanchangInputError("Please provide a place or coordinates — type a city (e.g. Pune).");
    }

    const panchang: PanchangDayResult = computeDayPanchang({ date, lat, lng, timezone, placeLabel });

    const headers = new Headers(rl.headers);
    headers.set("Cache-Control", cacheDirective(date));
    return NextResponse.json(
      {
        success: true,
        panchang,
        meta: {
          sunriseISO: panchang.sunrise.iso,
          sunsetISO: panchang.sunset.iso,
          timezone: panchang.timezone,
          tzSource,
        },
      },
      { headers },
    );
  } catch (err) {
    if (err instanceof PanchangInputError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "VALIDATION" },
        { status: 400, headers: rl.headers },
      );
    }
    const message = err instanceof Error ? err.message : "Panchang compute failed";
    console.error("[panchang]", message);
    return NextResponse.json(
      { success: false, error: "We couldn't build your Panchang — please try again in a moment.", code: "INTERNAL" },
      { status: 500, headers: rl.headers },
    );
  }
}
