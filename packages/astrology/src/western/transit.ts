// ============================================================================
// Western Transit Chart
// ============================================================================
// Computes current planetary positions and their aspects to a natal chart.
// ============================================================================

import type { BirthData, TransitData, TransitAspect, PlanetPosition, AspectType } from "../types";
import { WESTERN_PLANETS } from "../types";
import { getWesternPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { degreesToSignDeg } from "../vedic/rashi";
import { computeWesternNatalChart } from "./natal";
import { angularDistance } from "../utils/aspects";
import type { Aspect } from "../types";

/** Western aspect definitions with orbs */
const WESTERN_ASPECT_ANGLES: Array<{ type: AspectType; angle: number; orb: number }> = [
  { type: "conjunction", angle: 0, orb: 8 },
  { type: "opposition", angle: 180, orb: 8 },
  { type: "trine", angle: 120, orb: 7 },
  { type: "square", angle: 90, orb: 7 },
  { type: "sextile", angle: 60, orb: 5 },
];

/**
 * Compute Western transits for a given date relative to a natal chart.
 */
export function computeWesternTransit(birthData: BirthData, transitDate: string): TransitData {
  const natalChart = computeWesternNatalChart(birthData);

  // Compute transit positions
  const dateTime = new Date(`${transitDate}T12:00:00Z`);
  const time = getAstroTime(dateTime);
  const transitStates = getWesternPlanetPositions(time);

  // Build transit planet positions
  const transitPlanets: PlanetPosition[] = [];
  for (const planetName of WESTERN_PLANETS) {
    const state = transitStates.get(planetName);
    if (!state) continue;

    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(state.longitude);

    transitPlanets.push({
      planet: planetName,
      sign,
      signIndex,
      degree,
      minute,
      second,
      absoluteDegree: state.longitude,
      house: 0,
      isRetrograde: state.isRetrograde,
    });
  }

  // Compute aspects between transit and natal planets
  const aspects: TransitAspect[] = [];
  for (const tp of transitPlanets) {
    for (const np of natalChart.planets) {
      const diff = angularDistance(tp.absoluteDegree, np.absoluteDegree);

      for (const aspectDef of WESTERN_ASPECT_ANGLES) {
        const orbDiff = Math.abs(diff - aspectDef.angle);
        if (orbDiff <= aspectDef.orb) {
          aspects.push({
            transitPlanet: tp.planet,
            natalPlanet: np.planet,
            aspectType: aspectDef.type,
            orb: Math.round(orbDiff * 100) / 100,
            exact: orbDiff < 0.5,
          });
          break; // Only one aspect per planet pair
        }
      }
    }
  }

  return {
    transitDate,
    transitPlanets,
    aspects,
  };
}
