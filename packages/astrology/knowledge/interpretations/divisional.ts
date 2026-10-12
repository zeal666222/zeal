// ============================================================================
// Divisional Chart Interpretations (Navamsa etc.)
// ============================================================================

import type { InterpretationResult } from "./planets-in-signs";

export function interpretNavamsa(
  planets: Array<{ planet: string; sign: string }>,
  ascendantSign: string,
): InterpretationResult[] {
  const results: InterpretationResult[] = [];

  // Navamsa Ascendant interpretation
  results.push({
    title: `Navamsa Ascendant in ${ascendantSign}`,
    summary: `The Navamsa (D9) Ascendant in ${ascendantSign} reveals the soul's dharma and the true nature of marriage and partnerships.`,
    detailed: `The Navamsa chart is the most important divisional chart. It reveals: (1) The strength of planets — a planet in its own sign or exalted in Navamsa gives full results. (2) The nature of marriage and spouse. (3) The soul's dharma in this lifetime. (4) The second half of life (after age 36). With Ascendant in ${ascendantSign}, the soul's path involves the qualities of ${ascendantSign}.`,
    keywords: ["navamsa", "d9", "ascendant", ascendantSign.toLowerCase(), "marriage", "dharma", "soul"],
  });

  // Planet interpretations in Navamsa
  const navamsaMeanings: Record<string, Record<string, string>> = {
    Sun: {
      Aries: "Strong in Navamsa — soul has natural leadership and courage. Marriage partner is independent.",
      Leo: "Very strong — soul has royal dharma. Marriage brings creative expression and respect.",
      Sagittarius: "Strong — soul has philosophical dharma. Marriage partner is wise and spiritual.",
    },
    Moon: {
      Taurus: "Very strong — soul has emotional stability. Marriage brings material comfort.",
      Cancer: "Very strong — soul has nurturing dharma. Marriage is emotionally deep.",
      Pisces: "Strong — soul has spiritual dharma. Marriage is compassionate and mystical.",
    },
    Mars: {
      Aries: "Very strong — soul has warrior dharma. Marriage is energetic and passionate.",
      Scorpio: "Very strong — soul has transformative dharma. Marriage is intense and regenerative.",
      Capricorn: "Strong — soul has disciplined dharma. Marriage brings career support.",
    },
    Jupiter: {
      Sagittarius: "Very strong — soul has teacher dharma. Marriage is blessed with wisdom.",
      Pisces: "Very strong — soul has guru dharma. Marriage is spiritually profound.",
      Cancer: "Strong — soul has nurturing dharma. Marriage brings emotional wisdom.",
    },
    Venus: {
      Taurus: "Very strong — soul has artistic dharma. Marriage is luxurious and beautiful.",
      Libra: "Very strong — soul has partnership dharma. Marriage is harmonious and charming.",
      Pisces: "Strong — soul has devotional dharma. Marriage is loving and compassionate.",
    },
    Saturn: {
      Capricorn: "Very strong — soul has authority dharma. Marriage brings lasting achievement.",
      Aquarius: "Very strong — soul has humanitarian dharma. Marriage serves collective welfare.",
      Libra: "Strong — soul has justice dharma. Marriage is balanced and fair.",
    },
  };

  for (const p of planets) {
    const specific = navamsaMeanings[p.planet]?.[p.sign];
    if (specific) {
      results.push({
        title: `${p.planet} in ${p.sign} (Navamsa)`,
        summary: specific,
        detailed: `In the Navamsa chart, ${p.planet} in ${p.sign} indicates: ${specific} This placement shows the deeper soul-level expression of ${p.planet}'s energy and how it manifests through marriage and dharma.`,
        keywords: [p.planet.toLowerCase(), p.sign.toLowerCase(), "navamsa", "d9"],
      });
    }
  }

  return results;
}
