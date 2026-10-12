// ============================================================================
// Shadbala - Six-fold Planetary Strength Calculation
// ============================================================================
// Computes the six sources of planetary strength:
// 1. Sthana Bala (positional strength)
// 2. Dig Bala (directional strength)
// 3. Kala Bala (temporal strength)
// 4. Chesta Bala (motional strength)
// 5. Naisargika Bala (natural strength)
// 6. Drig Bala (aspectual strength)
// ============================================================================

import type { BirthData, ShadbalaResult, PlanetShadbala, ShadbalaComponent, PlanetName } from "../types";
import { computeRashiChart, parseBirthDateTime } from "./rashi";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";

/** Required Shadbala values for each planet (in Rupas) */
const REQUIRED_SHADBALA: Record<PlanetName, number> = {
  Sun: 539,
  Moon: 432,
  Mars: 147,
  Mercury: 423,
  Jupiter: 360,
  Venus: 369,
  Saturn: 306,
  Rahu: 0, // Nodes have different requirements
  Ketu: 0,
};

/** Natural (Naisargika) Bala values (in Rupas) */
const NAISARGIKA_BALA: Record<PlanetName, number> = {
  Venus: 60,
  Mercury: 45,
  Jupiter: 30,
  Moon: 15,
  Saturn: 7.5,
  Sun: 7.5,
  Mars: 4.5,
  Rahu: 0,
  Ketu: 0,
};

/**
 * Compute Sthana Bala (positional strength) for a planet.
 * Based on the sign placement, exaltation, debilitation, etc.
 */
function computeSthanaBala(planet: PlanetName, signIndex: number): number {
  // Simplified: assign strength based on sign placement
  // In full implementation, this considers exaltation, own sign, moolatrikona, etc.
  const baseStrength = 60; // Base value in shashtiamsas

  // Exaltation signs (simplified)
  const exaltationSigns: Partial<Record<PlanetName, number>> = {
    Sun: 0, // Aries
    Moon: 1, // Taurus
    Mars: 9, // Capricorn
    Mercury: 5, // Virgo
    Jupiter: 3, // Cancer
    Venus: 11, // Pisces
    Saturn: 6, // Libra
  };

  // Own signs (simplified)
  const ownSigns: Partial<Record<PlanetName, number[]>> = {
    Sun: [4], // Leo
    Moon: [3], // Cancer
    Mars: [0, 7], // Aries, Scorpio
    Mercury: [2, 5], // Gemini, Virgo
    Jupiter: [8, 10], // Sagittarius, Pisces
    Venus: [1, 6], // Taurus, Libra
    Saturn: [9, 10], // Capricorn, Aquarius
  };

  let strength = baseStrength;

  // Exaltation bonus
  if (exaltationSigns[planet] === signIndex) {
    strength += 60; // Exaltation adds significant strength
  }

  // Own sign bonus
  if (ownSigns[planet]?.includes(signIndex)) {
    strength += 30;
  }

  // Convert from shashtiamsas to rupas (divide by 7)
  return Math.round((strength / 7) * 100) / 100;
}

/**
 * Compute Dig Bala (directional strength).
 * Planets have strength in specific directions (houses).
 */
function computeDigBala(planet: PlanetName, house: number): number {
  // Directional strengths (simplified)
  // Mercury & Jupiter strong in 1st, Venus & Moon in 4th,
  // Sun & Mars in 10th, Saturn in 7th
  const baseDigBala = 30;

  let modifier = 0;
  switch (planet) {
    case "Mercury":
    case "Jupiter":
      modifier = house === 1 ? 30 : house === 7 ? -15 : 0;
      break;
    case "Venus":
    case "Moon":
      modifier = house === 4 ? 30 : house === 10 ? -15 : 0;
      break;
    case "Sun":
    case "Mars":
      modifier = house === 10 ? 30 : house === 4 ? -15 : 0;
      break;
    case "Saturn":
      modifier = house === 7 ? 30 : house === 1 ? -15 : 0;
      break;
  }

  return Math.round((baseDigBala + modifier) * 100) / 100;
}

/**
 * Compute Chesta Bala (motional strength) from planet's speed.
 */
function computeChestaBala(_planet: PlanetName, speed: number): number {
  // Chesta Bala is proportional to the planet's speed
  // Maximum speed gives maximum strength
  const maxSpeeds: Partial<Record<PlanetName, number>> = {
    Sun: 1.0, Moon: 15.0, Mars: 1.5, Mercury: 2.0,
    Jupiter: 0.25, Venus: 1.3, Saturn: 0.15,
  };

  const maxSpeed = maxSpeeds[_planet] ?? 1.0;
  const ratio = Math.min(1, Math.abs(speed) / maxSpeed);
  return Math.round(ratio * 60 * 100) / 100; // Max 60 rupas
}

/**
 * Compute the Shadbala for all planets.
 */
export function computeShadbala(birthData: BirthData): ShadbalaResult {
  const chart = computeRashiChart(birthData);
  const dateTime = parseBirthDateTime(birthData);
  const time = getAstroTime(dateTime);
  const ayanamsa = getAyanamsa(time, "lahiri");
  const planetStates = getVedicPlanetPositions(time, ayanamsa);

  const results: ShadbalaResult = [];

  const mainPlanets: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

  for (const planet of mainPlanets) {
    const planetData = chart.planets.find(p => p.planet === planet);
    const state = planetStates.get(planet);
    if (!planetData || !state) continue;

    const sthana = computeSthanaBala(planet, planetData.signIndex);
    const dig = computeDigBala(planet, planetData.house);
    const chesta = computeChestaBala(planet, state.speed);
    const naisargika = NAISARGIKA_BALA[planet] ?? 0;

    // Kala Bala (temporal) - simplified
    const kala = 30; // Placeholder: depends on time of birth, ayana, etc.

    // Drig Bala (aspectual) - simplified
    const drig = 15; // Placeholder: depends on aspects from other planets

    const total = Math.round((sthana + dig + kala + chesta + naisargika + drig) * 100) / 100;
    const required = REQUIRED_SHADBALA[planet] ?? 0;
    const ratio = required > 0 ? Math.round((total / required) * 100) / 100 : 0;

    const components: ShadbalaComponent[] = [
      { name: "Sthana Bala", value: sthana },
      { name: "Dig Bala", value: dig },
      { name: "Kala Bala", value: kala },
      { name: "Chesta Bala", value: chesta },
      { name: "Naisargika Bala", value: naisargika },
      { name: "Drig Bala", value: drig },
    ];

    results.push({
      planet,
      total,
      components,
      ratio,
    });
  }

  return results;
}
