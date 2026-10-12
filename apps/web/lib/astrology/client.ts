// ============================================================================
// Astrology Worker HTTP Client
// ============================================================================
// Client for calling the zeal-astro Cloudflare Worker API.
// ============================================================================

import type {
  BirthData,
  NatalChart,
  DivisionalChart,
  WesternNatalChart,
  FourPillars,
  VimshottariDasha,
  TransitData,
  ShadbalaResult,
  AshtakavargaResult,
  Panchanga,
  HouseSystem,
} from "@zeal/astrology";

const ASTRO_WORKER_URL = process.env.ASTRO_WORKER_URL ?? "http://localhost:8787";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function astroFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${ASTRO_WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as ApiResponse<T>;

  if (!result.success || !result.data) {
    throw new Error(result.error ?? "Astrology computation failed");
  }

  return result.data;
}

/** Compute a Vedic chart (Rashi, Navamsa, or any divisional chart) */
export async function getVedicChart(
  birthData: BirthData,
  chartType: "rashi" | "navamsa" | "divisional" = "rashi",
  divisionalNumber?: number
): Promise<{
  chart: NatalChart | DivisionalChart;
  shadbala: ShadbalaResult;
  ashtakavarga: AshtakavargaResult;
  panchanga: Panchanga;
}> {
  return astroFetch("/api/chart/vedic", {
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthPlace: birthData.birthPlace,
    chartType,
    divisionalNumber,
  });
}

/** Compute a Western natal chart */
export async function getWesternChart(
  birthData: BirthData,
  houseSystem: HouseSystem = "placidus"
): Promise<{ chart: WesternNatalChart }> {
  return astroFetch("/api/chart/western", {
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthPlace: birthData.birthPlace,
    houseSystem,
  });
}

/** Compute Chinese BaZi (Four Pillars) */
export async function getChineseChart(
  birthDate: string,
  birthTime: string
): Promise<{ fourPillars: FourPillars }> {
  return astroFetch("/api/chart/chinese", {
    birthDate,
    birthTime,
  });
}

/** Compute Vimshottari Dasha */
export async function getDasha(
  birthData: BirthData
): Promise<VimshottariDasha & { allMahardashas: unknown[] }> {
  return astroFetch("/api/dasha", {
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthPlace: birthData.birthPlace,
  });
}

/** Compute transits (both Vedic and Western) */
export async function getTransits(
  birthData: BirthData,
  transitDate: string
): Promise<{ vedic: TransitData; western: TransitData }> {
  return astroFetch("/api/transit", {
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthPlace: birthData.birthPlace,
    transitDate,
  });
}
