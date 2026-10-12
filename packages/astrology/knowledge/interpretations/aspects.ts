// ============================================================================
// Aspect Interpretations
// ============================================================================

import type { InterpretationResult } from "./planets-in-signs";

const ASPECT_NATURE: Record<string, { nature: string; effect: string }> = {
  conjunction: { nature: "blending", effect: "The energies of these planets merge and amplify each other. Their significations become intertwined in the native's life." },
  opposition: { nature: "tension", effect: "These planets create a pull-pull dynamic. The native must learn to balance these opposing forces. Growth comes through integration." },
  trine: { nature: "harmony", effect: "These planets support each other naturally. Their significations flow together with grace. This is a fortunate and easy combination." },
  square: { nature: "challenge", effect: "These planets create friction that demands action. The native faces repeated challenges that force growth in both areas. Inner tension drives achievement." },
  sextile: { nature: "opportunity", effect: "These planets offer opportunities to each other. The native can consciously develop the connection between these energies for mutual benefit." },
  quincunx: { nature: "adjustment", effect: "These planets require ongoing adjustment. The native must constantly fine-tune the relationship between these energies. Health and daily routines are affected." },
  semisextile: { nature: "subtle", effect: "A subtle connection that can be developed with awareness. Minor adjustments in these areas create positive ripple effects." },
};

const PLANET_PAIR_MEANINGS: Record<string, string> = {
  "Sun-Moon": "The soul (Sun) and mind (Moon) are connected. Self-expression and emotional nature influence each other. In conjunction, this creates powerful personality focus. Father-mother dynamics are important.",
  "Sun-Mars": "Vitality and courage blend. The native has strong willpower and physical energy. Leadership through action. May be prone to accidents from over-confidence.",
  "Sun-Saturn": "Authority and discipline interact. Father karma is activated. The native learns leadership through restriction. Career comes through patience and hard work.",
  "Sun-Jupiter": "Soul and wisdom combine. The native has natural authority backed by wisdom. Dharma and career align. Fortune comes through righteous leadership.",
  "Moon-Mars": "Emotions and energy interact. The native has emotional courage but may be impulsive. Mother-son dynamics. Emotional strength through action.",
  "Moon-Mercury": "Mind and emotions blend. The native thinks with feelings and feels with thoughts. Communication is emotional. Good for counseling and writing.",
  "Moon-Jupiter": "Emotions and wisdom combine. The native has emotional intelligence and spiritual depth. Fortune through emotional grace. Mother is wise and nurturing.",
  "Moon-Venus": "Emotions and love merge. The native has refined emotional taste. Artistic sensitivity. Marriage and mother are both important. Emotional beauty.",
  "Moon-Saturn": "Emotions and discipline interact. The native is emotionally mature but may seem reserved. Mother may have been strict. Emotional strength through hardship.",
  "Mars-Mercury": "Energy and intellect combine. The native has sharp analytical skills and quick action. Good for engineering, surgery, and technical work. Nervous energy.",
  "Mars-Jupiter": "Courage and wisdom blend. The native is a spiritual warrior. Righteous action. Leadership through both strength and wisdom. Fortune through dharma.",
  "Mars-Saturn": "Energy meets discipline. The native has tremendous perseverance. Achievement through sustained effort. May feel blocked but builds lasting structures.",
  "Mercury-Jupiter": "Intellect and wisdom combine. The native is a scholar and teacher. Business wisdom. Communication of higher knowledge. Fortune through learning.",
  "Mercury-Venus": "Intellect and artistry blend. The native has creative intelligence. Good for writing, arts, and business. Charming communication.",
  "Mercury-Saturn": "Intellect meets discipline. The native has structured, methodical thinking. Good for research and administration. Communication is serious and purposeful.",
  "Jupiter-Venus": "Wisdom and love combine. The native has both spiritual and material blessings. Marriage is fortunate. Teacher of love and dharma. Guru's grace.",
  "Jupiter-Saturn": "Wisdom and discipline interact. The native balances expansion and restriction. Fortune comes through hard work. Spiritual maturity.",
  "Venus-Saturn": "Love meets discipline. The native is mature in relationships. Late-blooming but lasting love. Artistic discipline. Commitment is valued.",
};

function getPairKey(planet1: string, planet2: string): string {
  const pair = [planet1, planet2].sort();
  return `${pair[0]}-${pair[1]}`;
}

/**
 * Get interpretation for an aspect between two planets.
 */
export function interpretAspect(
  planet1: string,
  planet2: string,
  aspectType: string,
  orb: number,
): InterpretationResult {
  const aspectInfo: { nature: string; effect: string } = ASPECT_NATURE[aspectType] ?? ASPECT_NATURE.conjunction!;
  const pairKey = getPairKey(planet1, planet2);
  const pairMeaning = PLANET_PAIR_MEANINGS[pairKey] ??
    `${planet1} and ${planet2} interact through ${aspectType}. Their energies ${aspectInfo.effect.toLowerCase()}`;

  const orbQuality = orb < 2 ? "exact and powerful" : orb < 5 ? "strong" : "wide but still significant";

  return {
    title: `${planet1} ${aspectType} ${planet2}`,
    summary: `${planet1} forms ${aspectType !== "conjunction" ? "an " : ""}${aspectType} aspect with ${planet2} (orb: ${orb.toFixed(1)}°). ${aspectInfo.nature.charAt(0).toUpperCase() + aspectInfo.nature.slice(1)} aspect — ${aspectInfo.effect.split(".")[0]}.`,
    detailed: `${pairMeaning} The ${aspectType} aspect (${orbQuality}, ${orb.toFixed(1)}° orb) means ${aspectInfo.effect} In the natal chart, this creates a ${aspectInfo.nature} dynamic between ${planet1}'s significations and ${planet2}'s significations that the native works with throughout life.`,
    keywords: [planet1.toLowerCase(), planet2.toLowerCase(), aspectType, aspectInfo.nature],
  };
}
