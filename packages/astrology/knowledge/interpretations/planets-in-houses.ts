// ============================================================================
// Planets in Houses — Rule-based interpretation functions
// ============================================================================

import { bphsHouseThemes } from "../texts/bphs";
import type { InterpretationResult } from "./planets-in-signs";

const PLANET_HOUSE_THEMES: Record<string, string[]> = {
  Sun: ["vitality", "soul purpose", "authority", "father", "career", "health", "self-expression"],
  Moon: ["emotions", "mind", "mother", "public life", "home", "nurturing", "intuition"],
  Mars: ["courage", "energy", "siblings", "property", "conflict", "engineering", "physical strength"],
  Mercury: ["intellect", "communication", "education", "business", "writing", "trade", "younger siblings"],
  Jupiter: ["wisdom", "fortune", "children", "dharma", "teaching", "spiritual growth", "wealth"],
  Venus: ["love", "marriage", "arts", "luxury", "beauty", "vehicles", "creative expression"],
  Saturn: ["discipline", "karma", "career", "hard work", "structure", "obstacles", "lasting achievement"],
  Rahu: ["obsession", "foreign connections", "technology", "unconventional", "material ambition", "illusion"],
  Ketu: ["detachment", "spiritual liberation", "past-life", "moksha", "mystical", "letting go"],
};

const HOUSE_MEANINGS: Record<number, { name: string; area: string }> = {
  1: { name: "Ascendant (Lagna)", area: "self, body, personality, health, life direction" },
  2: { name: "Dhana Bhava", area: "wealth, family, speech, food, early education" },
  3: { name: "Sahaja Bhava", area: "courage, siblings, short travels, communication, arts" },
  4: { name: "Sukha Bhava", area: "mother, home, vehicles, emotional foundation, property" },
  5: { name: "Putra Bhava", area: "children, intelligence, creativity, romance, past-life merit" },
  6: { name: "Ripu Bhava", area: "enemies, disease, debt, service, daily work, obstacles" },
  7: { name: "Kalatra Bhava", area: "marriage, partnerships, business, public life, foreign travel" },
  8: { name: "Ayur Bhava", area: "longevity, transformation, inheritance, occult, sudden events" },
  9: { name: "Dharma Bhava", area: "dharma, father, guru, fortune, pilgrimage, higher learning" },
  10: { name: "Karma Bhava", area: "career, status, authority, public reputation, karma" },
  11: { name: "Labha Bhava", area: "gains, income, elder siblings, social networks, desires" },
  12: { name: "Vyaya Bhava", area: "losses, foreign lands, liberation, sleep, spiritual practices" },
};

/**
 * Get interpretation for a planet in a specific house.
 */
export function interpretPlanetInHouse(
  planet: string,
  house: number,
): InterpretationResult {
  const houseInfo = HOUSE_MEANINGS[house];
  const planetThemes = PLANET_HOUSE_THEMES[planet] ?? ["life matters"];
  const houseVerse = bphsHouseThemes[house];

  if (!houseInfo) {
    return {
      title: `${planet} in House ${house}`,
      summary: `${planet} is placed in house ${house}.`,
      detailed: `Detailed interpretation not available.`,
      keywords: [planet.toLowerCase(), `house ${house}`],
    };
  }

  const summary = `${planet} in the ${houseInfo.name} (${house}th house) channels ${planetThemes.join(", ")} through the life area of ${houseInfo.area}.`;

  const detailed = `With ${planet} in the ${house}th house, the themes of ${planetThemes.join(" and ")} are focused through ${houseInfo.area}. ${houseVerse?.interpretation ?? ""} This placement makes ${houseInfo.area} a central arena where ${planet}'s energy expresses itself throughout life.`;

  return {
    title: `${planet} in ${houseInfo.name}`,
    summary,
    detailed,
    keywords: [planet.toLowerCase(), `house ${house}`, ...houseVerse?.keywords ?? []],
  };
}

/**
 * Get all planet-in-house interpretations for a chart.
 */
export function interpretAllPlanetsInHouses(
  planets: Array<{ planet: string; house: number }>,
): InterpretationResult[] {
  return planets.map(p => interpretPlanetInHouse(p.planet, p.house));
}
