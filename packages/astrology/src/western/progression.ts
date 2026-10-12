// ============================================================================
// Secondary Progressions
// ============================================================================
// In secondary progressions, each day after birth corresponds to one year of life.
// The progressed chart shows the inner psychological evolution.
// ============================================================================

import type { BirthData, ProgressionData, PlanetPosition, HouseCusp } from "../types";
import { WESTERN_PLANETS } from "../types";
import { getWesternPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { computeHouses, computeAscendant, computeMC, computeLST } from "../utils/houses";
import { degreesToSignDeg } from "../vedic/rashi";
import { parseBirthDateTime } from "../vedic/rashi";

/**
 * Compute secondary progressions for a given date.
 * The progressed date = birth date + (target date - birth date) mapped 1 day = 1 year
 */
export function computeProgressions(
  birthData: BirthData,
  targetDate: string,
  houseSystem: "placidus" | "whole-sign" | "koch" | "equal" = "placidus"
): ProgressionData {
  const birthDate = parseBirthDateTime(birthData);
  const target = new Date(`${targetDate}T12:00:00Z`);

  // Calculate the number of days between birth and target
  const diffMs = target.getTime() - birthDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Progressed date = birth date + diffDays days
  // (1 day after birth = 1 year of life)
  const progressedDate = new Date(birthDate.getTime() + diffDays * 24 * 60 * 60 * 1000);
  const progressedTime = getAstroTime(progressedDate);

  // Compute progressed planet positions
  const planetStates = getWesternPlanetPositions(progressedTime);
  const progressedPlanets: PlanetPosition[] = [];

  for (const planetName of WESTERN_PLANETS) {
    const state = planetStates.get(planetName);
    if (!state) continue;

    const { sign, signIndex, degree, minute, second } = degreesToSignDeg(state.longitude);

    progressedPlanets.push({
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

  // Compute progressed houses (using the progressed date's sidereal time)
  const lst = computeLST(progressedDate, birthData.birthPlace.lng);
  const mcDegree = computeMC(lst);
  const ascDegree = computeAscendant(lst, birthData.birthPlace.lat);
  const houses = computeHouses(ascDegree, mcDegree, birthData.birthPlace.lat, houseSystem);

  // Assign houses to progressed planets
  for (const planet of progressedPlanets) {
    for (let i = 0; i < 12; i++) {
      const currentCusp = (houses[i] as HouseCusp).degree;
      const nextCusp = (houses[(i + 1) % 12] as HouseCusp).degree;
      if (currentCusp < nextCusp) {
        if (planet.absoluteDegree >= currentCusp && planet.absoluteDegree < nextCusp) {
          planet.house = i + 1;
          break;
        }
      } else {
        if (planet.absoluteDegree >= currentCusp || planet.absoluteDegree < nextCusp) {
          planet.house = i + 1;
          break;
        }
      }
    }
  }

  const ascData = degreesToSignDeg(ascDegree);
  const progressedAscendant: HouseCusp = {
    house: 1,
    sign: ascData.sign,
    signIndex: ascData.signIndex,
    degree: ascDegree,
  };

  return {
    date: targetDate,
    progressedPlanets,
    progressedAscendant,
    progressedHouses: houses,
  };
}
