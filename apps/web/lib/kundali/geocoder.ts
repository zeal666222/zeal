// ============================================================================
// Kundali Place Resolver — turn a "Place of Birth" string into precise
// coordinates + IANA timezone. Deterministic gazetteer first (fast, offline,
// free), then a best-effort OpenStreetMap Nominatim fallback (free,
// rate-limited, no key).
//
// The gazetteer table itself lives in @zeal/astrology, shared with the
// Cloudflare chat worker. Two copies had already started drifting (different
// spellings and duplicates for the same city), and a birth place has to resolve
// to the same coordinates whoever charts the kundali.
// ============================================================================

import {
  lookupGazetteerPlace,
  normalizePlace,
  suggestGazetteerPlaces,
  timezoneFromLng,
} from "@zeal/astrology";

export { timezoneFromLng };

export interface ResolvedPlace {
  lat: number;
  lng: number;
  timezone: string; // IANA, e.g. "Asia/Kolkata"
  canonicalName: string;
  country: string;
  source: "gazetteer" | "nominatim";
}

// ─── Nominatim (OSM) fallback — free, best-effort, cached ──────────────────────

const nominatimCache = new Map<string, { place: ResolvedPlace | null; at: number }>();
const NOMINATIM_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function lookupNominatim(input: string, timeoutMs: number): Promise<ResolvedPlace | null> {
  const key = normalizePlace(input);
  if (!key) return null;

  const hit = nominatimCache.get(key);
  if (hit && Date.now() - hit.at < NOMINATIM_TTL_MS) return hit.place;

  let place: ResolvedPlace | null = null;
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=" +
      encodeURIComponent(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Zeal-Astro/1.0 (contact: zealer.co.in)", "Accept": "application/json" },
    });
    clearTimeout(timer);
    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { city?: string; town?: string; state?: string; country?: string };
    }>;
    const top = json?.[0];
    if (top) {
      const lat = Number(top.lat);
      const lng = Number(top.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        place = {
          lat,
          lng,
          // Timezone unknown from Nominatim — caller must resolve via offset-from-lng heuristic.
          timezone: "",
          canonicalName:
            top.address?.city || top.address?.town || top.display_name.split(",")[0] || input,
          country: top.address?.country || "",
          source: "nominatim",
        };
      }
    }
  } catch {
    place = null; // fail soft
  }

  nominatimCache.set(key, { place, at: Date.now() });
  return place;
}

/**
 * Resolve a place-of-birth string. Gazetteer first (with an exact IANA tz);
 * Nominatim fallback derives an approximate tz from longitude.
 */
export async function resolvePlace(
  input: string,
  opts: { allowNetwork?: boolean; timeoutMs?: number } = {}
): Promise<ResolvedPlace | null> {
  const gaz = lookupGazetteerPlace(input);
  if (gaz) return { ...gaz, source: "gazetteer" };

  if (opts.allowNetwork === false) return null;
  const nom = await lookupNominatim(input, opts.timeoutMs ?? 3500);
  if (nom && !nom.timezone) nom.timezone = timezoneFromLng(nom.lng);
  return nom;
}

// ─── Autocomplete suggestions (used by /api/geo/suggest) ──────────────────────

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lng: number;
  timezone: string;
  country: string;
  source: "gazetteer" | "nominatim";
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const suggestCache = new Map<string, { items: PlaceSuggestion[]; at: number }>();
let lastNominatimSuggestAt = 0;

/**
 * Place suggestions for a partial query. Gazetteer-first; Nominatim tops up
 * only when the offline set is thin and the 1-req/s pace window is free —
 * callers never wait on OSM, they just get fewer (still valid) results.
 */
export async function suggestPlaces(
  q: string,
  opts: { limit?: number; timeoutMs?: number } = {}
): Promise<PlaceSuggestion[]> {
  const limit = opts.limit ?? 6;
  const gaz: PlaceSuggestion[] = suggestGazetteerPlaces(q, limit).map((s) => ({
    ...s,
    source: "gazetteer" as const,
  }));
  if (gaz.length >= 3) return gaz.slice(0, limit);

  const key = normalizePlace(q);
  if (!key || key.length < 2) return gaz;

  const hit = suggestCache.get(key);
  if (hit && Date.now() - hit.at < NOMINATIM_TTL_MS) {
    return dedupe([...gaz, ...hit.items]).slice(0, limit);
  }

  if (Date.now() - lastNominatimSuggestAt < 1050) return gaz; // fair-use pace busy → offline set
  lastNominatimSuggestAt = Date.now();

  let items: PlaceSuggestion[] = [];
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=en&q=" +
      encodeURIComponent(q);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 2500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Zeal-Astro/1.0 (contact: zealer.co.in)", Accept: "application/json" },
    });
    clearTimeout(timer);
    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
    }>;
    items = (json ?? [])
      .map((r): PlaceSuggestion | null => {
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const a = r.address ?? {};
        const city = a.city || a.town || a.village || r.display_name.split(",")[0] || "";
        const country = a.country || "";
        const state = a.state ? `${a.state}, ` : "";
        return {
          label: [titleCase(city), `${state}${country}`.trim()].filter(Boolean).join(", "),
          lat,
          lng,
          timezone: timezoneFromLng(lng),
          country,
          source: "nominatim" as const,
        };
      })
      .filter((x): x is PlaceSuggestion => Boolean(x));
  } catch {
    items = []; // fail soft — offline set still returned below
  }

  suggestCache.set(key, { items, at: Date.now() });
  return dedupe([...gaz, ...items]).slice(0, limit);
}

function dedupe(list: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
