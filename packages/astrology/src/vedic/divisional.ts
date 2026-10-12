// ============================================================================
// Divisional Charts (D2-D60) - Varga Charts
// ============================================================================
// Generic algorithm for computing all 16 traditional divisional charts.
// Each chart divides the zodiac differently to reveal specific life areas.
// ============================================================================

import type { BirthData, DivisionalChart, PlanetPosition, HouseCusp } from "../types";
import { VEDIC_PLANETS } from "../types";
import { computeRashiChart, degreesToSignDeg, getNakshatra, parseBirthDateTime } from "./rashi";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { computeHouses, getHouseForPlanet, computeMC, computeLST } from "../utils/houses";
import { computeNavamsaChart } from "./navamsa";

/** Divisional chart names and their significations */
export const DIVISIONAL_CHARTS: Record<number, { name: string; signification: string }> = {
  1: { name: "Rashi", signification: "General life, body, personality" },
  2: { name: "Hora", signification: "Wealth, family" },
  3: { name: "Drekkana", signification: "Siblings, courage" },
  4: { name: "Chaturthamsa", signification: "Fortune, education, property" },
  5: { name: "Panchamsa", signification: "Children, creativity" },
  6: { name: "Shashthamsa", signification: "Enemies, diseases" },
  7: { name: "Saptamsa", signification: "Children, progeny" },
  8: { name: "Ashtamsa", signification: "Longevity, misfortune" },
  9: { name: "Navamsa", signification: "Marriage, dharma, fortune" },
  10: { name: "Dasamsa", signification: "Career, profession" },
  11: { name: "Rudramsha", signification: "Death, transformation" },
  12: { name: "Dwadashamsa", signification: "Parents, ancestors" },
  16: { name: "Shodasamsa", signification: "Vehicles, comforts" },
  20: { name: "Vimsamsa", signification: "Spiritual evolution" },
  24: { name: "Chaturvimsamsa", signification: "Education, learning" },
  27: { name: "Bhamsa", signification: "Weaknesses, strengths" },
  30: { name: "Trimsamsa", signification: "Evils, misfortunes" },
  40: { name: "Khavedamsa", signification: "Maternal heritage" },
  45: { name: "Akshavedamsa", signification: "Paternal heritage" },
  60: { name: "Shashtiamsa", signification: "Past life karma" },
};

/**
 * Compute the divisional longitude for a given division number.
 * Uses the Parashara method for divisional charts.
 */
export function computeDivisionalLongitude(rashiLongitude: number, division: number): number {
  const normalizedLon = ((rashiLongitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLon / 30);
  const degreesInSign = normalizedLon - signIndex * 30;

  // Each division divides the 30-degree sign into `division` equal parts
  const partSize = 30 / division;
  const partIndex = Math.floor(degreesInSign / partSize);

  // The divisional sign depends on the type of division
  // For odd divisions: count from the sign itself
  // For even divisions: different counting rules apply
  let divSignIndex: number;

  if (division === 2) {
    // Hora: Odd signs -> Sun's signs (Leo, Cancer alternating)
    // Even signs -> reverse
    if (signIndex % 2 === 0) {
      divSignIndex = partIndex === 0 ? 4 : 3; // Leo or Cancer
    } else {
      divSignIndex = partIndex === 0 ? 3 : 4; // Cancer or Leo
    }
  } else if (division === 3) {
    // Drekkana: Count from the sign itself
    divSignIndex = (signIndex + partIndex) % 12;
  } else {
    // General method for other divisions
    divSignIndex = (signIndex * division + partIndex) % 12;
  }

  // Position within the divisional sign
  const positionInPart = degreesInSign % partSize;
  const divLongitude = divSignIndex * 30 + (positionInPart * division);

  return divLongitude % 360;
}

/**
 * Compute any divisional chart (D1-D60).
 */
export function computeDivisionalChart(
  birthData: BirthData,
  division: number
): DivisionalChart {
  if (division === 1) {
    // D1 is the Rashi chart itself
    const rashi = computeRashiChart(birthData);
    return {
      ...rashi,
      divisionalNumber: 1,
      divisionalName: "Rashi",
    };
  }

  if (division === 9) {
    // D9 has its own optimized implementation
    return computeNavamsaChart(birthData);
  }

  const dateTime = parseBirthDateTime(birthData);
  const time = getAstroTime(dateTime);
  const ayanamsa = getAyanamsa(time, "lahiri");

  // Get planet positions (sidereal)
  const planetStates = getVedicPlanetPositions(time, ayanamsa);

  // Compute divisional positions for each planet
  const planets: PlanetPosition[] = [];
  for (const planetName of VEDIC_PLANETS) {
    const state = planetStates.get(planetName);
    if (!state) continue;

    const divLon = computeDivisionalLongitude(state.longitude, division);
    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(divLon);
    const nakshatraData = getNakshatra(divLon);

    planets.push({
      planet: planetName,
      sign,
      signIndex,
      degree,
      minute,
      second,
      absoluteDegree: divLon,
      house: 0,
      isRetrograde: state.isRetrograde,
      nakshatra: nakshatraData.name,
      nakshatraPada: nakshatraData.pada,
      nakshatraLord: nakshatraData.lord,
    });
  }

  // Compute houses
  const lst = computeLST(dateTime, birthData.birthPlace.lng);
  const mcDegree = computeMC(lst);
  const mcSidereal = ((mcDegree - ayanamsa) % 360 + 360) % 360;

  // Get the rashi chart ascendant for the divisional ascendant
  const rashiChart = computeRashiChart(birthData);
  const rashiAscLon = rashiChart.ascendant.degree;
  const divAscLon = computeDivisionalLongitude(rashiAscLon, division);

  const houses = computeHouses(divAscLon, mcSidereal, birthData.birthPlace.lat, "whole-sign");

  // Assign houses to planets
  for (const planet of planets) {
    planet.house = getHouseForPlanet(planet.absoluteDegree, houses);
  }

  const ascData = degreesToSignDeg(divAscLon);
  const ascendant: HouseCusp = {
    house: 1,
    sign: ascData.sign,
    signIndex: ascData.signIndex,
    degree: divAscLon,
  };

  const chartInfo = DIVISIONAL_CHARTS[division] ?? { name: `D${division}`, signification: "Unknown" };

  return {
    type: "vedic",
    chartName: `${chartInfo.name} (D${division})`,
    birthData,
    planets,
    houses,
    ascendant,
    ayanamsa,
    computedAt: new Date().toISOString(),
    divisionalNumber: division,
    divisionalName: chartInfo.name,
  };
}
