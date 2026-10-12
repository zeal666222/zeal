// ============================================================================
// Ashtakavarga - Eight-fold Strength Matrix
// ============================================================================
// Computes the Ashtakavarga system: a point-based system where each planet
// contributes "bindus" (dots/points) to each sign based on its position
// relative to other planets.
// ============================================================================

import type { BirthData, AshtakavargaResult, AshtakavargaRow, PlanetName } from "../types";
import { computeRashiChart, parseBirthDateTime } from "./rashi";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";

/**
 * Compute the Bhinnashtakavarga (individual) for a planet.
 * Each planet contributes bindus to signs based on specific rules.
 *
 * This is a simplified implementation. The full computation involves
 * checking each planet's position relative to every other planet's
 * position and counting favorable placements.
 */
function computePlanetAshtakavarga(planet: PlanetName, planetSignIndex: number, allPlanetSigns: Map<PlanetName, number>): number[] {
  const bindus = new Array(12).fill(0);

  // Simplified: assign bindus based on traditional rules
  // Each planet gives 1 bindu to certain signs from its own position
  // The total bindus per planet across all signs should be 25-30

  // For Sun: gives bindus to specific signs counted from its position
  const sunFavorableSigns = [0, 1, 2, 5, 7, 8, 10, 11]; // Simplified
  const moonFavorableSigns = [2, 3, 5, 6, 8, 10, 11];
  const marsFavorableSigns = [2, 3, 5, 6, 10, 11];
  const mercuryFavorableSigns = [0, 1, 3, 4, 5, 7, 8, 10, 11];
  const jupiterFavorableSigns = [1, 2, 4, 5, 7, 8, 10, 11];
  const venusFavorableSigns = [0, 1, 2, 3, 5, 6, 8, 9, 10, 11];
  const saturnFavorableSigns = [2, 3, 5, 6, 10, 11];

  let favorableSigns: number[];
  switch (planet) {
    case "Sun": favorableSigns = sunFavorableSigns; break;
    case "Moon": favorableSigns = moonFavorableSigns; break;
    case "Mars": favorableSigns = marsFavorableSigns; break;
    case "Mercury": favorableSigns = mercuryFavorableSigns; break;
    case "Jupiter": favorableSigns = jupiterFavorableSigns; break;
    case "Venus": favorableSigns = venusFavorableSigns; break;
    case "Saturn": favorableSigns = saturnFavorableSigns; break;
    default: return bindus;
  }

  // For each favorable sign offset, add 1 bindu to the corresponding sign
  for (const offset of favorableSigns) {
    const targetSign = (planetSignIndex + offset) % 12;
    bindus[targetSign] = (bindus[targetSign] ?? 0) + 1;
  }

  return bindus;
}

/**
 * Compute the full Ashtakavarga for a natal chart.
 */
export function computeAshtakavarga(birthData: BirthData): AshtakavargaResult {
  const chart = computeRashiChart(birthData);

  // Build map of planet -> sign index
  const planetSigns = new Map<PlanetName, number>();
  for (const planet of chart.planets) {
    planetSigns.set(planet.planet as PlanetName, planet.signIndex);
  }

  const individual: AshtakavargaRow[] = [];
  const sarvashtakavarga = new Array(12).fill(0);

  const mainPlanets: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

  for (const planet of mainPlanets) {
    const signIndex = planetSigns.get(planet);
    if (signIndex === undefined) continue;

    const bindus = computePlanetAshtakavarga(planet, signIndex, planetSigns);
    const total = bindus.reduce((sum, b) => sum + b, 0);

    individual.push({
      planet,
      signs: bindus,
      total,
    });

    // Add to Sarvashtakavarga (sum of all planets' bindus)
    for (let i = 0; i < 12; i++) {
      sarvashtakavarga[i] = (sarvashtakavarga[i] ?? 0) + (bindus[i] ?? 0);
    }
  }

  return {
    individual,
    sarvashtakavarga,
  };
}
