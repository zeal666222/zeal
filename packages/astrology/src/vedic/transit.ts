// ============================================================================
// Gochara (Transit) - Current Transits Relative to Natal Chart
// ============================================================================
// Computes the current planetary positions and their aspects to natal planets.
// ============================================================================

import type { BirthData, TransitData, TransitAspect, PlanetPosition, PlanetName } from "../types";
import { ZODIAC_SIGNS } from "../types";
import { computeRashiChart, degreesToSignDeg, getNakshatra, parseBirthDateTime } from "./rashi";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { computeHouses, getHouseForPlanet } from "../utils/houses";
import type { AspectType } from "../types";

/** Vedic aspect rules: each planet aspects specific houses from itself */
const VEDIC_ASPECTS: Record<PlanetName, number[]> = {
  Sun: [7], // 7th house
  Moon: [7],
  Mars: [4, 7, 8], // Special: 4th, 7th, 8th
  Mercury: [7],
  Jupiter: [5, 7, 9], // Special: 5th, 7th, 9th
  Venus: [7],
  Saturn: [3, 7, 10], // Special: 3rd, 7th, 10th
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
};

/**
 * Compute transit data for a given date relative to a natal chart.
 */
export function computeTransit(birthData: BirthData, transitDate: string): TransitData {
  // Compute natal chart
  const natalChart = computeRashiChart(birthData);

  // Compute transit positions
  const dateTime = new Date(`${transitDate}T12:00:00Z`);
  const time = getAstroTime(dateTime);
  const ayanamsa = getAyanamsa(time, "lahiri");
  const transitStates = getVedicPlanetPositions(time, ayanamsa);

  // Build transit planet positions
  const transitPlanets: PlanetPosition[] = [];
  for (const [planetName, state] of transitStates) {
    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(state.longitude);
    const nakshatraData = getNakshatra(state.longitude);

    transitPlanets.push({
      planet: planetName,
      sign,
      signIndex,
      degree,
      minute,
      second,
      absoluteDegree: state.longitude,
      house: 0, // Transit houses computed relative to natal ascendant
      isRetrograde: state.isRetrograde,
      nakshatra: nakshatraData.name,
      nakshatraPada: nakshatraData.pada,
      nakshatraLord: nakshatraData.lord,
    });
  }

  // Compute aspects between transit planets and natal planets
  const aspects: TransitAspect[] = [];
  for (const transitPlanet of transitPlanets) {
    const natalPlanet = natalChart.planets.find(p => p.planet === transitPlanet.planet);
    if (!natalPlanet) continue;

    // Check if transit planet aspects natal planet
    const transitPlanetName = transitPlanet.planet as PlanetName;
    const aspectHouses = VEDIC_ASPECTS[transitPlanetName] ?? [7];

    // Calculate house difference from natal to transit
    const natalSignIndex = natalPlanet.signIndex;
    const transitSignIndex = transitPlanet.signIndex;
    let houseDiff = transitSignIndex - natalSignIndex;
    if (houseDiff < 0) houseDiff += 12;
    houseDiff += 1; // Convert to 1-based

    for (const aspectHouse of aspectHouses) {
      if (houseDiff === aspectHouse) {
        aspects.push({
          transitPlanet: transitPlanet.planet,
          natalPlanet: natalPlanet.planet,
          aspectType: "conjunction" as AspectType, // Simplified
          orb: 0,
          exact: true,
        });
      }
    }
  }

  return {
    transitDate,
    transitPlanets,
    aspects,
  };
}
