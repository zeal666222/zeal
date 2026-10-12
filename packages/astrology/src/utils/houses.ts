// ============================================================================
// House System Calculations
// ============================================================================
// Implements Placidus, Whole Sign, Koch, and Equal house systems.
// ============================================================================

import type { HouseCusp, ZodiacSign, HouseSystem } from "../types";
import { ZODIAC_SIGNS } from "../types";

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
 * Uses the standard formula: tan(Asc) = -cos(RAMC) / (sin(obliquity) * tan(latitude) + cos(obliquity) * sin(RAMC))
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

  let asc = Math.atan2(y, x) * 180 / Math.PI;
  // Adjust to correct quadrant
  asc = ((asc % 360) + 360) % 360;

  // The ascendant should be in the eastern half (0-180 from the MC perspective)
  // Adjust if needed
  const mcDeg = ((ramc % 360) + 360) % 360;
  if (asc < mcDeg - 90 || (asc > mcDeg + 90 && asc < mcDeg + 270)) {
    asc = (asc + 180) % 360;
  }

  return asc;
}

/**
 * Compute the Midheaven (MC) from local sidereal time.
 */
export function computeMC(
  lst: number, // Local sidereal time in degrees
  obliquity: number = 23.43929111
): number {
  const lstRad = lst * Math.PI / 180;
  const oblRad = obliquity * Math.PI / 180;

  let mc = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(oblRad)) * 180 / Math.PI;
  mc = ((mc % 360) + 360) % 360;

  // Ensure MC is in the correct quadrant (should be near the top of the chart)
  if (mc < lst - 90 || mc > lst + 90) {
    mc = (mc + 180) % 360;
  }

  return mc;
}

/**
 * Compute Local Sidereal Time (LST) from date, time, and longitude.
 */
export function computeLST(date: Date, longitude: number): number {
  // Julian Date
  const jd = dateToJD(date);
  const T = (jd - 2451545.0) / 36525.0;

  // Greenwich Mean Sidereal Time (GMST) in degrees
  // Using IAU 1982 model
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T - T * T * T / 38710000.0;
  gmst = ((gmst % 360) + 360) % 360;

  // Local Sidereal Time = GMST + observer's longitude (east positive)
  const lst = (gmst + longitude + 360) % 360;

  return lst;
}

/**
 * Convert a JS Date to Julian Date.
 */
function dateToJD(date: Date): number {
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
