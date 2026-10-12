// ============================================================================
// Planets in Signs — Rule-based interpretation functions
// ============================================================================
// Returns structured interpretation for each planet-sign combination.
// ============================================================================

import { bphsPlanetInSign, type BPHSVerse } from "../texts/bphs";

export interface InterpretationResult {
  title: string;
  summary: string;
  detailed: string;
  remedialMeasures?: string;
  keywords: string[];
}

/**
 * Get interpretation for a planet in a specific sign.
 */
export function interpretPlanetInSign(
  planet: string,
  sign: string,
): InterpretationResult {
  const verse = bphsPlanetInSign[planet]?.[sign];

  if (!verse) {
    return {
      title: `${planet} in ${sign}`,
      summary: `The planet ${planet} is positioned in the sign ${sign}.`,
      detailed: `Detailed interpretation for ${planet} in ${sign} is not yet available in the knowledge base.`,
      keywords: [planet.toLowerCase(), sign.toLowerCase()],
    };
  }

  return {
    title: `${planet} in ${sign}`,
    summary: verse.translation,
    detailed: verse.interpretation,
    keywords: verse.keywords,
  };
}

/**
 * Get all planet-in-sign interpretations for a chart.
 */
export function interpretAllPlanetsInSigns(
  planets: Array<{ planet: string; sign: string }>,
): InterpretationResult[] {
  return planets.map(p => interpretPlanetInSign(p.planet, p.sign));
}
