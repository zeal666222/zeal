// ============================================================================
// Rashi Chart (D1) - Vedic Natal Chart
// ============================================================================
// Computes the D1 (Rashi/Bhava) chart: the primary natal chart in Vedic astrology.
// Uses sidereal zodiac with Lahiri ayanamsa.
// ============================================================================

import * as Astronomy from "astronomy-engine";
import type {
  BirthData, NatalChart, PlanetPosition, HouseCusp,
  PlanetName, ZodiacSign,
} from "../types";
import { ZODIAC_SIGNS, RASHI_NAMES, VEDIC_PLANETS } from "../types";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { computeHouses, getHouseForPlanet, computeAscendant, computeMC, computeLST, apparentObliquity, toJulianDate } from "../utils/houses";

/** 27 Nakshatras with their lords and degree ranges */
export const NAKSHATRAS = [
  { name: "Ashwini", lord: "Ketu", start: 0 },
  { name: "Bharani", lord: "Venus", start: 13.333333 },
  { name: "Krittika", lord: "Sun", start: 26.666667 },
  { name: "Rohini", lord: "Moon", start: 40.0 },
  { name: "Mrigashira", lord: "Mars", start: 53.333333 },
  { name: "Ardra", lord: "Rahu", start: 66.666667 },
  { name: "Punarvasu", lord: "Jupiter", start: 80.0 },
  { name: "Pushya", lord: "Saturn", start: 93.333333 },
  { name: "Ashlesha", lord: "Mercury", start: 106.666667 },
  { name: "Magha", lord: "Ketu", start: 120.0 },
  { name: "Purva Phalguni", lord: "Venus", start: 133.333333 },
  { name: "Uttara Phalguni", lord: "Sun", start: 146.666667 },
  { name: "Hasta", lord: "Moon", start: 160.0 },
  { name: "Chitra", lord: "Mars", start: 173.333333 },
  { name: "Swati", lord: "Rahu", start: 186.666667 },
  { name: "Vishakha", lord: "Jupiter", start: 200.0 },
  { name: "Anuradha", lord: "Saturn", start: 213.333333 },
  { name: "Jyeshtha", lord: "Mercury", start: 226.666667 },
  { name: "Mula", lord: "Ketu", start: 240.0 },
  { name: "Purva Ashadha", lord: "Venus", start: 253.333333 },
  { name: "Uttara Ashadha", lord: "Sun", start: 266.666667 },
  { name: "Shravana", lord: "Moon", start: 280.0 },
  { name: "Dhanishta", lord: "Mars", start: 293.333333 },
  { name: "Shatabhisha", lord: "Rahu", start: 306.666667 },
  { name: "Purva Bhadrapada", lord: "Jupiter", start: 320.0 },
  { name: "Uttara Bhadrapada", lord: "Saturn", start: 333.333333 },
  { name: "Revati", lord: "Mercury", start: 346.666667 },
];

/**
 * Get the nakshatra for a given sidereal longitude.
 */
export function getNakshatra(longitude: number): {
  name: string;
  number: number;
  lord: string;
  pada: number;
} {
  const normalizedLon = ((longitude % 360) + 360) % 360;
  const nakshatraIndex = Math.floor(normalizedLon / (360 / 27));
  const nakshatra = NAKSHATRAS[nakshatraIndex] ?? NAKSHATRAS[0]!;

  // Calculate pada (quarter) within the nakshatra
  const degreesInNakshatra = normalizedLon - nakshatra.start;
  const pada = Math.floor(degreesInNakshatra / (360 / 27 / 4)) + 1;

  return {
    name: nakshatra.name,
    number: nakshatraIndex + 1,
    lord: nakshatra.lord,
    pada: Math.min(4, Math.max(1, pada)),
  };
}

/**
 * Convert absolute degree to sign, degree, minute, second.
 */
export function degreesToSignDeg(absoluteDegree: number): {
  sign: ZodiacSign;
  signIndex: number;
  degree: number;
  minute: number;
  second: number;
} {
  const normalized = ((absoluteDegree % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degreesInSign = normalized - signIndex * 30;
  const deg = Math.floor(degreesInSign);
  const remainingMinutes = (degreesInSign - deg) * 60;
  const minute = Math.floor(remainingMinutes);
  const second = Math.round((remainingMinutes - minute) * 60);

  return {
    sign: ZODIAC_SIGNS[signIndex] as ZodiacSign,
    signIndex,
    degree: deg,
    minute,
    second,
  };
}

/**
 * Compute the Rashi (D1) chart for a given birth data.
 */
export function computeRashiChart(birthData: BirthData): NatalChart {
  const dateTime = parseBirthDateTime(birthData);
  const time = getAstroTime(dateTime);
  const ayanamsa = getAyanamsa(time, "lahiri");

  // Compute Local Sidereal Time (apparent: nutation-corrected equinox)
  const lst = computeLST(dateTime, birthData.birthPlace.lng);

  // Angles of the date, not of the J2000 epoch — the Lagna and MC both move
  // with the drifting obliquity.
  const eps = apparentObliquity(toJulianDate(dateTime));

  // Compute Ascendant and MC
  const ramc = lst; // RAMC = local apparent sidereal time, by definition
  const mcDegree = computeMC(lst, eps);
  const mcSidereal = ((mcDegree - ayanamsa) % 360 + 360) % 360;
  const ascDegree = computeAscendant(ramc, birthData.birthPlace.lat, eps);
  const ascSidereal = ((ascDegree - ayanamsa) % 360 + 360) % 360;

  // Compute houses using Whole Sign (default for Vedic)
  const houses = computeHouses(ascSidereal, mcSidereal, birthData.birthPlace.lat, "whole-sign");

  // Get planet positions (sidereal)
  const planetStates = getVedicPlanetPositions(time, ayanamsa);

  // Build planet positions array
  const planets: PlanetPosition[] = [];
  for (const planetName of VEDIC_PLANETS) {
    const state = planetStates.get(planetName);
    if (!state) continue;

    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(state.longitude);
    const house = getHouseForPlanet(state.longitude, houses);
    const nakshatraData = getNakshatra(state.longitude);

    planets.push({
      planet: planetName,
      sign,
      signIndex,
      degree,
      minute,
      second,
      absoluteDegree: state.longitude,
      house,
      isRetrograde: state.isRetrograde,
      nakshatra: nakshatraData.name,
      nakshatraPada: nakshatraData.pada,
      nakshatraLord: nakshatraData.lord,
    });
  }

  // Build ascendant
  const ascData = degreesToSignDeg(ascSidereal);
  const ascendant: HouseCusp = {
    house: 1,
    sign: ascData.sign,
    signIndex: ascData.signIndex,
    degree: ascSidereal,
  };

  return {
    type: "vedic",
    chartName: "Rashi (D1)",
    birthData,
    planets,
    houses,
    ascendant,
    ayanamsa,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Compute the (tz → UTC) offset in minutes for a given wall-clock instant in
 * an IANA timezone, via Intl.DateTimeFormat. This correctly accounts for
 * historical DST rules and non-whole-hour offsets (e.g. IST +5:30, Nepal +5:45).
 */
function tzOffsetMinutes(wallUtcMs: number, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts: Record<string, number> = {};
    for (const p of dtf.formatToParts(new Date(wallUtcMs))) {
      if (p.type !== "literal") parts[p.type] = Number(p.value);
    }
    // Intl renders hour "24" at midnight on some engines — normalize.
    const hour = parts.hour === 24 ? 0 : parts.hour ?? 0;
    const asUtc = Date.UTC(
      parts.year ?? 1970,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      hour,
      parts.minute ?? 0,
      parts.second ?? 0,
    );
    return Math.round((asUtc - wallUtcMs) / 60000);
  } catch {
    return 0; // unknown timezone — treat as UTC
  }
}

/**
 * Accept "HH:MM", "H:MM AM/PM", "7pm", "hh:mm:ss" — return canonical HH:MM.
 * Legacy rows stored "7:30 PM" verbatim; without this they either throw or,
 * worse, get read as 07:30 (a PM birth treated as AM).
 */
export function normalizeBirthTime(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|p\.m\.|pm|a\.m\.)$/.exec(s);
  if (m12) {
    let h = parseInt(m12[1]!, 10);
    const min = m12[2] ?? "00";
    const isPm = m12[3]!.startsWith("p");
    if (h < 1 || h > 12 || parseInt(min, 10) > 59) throw new Error(`Invalid birth time: ${raw}`);
    h = isPm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  const m24 = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (m24) {
    const h = parseInt(m24[1]!, 10);
    const min = parseInt(m24[2]!, 10);
    if (h > 23 || min > 59) throw new Error(`Invalid birth time: ${raw}`);
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  throw new Error(`Invalid birth time: ${raw}. Use HH:MM (24h) or 7:30 PM.`);
}

/**
 * Parse birth date and time into a UTC Date object.
 *
 * Birth time is interpreted as LOCAL wall-clock time at the birth place. The
 * correct UTC instant is derived from the IANA timezone (handles DST + offsets
 * precisely). When no timezone is supplied, we fall back to an India (IST +5:30)
 * heuristic based on the coordinates, else UTC.
 */
export function parseBirthDateTime(birthData: BirthData): Date {
  const [year, month, day] = birthData.birthDate.split("-").map(Number);
  const [hours, minutes] = normalizeBirthTime(birthData.birthTime).split(":").map(Number);

  if (!year || !month || !day || hours === undefined || minutes === undefined) {
    throw new Error("Invalid birth date or time format. Use YYYY-MM-DD and HH:MM");
  }

  const wallUtcMs = Date.UTC(year, month - 1, day, hours, minutes);

  let utcOffsetMinutes: number;
  if (birthData.timezone) {
    // Offset is date-dependent (DST): evaluate it at the wall time, then apply.
    utcOffsetMinutes = tzOffsetMinutes(wallUtcMs, birthData.timezone);
  } else {
    const isIndia = birthData.birthPlace.lat > 6 && birthData.birthPlace.lat < 36
      && birthData.birthPlace.lng > 68 && birthData.birthPlace.lng < 98;
    utcOffsetMinutes = isIndia ? 330 : 0; // IST = UTC+5:30
  }

  // Adjust for timezone: subtract the offset to get UTC
  const date = new Date(wallUtcMs);
  date.setMinutes(date.getMinutes() - utcOffsetMinutes);

  return date;
}
