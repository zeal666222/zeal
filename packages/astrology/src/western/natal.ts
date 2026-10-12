// ============================================================================
// Western Natal Chart
// ============================================================================
// Computes a tropical natal chart with planets, houses, and aspects.
// Supports Placidus, Whole Sign, Koch, and Equal house systems.
// ============================================================================

import * as Astronomy from "astronomy-engine";
import type {
  BirthData, WesternNatalChart, PlanetPosition, HouseCusp,
  Aspect, HouseSystem, WesternPlanet, ZodiacSign,
} from "../types";
import { ZODIAC_SIGNS, WESTERN_PLANETS } from "../types";
import { getWesternPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { computeHouses, getHouseForPlanet, computeAscendant, computeMC, computeLST } from "../utils/houses";
import { computeAllAspects } from "../utils/aspects";
import { degreesToSignDeg, getNakshatra } from "../vedic/rashi";

/**
 * Compute a Western tropical natal chart.
 */
export function computeWesternNatalChart(
  birthData: BirthData,
  houseSystem: HouseSystem = "placidus"
): WesternNatalChart {
  const dateTime = parseWesternBirthDateTime(birthData);
  const time = getAstroTime(dateTime);

  // Compute Local Sidereal Time
  const lst = computeLST(dateTime, birthData.birthPlace.lng);

  // Compute MC and Ascendant (tropical, no ayanamsa correction)
  const mcDegree = computeMC(lst);
  const ascDegree = computeAscendant(lst, birthData.birthPlace.lat);

  // Compute houses
  const houses = computeHouses(ascDegree, mcDegree, birthData.birthPlace.lat, houseSystem);

  // Get tropical planet positions
  const planetStates = getWesternPlanetPositions(time);

  // Build planet positions array
  const planets: PlanetPosition[] = [];
  for (const planetName of WESTERN_PLANETS) {
    const state = planetStates.get(planetName);
    if (!state) continue;

    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(state.longitude);
    const house = getHouseForPlanet(state.longitude, houses);

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
    });
  }

  // Compute aspects between all planets
  const planetData = planets.map(p => ({ name: p.planet, longitude: p.absoluteDegree }));
  const aspects = computeAllAspects(planetData);

  // Build ascendant
  const ascData = degreesToSignDeg(ascDegree);
  const ascendant: HouseCusp = {
    house: 1,
    sign: ascData.sign,
    signIndex: ascData.signIndex,
    degree: ascDegree,
  };

  return {
    type: "western",
    chartName: "Natal Chart",
    birthData,
    planets,
    houses,
    ascendant,
    aspects,
    houseSystem,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Parse birth date/time for Western charts.
 * Uses UTC by default (timezone handling should be added for production).
 */
function parseWesternBirthDateTime(birthData: BirthData): Date {
  const [year, month, day] = birthData.birthDate.split("-").map(Number);
  const [hours, minutes] = birthData.birthTime.split(":").map(Number);

  if (!year || !month || !day || hours === undefined || minutes === undefined) {
    throw new Error("Invalid birth date or time format. Use YYYY-MM-DD and HH:MM");
  }

  // For Western astrology, we need proper timezone handling
  // For now, assume UTC (in production, use the timezone field)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}
