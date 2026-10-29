// ============================================================================
// Kundali Place Resolver — turn a "Place of Birth" string into precise
// coordinates + IANA timezone. Deterministic gazetteer first (fast, offline,
// free), then a best-effort OpenStreetMap Nominatim fallback (free, rate-limited).
// ============================================================================

export interface ResolvedPlace {
  lat: number;
  lng: number;
  timezone: string; // IANA, e.g. "Asia/Kolkata"
  canonicalName: string;
  country: string;
  source: "gazetteer" | "nominatim";
}

// ─── Gazetteer: India-first (our core audience), then world ───────────────────

const GAZETTEER: Array<{
  names: string[];
  lat: number;
  lng: number;
  tz: string;
  country: string;
}> = [
  // ——— India ———
  { names: ["new delhi", "delhi"], lat: 28.6139, lng: 77.209, tz: "Asia/Kolkata", country: "India" },
  { names: ["mumbai", "bombay"], lat: 19.076, lng: 72.8777, tz: "Asia/Kolkata", country: "India" },
  { names: ["kolkata", "calcutta"], lat: 22.5726, lng: 88.3639, tz: "Asia/Kolkata", country: "India" },
  { names: ["chennai", "madras"], lat: 13.0827, lng: 80.2707, tz: "Asia/Kolkata", country: "India" },
  { names: ["bengaluru", "bangalore"], lat: 12.9716, lng: 77.5946, tz: "Asia/Kolkata", country: "India" },
  { names: ["hyderabad"], lat: 17.385, lng: 78.4867, tz: "Asia/Kolkata", country: "India" },
  { names: ["pune"], lat: 18.5204, lng: 73.8567, tz: "Asia/Kolkata", country: "India" },
  { names: ["ahmedabad"], lat: 23.0225, lng: 72.5714, tz: "Asia/Kolkata", country: "India" },
  { names: ["surat"], lat: 21.1702, lng: 72.8311, tz: "Asia/Kolkata", country: "India" },
  { names: ["jaipur"], lat: 26.9124, lng: 75.7873, tz: "Asia/Kolkata", country: "India" },
  { names: ["lucknow"], lat: 26.8467, lng: 80.9462, tz: "Asia/Kolkata", country: "India" },
  { names: ["kanpur"], lat: 26.443, lng: 80.3494, tz: "Asia/Kolkata", country: "India" },
  { names: ["nagpur"], lat: 21.1458, lng: 79.0932, tz: "Asia/Kolkata", country: "India" },
  { names: ["indore"], lat: 22.7196, lng: 75.8577, tz: "Asia/Kolkata", country: "India" },
  { names: ["bhopal"], lat: 23.2599, lng: 77.4126, tz: "Asia/Kolkata", country: "India" },
  { names: ["patna"], lat: 25.5941, lng: 85.1376, tz: "Asia/Kolkata", country: "India" },
  { names: ["varanasi", "banaras", "benares", "kashi"], lat: 25.3176, lng: 82.9739, tz: "Asia/Kolkata", country: "India" },
  { names: ["agra"], lat: 27.1767, lng: 78.0081, tz: "Asia/Kolkata", country: "India" },
  { names: ["chandigarh"], lat: 30.7333, lng: 76.7794, tz: "Asia/Kolkata", country: "India" },
  { names: ["kochi", "cochin"], lat: 9.9312, lng: 76.2673, tz: "Asia/Kolkata", country: "India" },
  { names: ["thiruvananthapuram", "trivandrum"], lat: 8.5241, lng: 76.9366, tz: "Asia/Kolkata", country: "India" },
  { names: ["coimbatore"], lat: 11.0168, lng: 76.9558, tz: "Asia/Kolkata", country: "India" },
  { names: ["madurai"], lat: 9.9252, lng: 78.1198, tz: "Asia/Kolkata", country: "India" },
  { names: ["visakhapatnam", "vizag"], lat: 17.6868, lng: 83.2185, tz: "Asia/Kolkata", country: "India" },
  { names: ["guwahati"], lat: 26.1445, lng: 91.7362, tz: "Asia/Kolkata", country: "India" },
  { names: ["shillong"], lat: 25.5788, lng: 91.8933, tz: "Asia/Kolkata", country: "India" },
  { names: ["imphal"], lat: 24.8095, lng: 93.9386, tz: "Asia/Kolkata", country: "India" },
  { names: ["agartala"], lat: 23.826, lng: 91.376, tz: "Asia/Kolkata", country: "India" },
  { names: ["aizawl"], lat: 23.7104, lng: 92.72, tz: "Asia/Kolkata", country: "India" },
  { names: ["dispur", "guwahati city"], lat: 26.31, lng: 91.72, tz: "Asia/Kolkata", country: "India" },
  { names: ["itangar"], lat: 27.09, lng: 92.58, tz: "Asia/Kolkata", country: "India" },
  { names: ["ranchi"], lat: 23.3441, lng: 85.3096, tz: "Asia/Kolkata", country: "India" },
  { names: ["jamshedpur"], lat: 22.8045, lng: 86.2029, tz: "Asia/Kolkata", country: "India" },
  { names: ["raipur"], lat: 21.2514, lng: 81.6296, tz: "Asia/Kolkata", country: "India" },
  { names: ["dehradun"], lat: 30.3165, lng: 78.0322, tz: "Asia/Kolkata", country: "India" },
  { names: ["srinagar"], lat: 34.0837, lng: 74.7973, tz: "Asia/Kolkata", country: "India" },
  { names: ["jammu"], lat: 32.7266, lng: 74.857, tz: "Asia/Kolkata", country: "India" },
  { names: ["amritsar"], lat: 31.634, lng: 74.8723, tz: "Asia/Kolkata", country: "India" },
  { names: ["ludhiana"], lat: 30.901, lng: 75.8573, tz: "Asia/Kolkata", country: "India" },
  { names: ["noida"], lat: 28.5355, lng: 77.391, tz: "Asia/Kolkata", country: "India" },
  { names: ["gurgaon", "gurugram"], lat: 28.4595, lng: 77.0266, tz: "Asia/Kolkata", country: "India" },
  { names: ["vadodara", "baroda"], lat: 22.3072, lng: 73.1812, tz: "Asia/Kolkata", country: "India" },
  { names: ["rajkot"], lat: 22.3039, lng: 70.8022, tz: "Asia/Kolkata", country: "India" },
  { names: ["bhavnagar"], lat: 21.7645, lng: 72.1518, tz: "Asia/Kolkata", country: "India" },
  { names: ["surat thana"], lat: 19.18, lng: 72.96, tz: "Asia/Kolkata", country: "India" },
  { names: ["nasik", "nashik"], lat: 19.9975, lng: 73.7898, tz: "Asia/Kolkata", country: "India" },
  { names: ["aurangabad"], lat: 19.8762, lng: 75.3433, tz: "Asia/Kolkata", country: "India" },
  { names: ["nagaur"], lat: 27.05, lng: 73.75, tz: "Asia/Kolkata", country: "India" },
  { names: ["udaipur"], lat: 24.5854, lng: 73.7125, tz: "Asia/Kolkata", country: "India" },
  { names: ["jodhpur"], lat: 26.2389, lng: 73.0243, tz: "Asia/Kolkata", country: "India" },
  { names: ["bihar sharif"], lat: 25.1, lng: 85.19, tz: "Asia/Kolkata", country: "India" },
  { names: ["gaya"], lat: 24.7914, lng: 85.0002, tz: "Asia/Kolkata", country: "India" },
  { names: ["muzaffarpur"], lat: 26.08, lng: 85.42, tz: "Asia/Kolkata", country: "India" },
  { names: ["cuttack", "cuttaka"], lat: 20.4625, lng: 85.883, tz: "Asia/Kolkata", country: "India" },
  { names: ["bhubaneswar"], lat: 20.2961, lng: 85.8245, tz: "Asia/Kolkata", country: "India" },
  { names: ["vizianagaram"], lat: 18.1167, lng: 83.41, tz: "Asia/Kolkata", country: "India" },
  { names: ["vijayawada"], lat: 16.5062, lng: 80.648, tz: "Asia/Kolkata", country: "India" },
  { names: ["tirupati"], lat: 13.6288, lng: 79.4192, tz: "Asia/Kolkata", country: "India" },
  { names: ["salem"], lat: 11.6643, lng: 78.1464, tz: "Asia/Kolkata", country: "India" },
  { names: ["trichy", "tiruchirappalli"], lat: 10.7905, lng: 78.7047, tz: "Asia/Kolkata", country: "India" },
  { names: ["mysore", "mysuru"], lat: 12.2958, lng: 76.6393, tz: "Asia/Kolkata", country: "India" },
  { names: ["mangalore", "mangaluru"], lat: 12.9141, lng: 74.856, tz: "Asia/Kolkata", country: "India" },
  { names: ["hubli", "hubballi"], lat: 14.0, lng: 75.13, tz: "Asia/Kolkata", country: "India" },
  { names: ["belgaum", "belagavi"], lat: 15.85, lng: 74.5, tz: "Asia/Kolkata", country: "India" },
  { names: ["gwalior"], lat: 26.2183, lng: 78.1828, tz: "Asia/Kolkata", country: "India" },
  { names: ["jabalpur"], lat: 23.1815, lng: 79.9469, tz: "Asia/Kolkata", country: "India" },
  { names: ["indore city"], lat: 22.72, lng: 75.86, tz: "Asia/Kolkata", country: "India" },
  { names: ["porbandar"], lat: 21.6417, lng: 69.6293, tz: "Asia/Kolkata", country: "India" },
  { names: ["dwarka"], lat: 22.2394, lng: 68.9678, tz: "Asia/Kolkata", country: "India" },
  { names: ["ayodhya", "adhya"], lat: 26.79, lng: 82.21, tz: "Asia/Kolkata", country: "India" },
  { names: ["mathura"], lat: 27.4924, lng: 77.6733, tz: "Asia/Kolkata", country: "India" },
  { names: ["haridwar"], lat: 29.9457, lng: 78.1642, tz: "Asia/Kolkata", country: "India" },
  { names: ["rishikesh"], lat: 30.0869, lng: 78.2676, tz: "Asia/Kolkata", country: "India" },
  { names: ["prayagraj", "allahabad"], lat: 25.4358, lng: 81.8463, tz: "Asia/Kolkata", country: "India" },

  // ——— Neighbouring ———
  { names: ["kathmandu"], lat: 27.7172, lng: 85.324, tz: "Asia/Kathmandu", country: "Nepal" },
  { names: ["pokhara"], lat: 28.2096, lng: 83.9856, tz: "Asia/Kathmandu", country: "Nepal" },
  { names: ["dhaka"], lat: 23.8103, lng: 90.4125, tz: "Asia/Dhaka", country: "Bangladesh" },
  { names: ["colombo"], lat: 6.9271, lng: 79.8612, tz: "Asia/Colombo", country: "Sri Lanka" },
  { names: ["karachi"], lat: 24.8607, lng: 67.0011, tz: "Asia/Karachi", country: "Pakistan" },
  { names: ["lahore"], lat: 31.5204, lng: 74.3587, tz: "Asia/Karachi", country: "Pakistan" },
  { names: ["islamabad"], lat: 33.6844, lng: 73.0479, tz: "Asia/Karachi", country: "Pakistan" },
  { names: ["kabul"], lat: 34.5553, lng: 69.2075, tz: "Asia/Kabul", country: "Afghanistan" },
  { names: ["thimphu"], lat: 27.4712, lng: 89.6333, tz: "Asia/Thimphu", country: "Bhutan" },
  { names: ["male", "malé"], lat: 4.1755, lng: 73.5093, tz: "Indian/Maldives", country: "Maldives" },

  // ——— World (major) ———
  { names: ["dubai"], lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai", country: "UAE" },
  { names: ["abu dhabi"], lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai", country: "UAE" },
  { names: ["riyadh"], lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh", country: "Saudi Arabia" },
  { names: ["singapore"], lat: 1.3521, lng: 103.8198, tz: "Asia/Singapore", country: "Singapore" },
  { names: ["bangkok"], lat: 13.7563, lng: 100.5018, tz: "Asia/Bangkok", country: "Thailand" },
  { names: ["kuala lumpur"], lat: 3.139, lng: 101.6869, tz: "Asia/Kuala_Lumpur", country: "Malaysia" },
  { names: ["jakarta"], lat: -6.2088, lng: 106.8456, tz: "Asia/Jakarta", country: "Indonesia" },
  { names: ["manila"], lat: 14.5995, lng: 120.9842, tz: "Asia/Manila", country: "Philippines" },
  { names: ["tokyo"], lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo", country: "Japan" },
  { names: ["beijing"], lat: 39.9042, lng: 116.4074, tz: "Asia/Shanghai", country: "China" },
  { names: ["shanghai"], lat: 31.2304, lng: 121.4737, tz: "Asia/Shanghai", country: "China" },
  { names: ["seoul"], lat: 37.5665, lng: 126.978, tz: "Asia/Seoul", country: "South Korea" },
  { names: ["london"], lat: 51.5074, lng: -0.1278, tz: "Europe/London", country: "United Kingdom" },
  { names: ["manchester"], lat: 53.4808, lng: -2.2426, tz: "Europe/London", country: "United Kingdom" },
  { names: ["paris"], lat: 48.8566, lng: 2.3522, tz: "Europe/Paris", country: "France" },
  { names: ["berlin"], lat: 52.52, lng: 13.405, tz: "Europe/Berlin", country: "Germany" },
  { names: ["amsterdam"], lat: 52.3676, lng: 4.9041, tz: "Europe/Amsterdam", country: "Netherlands" },
  { names: ["madrid"], lat: 40.4168, lng: -3.7038, tz: "Europe/Madrid", country: "Spain" },
  { names: ["rome"], lat: 41.9028, lng: 12.4964, tz: "Europe/Rome", country: "Italy" },
  { names: ["moscow"], lat: 55.7558, lng: 37.6173, tz: "Europe/Moscow", country: "Russia" },
  { names: ["istanbul"], lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul", country: "Turkey" },
  { names: ["toronto"], lat: 43.6532, lng: -79.3832, tz: "America/Toronto", country: "Canada" },
  { names: ["vancouver"], lat: 49.2827, lng: -123.1207, tz: "America/Vancouver", country: "Canada" },
  { names: ["new york", "nyc"], lat: 40.7128, lng: -74.006, tz: "America/New_York", country: "USA" },
  { names: ["chicago"], lat: 41.8781, lng: -87.6298, tz: "America/Chicago", country: "USA" },
  { names: ["san francisco"], lat: 37.7749, lng: -122.4194, tz: "America/Los_Angeles", country: "USA" },
  { names: ["los angeles"], lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles", country: "USA" },
  { names: ["dallas"], lat: 32.7767, lng: -96.797, tz: "America/Chicago", country: "USA" },
  { names: ["sydney"], lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney", country: "Australia" },
  { names: ["melbourne"], lat: -37.8136, lng: 144.9631, tz: "Australia/Melbourne", country: "Australia" },
  { names: ["johannesburg"], lat: -26.2041, lng: 28.0473, tz: "Africa/Johannesburg", country: "South Africa" },
  { names: ["lagos"], lat: 6.5244, lng: 3.3792, tz: "Africa/Lagos", country: "Nigeria" },
  { names: ["cairo"], lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo", country: "Egypt" },
  { names: ["nairobi"], lat: -1.2921, lng: 36.8219, tz: "Africa/Nairobi", country: "Kenya" },
  { names: ["são paulo", "sao paulo"], lat: -23.5505, lng: -46.6333, tz: "America/Sao_Paulo", country: "Brazil" },
];

// ─── Normalization helpers ─────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract candidate city tokens from "City, District, State, Country". */
function candidateTokens(input: string): string[] {
  const parts = input
    .split(",")
    .map((p) => normalize(p))
    .filter((p): p is string => Boolean(p));
  const out: string[] = [];
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (first) out.push(first);
  if (parts.length > 1 && last) out.push(last);
  // Also try the whole normalized string
  out.push(normalize(input));
  // First word alone (handles "Mumbai, India" → "mumbai")
  const firstWord = first?.split(" ")[0];
  if (firstWord) out.push(firstWord);
  return Array.from(new Set(out)).filter((t) => t.length >= 2);
}

// ─── Gazetteer lookup ───────────────────────────────────────────────────────────

function lookupGazetteer(input: string): ResolvedPlace | null {
  const tokens = candidateTokens(input);
  for (const entry of GAZETTEER) {
    for (const name of entry.names) {
      if (tokens.includes(name)) {
        return {
          lat: entry.lat,
          lng: entry.lng,
          timezone: entry.tz,
          canonicalName: name.replace(/\b\w/g, (c) => c.toUpperCase()),
          country: entry.country,
          source: "gazetteer",
        };
      }
    }
  }
  return null;
}

// ─── Nominatim (OSM) fallback — free, best-effort, cached ──────────────────────

const nominatimCache = new Map<string, { place: ResolvedPlace | null; at: number }>();
const NOMINATIM_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function lookupNominatim(input: string, timeoutMs: number): Promise<ResolvedPlace | null> {
  const key = normalize(input);
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

/** Rough timezone from longitude for OSM results lacking tz (civil approx). */
export function timezoneFromLng(lng: number): string {
  // India spans 68–97°E → Asia/Kolkata
  if (lng >= 68 && lng <= 97) return "Asia/Kolkata";
  const offsetHours = Math.round(lng / 15);
  return `Etc/GMT${offsetHours >= 0 ? "-" : "+"}${Math.abs(offsetHours)}`;
}

/**
 * Resolve a place-of-birth string. Gazetteer first (with an exact IANA tz);
 * Nominatim fallback derives an approximate tz from longitude.
 */
export async function resolvePlace(
  input: string,
  opts: { allowNetwork?: boolean; timeoutMs?: number } = {}
): Promise<ResolvedPlace | null> {
  const gaz = lookupGazetteer(input);
  if (gaz) return gaz;

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

function suggestGazetteer(q: string, limit: number): PlaceSuggestion[] {
  const n = normalize(q);
  if (n.length < 2) return [];
  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const entry of GAZETTEER) {
    for (const name of entry.names) {
      if ((name.startsWith(n) || name.includes(` ${n}`)) && !seen.has(entry.tz + entry.lat)) {
        seen.add(entry.tz + entry.lat);
        out.push({
          label: `${titleCase(name)}, ${entry.country}`,
          lat: entry.lat,
          lng: entry.lng,
          timezone: entry.tz,
          country: entry.country,
          source: "gazetteer",
        });
        break;
      }
    }
    if (out.length >= limit) break;
  }
  return out;
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
  const gaz = suggestGazetteer(q, limit);
  if (gaz.length >= 3) return gaz.slice(0, limit);

  const key = normalize(q);
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
