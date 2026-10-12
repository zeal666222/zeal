// ============================================================================
// Aspect Calculations
// ============================================================================
// Computes planetary aspects (angular relationships) between planets.
// ============================================================================

import type { AspectType, Aspect } from "../types";

/** Aspect definitions with their exact angles and typical orbs */
export interface AspectDefinition {
  type: AspectType;
  angle: number; // exact angle in degrees
  defaultOrb: number; // default orb in degrees
}

export const ASPECT_DEFINITIONS: AspectDefinition[] = [
  { type: "conjunction", angle: 0, defaultOrb: 8 },
  { type: "opposition", angle: 180, defaultOrb: 8 },
  { type: "trine", angle: 120, defaultOrb: 7 },
  { type: "square", angle: 90, defaultOrb: 7 },
  { type: "sextile", angle: 60, defaultOrb: 5 },
  { type: "quincunx", angle: 150, defaultOrb: 3 },
  { type: "semisextile", angle: 30, defaultOrb: 2 },
];

/**
 * Calculate the angular distance between two longitudes (0-180).
 */
export function angularDistance(lon1: number, lon2: number): number {
  let diff = Math.abs(lon1 - lon2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Check if two planets form an aspect and return the aspect details.
 */
export function checkAspect(
  planet1: string,
  lon1: number,
  planet2: string,
  lon2: number,
  customOrbs?: Partial<Record<AspectType, number>>
): Aspect | null {
  const diff = angularDistance(lon1, lon2);

  for (const def of ASPECT_DEFINITIONS) {
    const orb = customOrbs?.[def.type] ?? def.defaultOrb;
    const distance = Math.abs(diff - def.angle);

    if (distance <= orb) {
      return {
        planet1,
        planet2,
        type: def.type,
        orb: Math.round(distance * 100) / 100,
        exact: distance < 0.1,
      };
    }
  }

  return null;
}

/**
 * Compute all aspects between a set of planets.
 */
export function computeAllAspects(
  planets: Array<{ name: string; longitude: number }>,
  customOrbs?: Partial<Record<AspectType, number>>
): Aspect[] {
  const aspects: Aspect[] = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i] as { name: string; longitude: number };
      const p2 = planets[j] as { name: string; longitude: number };
      const aspect = checkAspect(p1.name, p1.longitude, p2.name, p2.longitude, customOrbs);
      if (aspect) {
        aspects.push(aspect);
      }
    }
  }

  return aspects;
}
