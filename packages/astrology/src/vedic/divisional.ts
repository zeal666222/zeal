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
 * Uses the Parashara method with correct counting rules for each varga.
 *
 * Reference: Parashara Hora Shastra, Chapter 3 (Shodashavarga)
 * Each varga has specific counting rules based on sign type (movable/fixed/dual).
 */
export function computeDivisionalLongitude(rashiLongitude: number, division: number): number {
  const normalizedLon = ((rashiLongitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLon / 30);
  const degreesInSign = normalizedLon - signIndex * 30;

  // Each division divides the 30-degree sign into `division` equal parts
  const partSize = 30 / division;
  const partIndex = Math.floor(degreesInSign / partSize);

  // Sign type classification
  const isMovable = [0, 3, 6, 9].includes(signIndex); // Ar, Cn, Li, Cp
  const isFixed = [1, 4, 7, 10].includes(signIndex);  // Ta, Le, Sc, Aq
  const isDual = [2, 5, 8, 11].includes(signIndex);   // Ge, Vi, Sg, Pi

  let divSignIndex: number;

  if (division === 2) {
    // Hora (D2): 15° halves
    // Odd signs (Ar, Ge, Le, Li, Sg, Aq): 1st half = Leo (Sun), 2nd half = Cancer (Moon)
    // Even signs (Ta, Cn, Vi, Sc, Cp, Pi): 1st half = Cancer (Moon), 2nd half = Leo (Sun)
    if (signIndex % 2 === 0) {
      // Odd sign
      divSignIndex = partIndex === 0 ? 4 : 3; // Leo, then Cancer
    } else {
      // Even sign
      divSignIndex = partIndex === 0 ? 3 : 4; // Cancer, then Leo
    }
  } else if (division === 3) {
    // Drekkana (D3): 10° thirds
    // All signs: own sign, 5th, 9th (step of 4)
    divSignIndex = (signIndex + partIndex * 4) % 12;
  } else if (division === 4) {
    // Chaturthamsa (D4): 7.5° quarters
    // Movable: own, 4th, 7th, 10th (step of 3)
    // Fixed: 4th, 7th, 10th, own (step of 3, starting from 4th)
    // Dual: 7th, 10th, own, 4th (step of 3, starting from 7th)
    if (isMovable) {
      divSignIndex = (signIndex + partIndex * 3) % 12;
    } else if (isFixed) {
      divSignIndex = (signIndex + 3 + partIndex * 3) % 12;
    } else {
      divSignIndex = (signIndex + 6 + partIndex * 3) % 12;
    }
  } else if (division === 5) {
    // Panchamsa (D5): 6° fifths
    // Movable: same sign repeated (all 5 parts in own sign)
    // Fixed: 5th, 9th, own, 5th, 9th (step of 4, starting from 5th)
    // Dual: 9th, 5th, own, 9th, 5th (step of 8, starting from 9th)
    if (isMovable) {
      divSignIndex = signIndex;
    } else if (isFixed) {
      divSignIndex = (signIndex + 4 + partIndex * 4) % 12;
    } else {
      divSignIndex = (signIndex + 8 + partIndex * 8) % 12;
    }
  } else if (division === 6) {
    // Shashthamsa (D6): 5° sixths
    // All signs: 6th from sign repeated (step of 5, but all in 6th house)
    // Actually: each part is in the 6th sign from the original
    divSignIndex = (signIndex + 5) % 12;
  } else if (division === 7) {
    // Saptamsa (D7): ~4.28° sevenths
    // Movable: own, 7th, own, 7th, own, 7th, own (alternating)
    // Fixed: 7th, own, 7th, own, 7th, own, 7th (alternating, starting from 7th)
    // Dual: own, 7th, own, 7th, own, 7th, own (same as movable)
    if (partIndex % 2 === 0) {
      divSignIndex = isFixed ? (signIndex + 6) % 12 : signIndex;
    } else {
      divSignIndex = isFixed ? signIndex : (signIndex + 6) % 12;
    }
  } else if (division === 8) {
    // Ashtamsa (D8): 3.75° eighths
    // All signs: 8th from sign repeated (step of 7)
    divSignIndex = (signIndex + 7) % 12;
  } else if (division === 9) {
    // Navamsa (D9): 3.33° ninths
    // Movable: own, 5th, 9th, own, 5th, 9th, own, 5th, 9th (step of 4)
    // Fixed: 9th, 5th, own, 9th, 5th, own, 9th, 5th, own (step of 8, starting from 9th)
    // Dual: 5th, 9th, own, 5th, 9th, own, 5th, 9th, own (step of 4, starting from 5th)
    if (isMovable) {
      divSignIndex = (signIndex + partIndex * 4) % 12;
    } else if (isFixed) {
      divSignIndex = (signIndex + 8 + partIndex * 8) % 12;
    } else {
      divSignIndex = (signIndex + 4 + partIndex * 4) % 12;
    }
  } else if (division === 10) {
    // Dasamsa (D10): 3° tenths
    // Movable: own, 10th, own, 10th, ... (alternating, step of 9)
    // Fixed: 10th, own, 10th, own, ... (alternating, starting from 10th)
    // Dual: own, 10th, own, 10th, ... (same as movable)
    if (partIndex % 2 === 0) {
      divSignIndex = isFixed ? (signIndex + 9) % 12 : signIndex;
    } else {
      divSignIndex = isFixed ? signIndex : (signIndex + 9) % 12;
    }
  } else if (division === 11) {
    // Rudramsha (D11): ~2.73° elevenths
    // All signs: 11th from sign repeated (step of 10)
    divSignIndex = (signIndex + 10) % 12;
  } else if (division === 12) {
    // Dwadashamsa (D12): 2.5° twelfths
    // Movable: own, 12th, own, 12th, ... (alternating, step of 11)
    // Fixed: 12th, own, 12th, own, ... (alternating, starting from 12th)
    // Dual: own, 12th, own, 12th, ... (same as movable)
    if (partIndex % 2 === 0) {
      divSignIndex = isFixed ? (signIndex + 11) % 12 : signIndex;
    } else {
      divSignIndex = isFixed ? signIndex : (signIndex + 11) % 12;
    }
  } else {
    // Generalized scheme for higher divisional charts (D16, D20, D24, D27, D30, D40, D45, D60)
    // Uses the standard Parashara formula: sign × division + partIndex
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
