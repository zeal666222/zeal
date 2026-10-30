// ============================================================================
// Navamsa Chart (D9) - Divisional Chart for Marriage & Dharma
// ============================================================================
// The Navamsa divides each 30-degree sign into 9 parts of 3°20' each.
// It is the most important divisional chart in Vedic astrology.
// ============================================================================

import type { BirthData, DivisionalChart, PlanetPosition, HouseCusp } from "../types";
import { ZODIAC_SIGNS } from "../types";
import { computeRashiChart, degreesToSignDeg, getNakshatra } from "./rashi";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { computeHouses, getHouseForPlanet, computeMC, computeAscendant, computeLST, apparentObliquity, toJulianDate } from "../utils/houses";
import { parseBirthDateTime } from "./rashi";
import { VEDIC_PLANETS } from "../types";

/**
 * Compute the Navamsa (D9) longitude from a planet's Rashi longitude.
 * Each sign (30 degrees) is divided into 9 parts of 3°20' (3.3333 degrees).
 * The Navamsa sign is determined by the fire/earth/air/water element pattern.
 */
export function computeNavamsaLongitude(rashiLongitude: number): number {
  const normalizedLon = ((rashiLongitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLon / 30);
  const degreesInSign = normalizedLon - signIndex * 30;

  // Which navamsa part (0-8) within the sign
  const navamsaPart = Math.floor(degreesInSign / (30 / 9));

  // Navamsa starting sign based on the element of the rashi sign
  // Fire signs (Aries, Leo, Sagittarius): Navamsa starts from Aries
  // Earth signs (Taurus, Virgo, Capricorn): Navamsa starts from Capricorn
  // Air signs (Gemini, Libra, Aquarius): Navamsa starts from Libra
  // Water signs (Cancer, Scorpio, Pisces): Navamsa starts from Cancer
  let navamsaStartSign: number;
  switch (signIndex % 4) {
    case 0: // Fire (Aries=0, Leo=4, Sag=8 -> 0%4=0)
      navamsaStartSign = 0; // Aries
      break;
    case 1: // Earth (Taurus=1, Virgo=5, Cap=10 -> 1%4=1)
      navamsaStartSign = 9; // Capricorn
      break;
    case 2: // Air (Gemini=2, Libra=6, Aqu=10 -> 2%4=2)
      navamsaStartSign = 6; // Libra
      break;
    case 3: // Water (Cancer=3, Scorpio=7, Pisces=11 -> 3%4=3)
      navamsaStartSign = 3; // Cancer
      break;
    default:
      navamsaStartSign = 0;
  }

  // The navamsa sign = starting sign + navamsa part
  const navamsaSignIndex = (navamsaStartSign + navamsaPart) % 12;

  // Position within the navamsa sign
  const positionInNavamsa = degreesInSign % (30 / 9);
  const navamsaLongitude = navamsaSignIndex * 30 + positionInNavamsa * 9;

  return navamsaLongitude % 360;
}

/**
 * Compute the Navamsa (D9) chart.
 */
export function computeNavamsaChart(birthData: BirthData): DivisionalChart {
  // First compute the Rashi chart to get the base positions
  const rashiChart = computeRashiChart(birthData);

  const dateTime = parseBirthDateTime(birthData);
  const time = getAstroTime(dateTime);
  const ayanamsa = getAyanamsa(time, "lahiri");

  // Get tropical planet positions and convert to sidereal
  const planetStates = getVedicPlanetPositions(time, ayanamsa);

  // Compute navamsa positions for each planet
  const planets: PlanetPosition[] = [];
  for (const planetName of VEDIC_PLANETS) {
    const state = planetStates.get(planetName);
    if (!state) continue;

    const navamsaLon = computeNavamsaLongitude(state.longitude);
    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(navamsaLon);
    const nakshatraData = getNakshatra(navamsaLon);

    planets.push({
      planet: planetName,
      sign,
      signIndex,
      degree,
      minute,
      second,
      absoluteDegree: navamsaLon,
      house: 0, // Will be computed after houses
      isRetrograde: state.isRetrograde,
      nakshatra: nakshatraData.name,
      nakshatraPada: nakshatraData.pada,
      nakshatraLord: nakshatraData.lord,
    });
  }

  // Compute LST and houses for navamsa
  const lst = computeLST(dateTime, birthData.birthPlace.lng);
  const mcDegree = computeMC(lst, apparentObliquity(toJulianDate(dateTime)));
  const mcSidereal = ((mcDegree - ayanamsa) % 360 + 360) % 360;

  // Navamsa ascendant: compute from the rashi ascendant's navamsa position
  const rashiAscLon = rashiChart.ascendant.degree;
  const navamsaAscLon = computeNavamsaLongitude(rashiAscLon);
  const navamsaAscSignIndex = Math.floor(navamsaAscLon / 30);

  // Houses for navamsa use Whole Sign from the navamsa ascendant sign
  const houses = computeHouses(navamsaAscLon, mcSidereal, birthData.birthPlace.lat, "whole-sign");

  // Assign houses to planets
  for (const planet of planets) {
    planet.house = getHouseForPlanet(planet.absoluteDegree, houses);
  }

  const ascData = degreesToSignDeg(navamsaAscLon);
  const ascendant: HouseCusp = {
    house: 1,
    sign: ascData.sign,
    signIndex: ascData.signIndex,
    degree: navamsaAscLon,
  };

  return {
    type: "vedic",
    chartName: "Navamsa (D9)",
    birthData,
    planets,
    houses,
    ascendant,
    ayanamsa,
    computedAt: new Date().toISOString(),
    divisionalNumber: 9,
    divisionalName: "Navamsa",
  };
}
