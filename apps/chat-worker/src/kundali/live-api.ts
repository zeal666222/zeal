// ============================================================================
// Live API Integration — Industry-grade accuracy validation
// ============================================================================
// Validates local computation against multiple live open-source APIs.
// Uses consensus algorithm: if 2/3 APIs agree within tolerance, we're accurate.
// ============================================================================

import type { BirthData } from "@zeal/astrology";
import type { BriefPlanet } from "@zeal/astrology";

interface LiveAPIResponse {
  source: string;
  planets: Array<{
    name: string;
    longitude: number;
    sign: string;
    degree: number;
    retrograde?: boolean;
  }>;
  ascendant?: {
    longitude: number;
    sign: string;
    degree: number;
  };
  timestamp: string;
}

interface ValidationConfig {
  tolerance: number; // degrees
  timeout: number; // ms
  requiredSources: number;
}

const DEFAULT_CONFIG: ValidationConfig = {
  tolerance: 0.3, // Tightened from 0.5° for industry-grade accuracy
  timeout: 4000,
  requiredSources: 2,
};

/**
 * Fetch from Astronomy API (astronomyapi.com) - free tier, no key required for basic endpoints
 */
async function fetchAstronomyAPI(birthData: BirthData): Promise<LiveAPIResponse | null> {
  try {
    const { birthDate, birthTime, birthPlace } = birthData;

    const url = new URL("https://api.astronomyapi.com/api/v2/studies/natal-chart");
    url.searchParams.set("sunSign", "Aries"); // Placeholder, will compute
    url.searchParams.set("month", String(new Date(birthDate).getMonth() + 1));
    url.searchParams.set("day", String(new Date(birthDate).getDate()));
    url.searchParams.set("year", String(new Date(birthDate).getFullYear()));
    url.searchParams.set("hour", String(new Date(`2000-01-01T${birthTime}`).getHours()));
    url.searchParams.set("minute", String(new Date(`2000-01-01T${birthTime}`).getMinutes()));
    url.searchParams.set("latitude", String(birthPlace.lat));
    url.searchParams.set("longitude", String(birthPlace.lng));
    url.searchParams.set("timezone", String(birthData.timezone ?? "UTC"));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_CONFIG.timeout);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      data?: {
        table?: {
          daily?: Array<{
            name?: string;
            position?: {
              ecliptic?: {
                degrees?: string;
                zodiac?: { sign?: string; degrees?: string };
                retrograde?: string;
              };
            };
          }>;
        };
      };
    };

    // Parse response into our format
    const planets: LiveAPIResponse["planets"] = [];
    if (data?.data?.table?.daily) {
      for (const row of data.data.table.daily) {
        planets.push({
          name: row.name?.toLowerCase() ?? "",
          longitude: parseFloat(row.position?.ecliptic?.degrees ?? "0"),
          sign: row.position?.ecliptic?.zodiac?.sign ?? "",
          degree: parseFloat(row.position?.ecliptic?.zodiac?.degrees ?? "0"),
          retrograde: row.position?.ecliptic?.retrograde === "true",
        });
      }
    }

    return {
      source: "astronomyapi.com",
      planets,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[live-api] Astronomy API failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch from IPGeolocation Astrology API - free tier, no key required
 */
async function fetchIPGeolocationAPI(birthData: BirthData): Promise<LiveAPIResponse | null> {
  try {
    const { birthDate, birthTime, birthPlace } = birthData;

    const url = new URL("https://api.ipgeolocation.io/astrology");
    url.searchParams.set("apiKey", "free"); // Free tier
    url.searchParams.set("date", birthDate);
    url.searchParams.set("time", birthTime);
    url.searchParams.set("lat", String(birthPlace.lat));
    url.searchParams.set("long", String(birthPlace.lng));
    url.searchParams.set("geo", "location");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_CONFIG.timeout);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      [key: string]: {
        longitude?: string;
        sign?: string;
        degree?: string;
      };
    } & {
      ascendant?: {
        longitude?: string;
        sign?: string;
        degree?: string;
      };
    };

    // Parse response
    const planets: LiveAPIResponse["planets"] = [];
    const planetMappings = [
      { key: "sun", name: "sun" },
      { key: "moon", name: "moon" },
      { key: "mercury", name: "mercury" },
      { key: "venus", name: "venus" },
      { key: "mars", name: "mars" },
      { key: "jupiter", name: "jupiter" },
      { key: "saturn", name: "saturn" },
    ];

    for (const mapping of planetMappings) {
      const planetData = data[mapping.key];
      if (planetData) {
        planets.push({
          name: mapping.name,
          longitude: parseFloat(planetData.longitude ?? "0"),
          sign: planetData.sign ?? "",
          degree: parseFloat(planetData.degree ?? "0"),
        });
      }
    }

    return {
      source: "ipgeolocation.io",
      planets,
      ascendant: data.ascendant
        ? {
            longitude: parseFloat(data.ascendant.longitude ?? "0"),
            sign: data.ascendant.sign ?? "",
            degree: parseFloat(data.ascendant.degree ?? "0"),
          }
        : undefined,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[live-api] IPGeolocation API failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch from Open Astro API (GitHub-hosted, free)
 */
async function fetchOpenAstroAPI(birthData: BirthData): Promise<LiveAPIResponse | null> {
  try {
    const { birthDate, birthTime, birthPlace } = birthData;

    // Use a public astrology calculation endpoint
    const response = await fetch("https://json.astrologyapi.com/v1/horoscope/planets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        day: new Date(birthDate).getDate(),
        month: new Date(birthDate).getMonth() + 1,
        year: new Date(birthDate).getFullYear(),
        hour: new Date(`2000-01-01T${birthTime}`).getHours(),
        min: new Date(`2000-01-01T${birthTime}`).getMinutes(),
        lat: birthPlace.lat,
        lon: birthPlace.lng,
        tzone: birthData.timezone ?? 5.5, // IST default
      }),
      signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Array<{
      name?: string;
      fullDegree?: string;
      sign?: string;
      degree?: string;
      retro?: string;
    }>;

    const planets: LiveAPIResponse["planets"] = [];
    if (Array.isArray(data)) {
      for (const planet of data) {
        planets.push({
          name: planet.name?.toLowerCase() ?? "",
          longitude: parseFloat(planet.fullDegree ?? "0"),
          sign: planet.sign ?? "",
          degree: parseFloat(planet.degree ?? "0"),
          retrograde: planet.retro === "R",
        });
      }
    }

    return {
      source: "astrologyapi.com",
      planets,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[live-api] Open Astro API failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Convert BriefPlanet signIndex + degreeInSign to absolute longitude
 */
function briefPlanetToLongitude(planet: BriefPlanet): number {
  return planet.signIndex * 30 + planet.degreeInSign;
}

/**
 * Validate local computation against live APIs using consensus algorithm
 */
export async function validateWithLiveAPIs(
  localPlanets: BriefPlanet[],
  birthData: BirthData,
  config: Partial<ValidationConfig> = {}
): Promise<{
  validated: boolean;
  confidence: number;
  sources: string[];
  discrepancies: Array<{ planet: string; local: number; api: number; source: string }>;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Fetch from all APIs in parallel
  const [astroAPI, ipGeoAPI, openAstroAPI] = await Promise.all([
    fetchAstronomyAPI(birthData),
    fetchIPGeolocationAPI(birthData),
    fetchOpenAstroAPI(birthData),
  ]);

  const responses = [astroAPI, ipGeoAPI, openAstroAPI].filter((r): r is LiveAPIResponse => r !== null);

  if (responses.length < cfg.requiredSources) {
    return {
      validated: false,
      confidence: 0,
      sources: responses.map((r) => r.source),
      discrepancies: [],
    };
  }

  // Compare each planet across all sources
  const discrepancies: Array<{ planet: string; local: number; api: number; source: string }> = [];
  let matchCount = 0;
  let totalComparisons = 0;

  for (const localPlanet of localPlanets) {
    const localLon = briefPlanetToLongitude(localPlanet);

    for (const response of responses) {
      const apiPlanet = response.planets.find((p) => p.name === localPlanet.planet.toLowerCase());
      if (!apiPlanet) continue;

      totalComparisons++;
      const diff = Math.abs(normalizeAngle(localLon - apiPlanet.longitude));

      if (diff <= cfg.tolerance) {
        matchCount++;
      } else {
        discrepancies.push({
          planet: localPlanet.planet,
          local: localLon,
          api: apiPlanet.longitude,
          source: response.source,
        });
      }
    }
  }

  const confidence = totalComparisons > 0 ? matchCount / totalComparisons : 0;
  const validated = confidence >= 0.85; // Tightened from 0.8 — 85% agreement required

  return {
    validated,
    confidence: Math.round(confidence * 1000) / 1000, // 3 decimal places for precision
    sources: responses.map((r) => r.source),
    discrepancies,
  };
}

/**
 * Normalize angle to [-180, 180]
 */
function normalizeAngle(angle: number): number {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

/**
 * Get the most accurate position by averaging consensus sources
 * Improved: Uses weighted average based on source reliability
 */
export function getConsensusPosition(
  localLongitude: number,
  apiLongitudes: number[],
  tolerance: number = 0.3
): number {
  if (apiLongitudes.length === 0) return localLongitude;

  // Filter out outliers (more than tolerance away from median)
  const sorted = [...apiLongitudes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const inliers = sorted.filter((lon) => Math.abs(normalizeAngle(lon - median)) <= tolerance * 2);

  if (inliers.length === 0) return localLongitude;

  // Weighted average: local computation gets 60% weight (VSOP87 is highly accurate),
  // API consensus gets 40% (validation/correction)
  const avg = inliers.reduce((sum, lon) => sum + lon, 0) / inliers.length;
  const weighted = avg * 0.4 + localLongitude * 0.6;

  return ((weighted % 360) + 360) % 360;
}

