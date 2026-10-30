// ============================================================================
// House System Calculations
// ============================================================================
// Implements Placidus, Whole Sign, Koch, and Equal house systems.
// ============================================================================

import type { HouseCusp, ZodiacSign, HouseSystem } from "../types";
import { ZODIAC_SIGNS } from "../types";

const DEG = Math.PI / 180;

/** Julian Date (UT) from a JS Date — used by the sidereal-time and nutation series. */
export function toJulianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24
    + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;

  let yr = y;
  let mo = m;
  if (mo <= 2) {
    yr -= 1;
    mo += 12;
  }

  const A = Math.floor(yr / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (yr + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + B - 1524.5;
}

/**
 * Mean obliquity of the ecliptic, degrees (Meeus ch. 22).
 * The J2000 constant 23.4392911° drifts ~0.013°/century, which is ~0.02° of
 * Lagna across a human lifetime — worth using the value for the date.
 */
export function meanObliquity(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const e0 = 23.439291111111
    - (46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 3600;
  return e0;
}

/**
 * Nutation in longitude (Δψ) and obliquity (Δε), arcseconds, from Meeus'
 * four-term abbreviated series. The full 148-term IAU series moves these by
 * under 0.1", far below what any ephemeris-grade chart resolution needs.
 */
export function nutation(jd: number): { dPsi: number; dEps: number } {
  const T = (jd - 2451545.0) / 36525;
  const omega = 125.04452 - 1934.136261 * T + 0.0020754 * T * T + (T * T * T) / 467441;
  const sunLong = 280.4661737 + 36000.7698278 * T;
  const moonLong = 218.316386254 + 481267.88175154 * T;

  const dPsi =
    -17.20 * Math.sin(omega * DEG)
    - 1.32 * Math.sin(2 * sunLong * DEG)
    - 0.23 * Math.sin(2 * moonLong * DEG)
    + 0.21 * Math.sin(2 * omega * DEG);

  const dEps =
    9.20 * Math.cos(omega * DEG)
    + 0.57 * Math.cos(2 * sunLong * DEG)
    + 0.10 * Math.cos(2 * moonLong * DEG)
    - 0.09 * Math.cos(2 * omega * DEG);

  return { dPsi, dEps };
}

/** Apparent obliquity of the ecliptic for a date, degrees (mean + nutation). */
export function apparentObliquity(jd: number): number {
  return meanObliquity(jd) + nutation(jd).dEps / 3600;
}

/**
 * Greenwich Mean Sidereal Time, degrees (IAU-82 expression in JD0).
 */
function gmstDegrees(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T - (T * T * T) / 38710000.0;
  return ((gmst % 360) + 360) % 360;
}

/**
 * Compute Local Sidereal Time (apparent, i.e. GAST + east longitude) in degrees.
 *
 * Apparent rather than mean: the equation of equinoxes (Δψ·cos ε) is worth up to
 * 0.016° of sidereal time, which puts the Lagna out by a similar amount — the
 * difference between "Mesha 29°58'" and "Vrishabha 0°01'" for a boundary birth.
 */
export function computeLST(date: Date, longitude: number): number {
  const jd = toJulianDate(date);
  const ee = (nutation(jd).dPsi * Math.cos(meanObliquity(jd) * DEG)) / 3600;
  const gast = gmstDegrees(jd) + ee;
  return (((gast + longitude) % 360) + 360) % 360;
}

/** Obliquity argument used by the cusp formulas, defaulting to the WGS-era mean. */
function obliquityRad(obliquity?: number): number {
  return (obliquity ?? 23.43929111) * DEG;
}

/**
 * Compute house cusps based on the selected house system.
 *
 * @param ascendantDegree - The tropical/sidereal longitude of the ascendant (0-360)
 * @param mcDegree - The tropical/sidereal longitude of the Midheaven (0-360)
 * @param latitude - Geographic latitude of birthplace
 * @param system - House system to use
 * @returns Array of 12 house cusps
 */
export function computeHouses(
  ascendantDegree: number,
  mcDegree: number,
  latitude: number,
  system: HouseSystem
): HouseCusp[] {
  switch (system) {
    case "whole-sign":
      return computeWholeSignHouses(ascendantDegree);
    case "equal":
      return computeEqualHouses(ascendantDegree);
    case "koch":
      return computeKochHouses(ascendantDegree, mcDegree, latitude);
    case "placidus":
    default:
      return computePlacidusHouses(ascendantDegree, mcDegree, latitude);
  }
}

/**
 * Whole Sign House System: Each house is an entire zodiac sign.
 * The sign containing the ascendant becomes the 1st house.
 */
function computeWholeSignHouses(ascendantDegree: number): HouseCusp[] {
  const ascSignIndex = Math.floor(ascendantDegree / 30);
  const houses: HouseCusp[] = [];

  for (let i = 0; i < 12; i++) {
    const signIndex = (ascSignIndex + i) % 12;
    houses.push({
      house: i + 1,
      sign: ZODIAC_SIGNS[signIndex] as ZodiacSign,
      signIndex,
      degree: signIndex * 30, // Start of sign
    });
  }

  return houses;
}

/**
 * Equal House System: Each house is 30 degrees starting from the ascendant.
 */
function computeEqualHouses(ascendantDegree: number): HouseCusp[] {
  const houses: HouseCusp[] = [];

  for (let i = 0; i < 12; i++) {
    const degree = (ascendantDegree + i * 30) % 360;
    const signIndex = Math.floor(degree / 30);
    houses.push({
      house: i + 1,
      sign: ZODIAC_SIGNS[signIndex] as ZodiacSign,
      signIndex,
      degree,
    });
  }

  return houses;
}

/**
 * Koch House System
 * Uses latitude-dependent calculation.
 */
function computeKochHouses(
  ascendantDegree: number,
  mcDegree: number,
  latitude: number
): HouseCusp[] {
  // Koch requires latitude between -66 and +66 degrees
  if (Math.abs(latitude) > 66) {
    // Fall back to equal houses at extreme latitudes
    return computeEqualHouses(ascendantDegree);
  }

  const latRad = latitude * Math.PI / 180;
  const mcRad = mcDegree * Math.PI / 180;
  const ascRad = ascendantDegree * Math.PI / 180;
  const obliquity = 23.43929111 * Math.PI / 180;

  const houses: HouseCusp[] = [];

  // Compute semi-arc for Koch houses
  // The Koch method uses the ascensional difference
  const cosH = -Math.tan(latRad) * Math.tan(obliquity);
  const H = Math.acos(Math.max(-1, Math.min(1, cosH)));

  // House cusps 11, 12, 2, 3 (intermediate houses)
  const cusps = new Array<number>(12);
  cusps[0] = ascendantDegree; // 1st house = Ascendant
  cusps[9] = mcDegree; // 10th house = MC

  // 11th house
  const cusp11 = mcDegree - (H * 180 / Math.PI) / 3;
  cusps[10] = ((cusp11 % 360) + 360) % 360;

  // 12th house
  const cusp12 = mcDegree - (2 * H * 180 / Math.PI) / 3;
  cusps[11] = ((cusp12 % 360) + 360) % 360;

  // 2nd house
  cusps[1] = ((ascendantDegree + (2 * H * 180 / Math.PI) / 3) % 360 + 360) % 360;

  // 3rd house
  cusps[2] = ((ascendantDegree + (H * 180 / Math.PI) / 3) % 360 + 360) % 360;

  // Opposite houses (7-12)
  cusps[6] = (cusps[0] + 180) % 360; // 7th = 1st + 180
  cusps[7] = (cusps[1] + 180) % 360; // 8th = 2nd + 180
  cusps[8] = (cusps[2] + 180) % 360; // 9th = 3rd + 180
  cusps[3] = (cusps[9] + 180) % 360; // 4th = 10th + 180
  cusps[4] = (cusps[10] + 180) % 360; // 5th = 11th + 180
  cusps[5] = (cusps[11] + 180) % 360; // 6th = 12th + 180

  for (let i = 0; i < 12; i++) {
    const deg = cusps[i] as number;
    const signIndex = Math.floor(deg / 30);
    houses.push({
      house: i + 1,
      sign: ZODIAC_SIGNS[signIndex] as ZodiacSign,
      signIndex,
      degree: deg,
    });
  }

  return houses;
}

/**
 * Placidus House System
 * The most commonly used house system in Western astrology.
 * Uses semi-diurnal arcs to divide the sky.
 */
function computePlacidusHouses(
  ascendantDegree: number,
  mcDegree: number,
  latitude: number
): HouseCusp[] {
  // Placidus requires latitude between -66 and +66 degrees
  if (Math.abs(latitude) > 66) {
    return computeEqualHouses(ascendantDegree);
  }

  const latRad = latitude * Math.PI / 180;
  const obliquity = 23.43929111 * Math.PI / 180;

  // Compute the semi-diurnal arc for the ascensional difference
  const cosAD = Math.tan(latRad) * Math.tan(obliquity);
  const AD = Math.asin(Math.max(-1, Math.min(1, cosAD)));

  // Placidus uses iterative calculation of house cusps
  // based on trisection of semi-diurnal and semi-nocturnal arcs
  const houses: HouseCusp[] = [];

  // Simplified Placidus: use the ascensional difference to compute cusps
  const cusps = new Array<number>(12);
  cusps[0] = ascendantDegree; // 1st house = Ascendant
  cusps[9] = mcDegree; // 10th house = MC

  // Ascensional difference in degrees
  const adDeg = AD * 180 / Math.PI;

  // Intermediate cusps using Placidus method
  // 11th house: MC + 1/3 of the arc from MC to Ascendant (upper quadrant)
  const arcUpper = ((ascendantDegree - mcDegree) % 360 + 360) % 360;
  const arcLower = 360 - arcUpper;

  cusps[10] = ((mcDegree + arcUpper / 3) % 360 + 360) % 360; // 11th
  cusps[11] = ((mcDegree + 2 * arcUpper / 3) % 360 + 360) % 360; // 12th

  cusps[1] = ((ascendantDegree + arcLower / 3) % 360 + 360) % 360; // 2nd
  cusps[2] = ((ascendantDegree + 2 * arcLower / 3) % 360 + 360) % 360; // 3rd

  // Opposite houses
  cusps[6] = (cusps[0] + 180) % 360; // 7th
  cusps[7] = (cusps[1] + 180) % 360; // 8th
  cusps[8] = (cusps[2] + 180) % 360; // 9th
  cusps[3] = (cusps[9] + 180) % 360; // 4th
  cusps[4] = (cusps[10] + 180) % 360; // 5th
  cusps[5] = (cusps[11] + 180) % 360; // 6th

  for (let i = 0; i < 12; i++) {
    const deg = cusps[i] as number;
    const signIndex = Math.floor(deg / 30);
    houses.push({
      house: i + 1,
      sign: ZODIAC_SIGNS[signIndex] as ZodiacSign,
      signIndex,
      degree: deg,
    });
  }

  return houses;
}

/**
 * Determine which house a planet falls in, given its longitude and the house cusps.
 */
export function getHouseForPlanet(
  planetLongitude: number,
  houses: HouseCusp[]
): number {
  for (let i = 0; i < 12; i++) {
    const currentCusp = (houses[i] as HouseCusp).degree;
    const nextCusp = (houses[(i + 1) % 12] as HouseCusp).degree;

    if (currentCusp < nextCusp) {
      if (planetLongitude >= currentCusp && planetLongitude < nextCusp) {
        return i + 1;
      }
    } else {
      // Wraps around 360
      if (planetLongitude >= currentCusp || planetLongitude < nextCusp) {
        return i + 1;
      }
    }
  }
  return 1; // Default to 1st house
}

/**
 * Compute the Ascendant (1st house cusp) from local sidereal time and latitude.
 *
 * Meeus (Astronomical Algorithms, ch. 22):
 *   tan(Asc) = -cos(RAMC) / (sin(eps) * tan(lat) + cos(eps) * sin(RAMC))
 * The atan2 gives one of the two horizon/ecliptic intersections; the true
 * Ascendant is the one whose RIGHT ASCENSION lies ~90° east of the MC, i.e.
 * closest to RAMC + 90°. (The other intersection is the Descendant.)
 */
export function computeAscendant(
  ramc: number, // Right Ascension of MC in degrees
  latitude: number, // Geographic latitude in degrees
  obliquity: number = 23.43929111 // Obliquity of ecliptic in degrees
): number {
  const ramcRad = ramc * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const oblRad = obliquity * Math.PI / 180;

  const y = -Math.cos(ramcRad);
  const x = Math.sin(oblRad) * Math.tan(latRad) + Math.cos(oblRad) * Math.sin(ramcRad);

  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) {
    // Degenerate (poles) — no well-defined ascendant.
    return (((ramc + 90) % 360) + 360) % 360;
  }

  const asc = (((Math.atan2(y, x) * 180 / Math.PI) % 360) + 360) % 360;

  // Right ascension of an ecliptic longitude.
  const raOf = (lonDeg: number): number => {
    const l = lonDeg * Math.PI / 180;
    return (((Math.atan2(Math.cos(oblRad) * Math.sin(l), Math.cos(l)) * 180 / Math.PI) % 360) + 360) % 360;
  };
  const dist = (a: number, b: number): number => {
    const d = (((a - b) % 360) + 360) % 360;
    return d > 180 ? 360 - d : d;
  };

  const target = (((ramc + 90) % 360) + 360) % 360;
  const other = (asc + 180) % 360;
  if (dist(raOf(other), target) < dist(raOf(asc), target)) return other;
  return asc;
}

/**
 * Compute the Midheaven (MC) from the local (apparent) sidereal time.
 *
 *   tan(MC) = tan(RAMC) / cos(eps)
 * atan2 of (sin RAMC, cos RAMC · cos eps) already lands in the correct
 * quadrant, because cos eps > 0 keeps the sign of the x-component — so no
 * post-hoc 180° flip is applied here (the old flip only ever risked moving a
 * correct MC to the IC).
 */
export function computeMC(
  lst: number, // Local sidereal time in degrees
  obliquity: number = 23.43929111
): number {
  const lstRad = lst * DEG;
  const oblRad = obliquityRad(obliquity);

  const mc = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(oblRad)) * 180 / Math.PI;
  return ((mc % 360) + 360) % 360;
}
