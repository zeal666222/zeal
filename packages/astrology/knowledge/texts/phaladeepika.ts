// ============================================================================
// Phaladeepika — Key Interpretations
// ============================================================================
// Mantreswara's Phaladeepika — classical text focused on practical prediction.
// ============================================================================

export interface PhaladeepikaEntry {
  topic: string;
  interpretation: string;
  keywords: string[];
}

export const phaladeepikaInterpretations: PhaladeepikaEntry[] = [
  {
    topic: "Strong Ascendant Lord",
    interpretation: "When the lord of the Ascendant is strong (well-placed, exalted, or in own sign), the native enjoys good health, respect from all, and success in all undertakings. The personality radiates confidence and authority.",
    keywords: ["ascendant lord", "strong", "health", "respect", "success", "confidence"],
  },
  {
    topic: "Weak Ascendant Lord",
    interpretation: "When the lord of the Ascendant is weak (debilitated, combust, or in enemy sign), the native may face health challenges, lack of confidence, and obstacles in starting new ventures. Remedial measures strengthen the planet.",
    keywords: ["ascendant lord", "weak", "health challenges", "confidence", "obstacles"],
  },
  {
    topic: "Moon in Benefic Signs",
    interpretation: "The Moon in benefic signs (Taurus, Cancer, Libra, Sagittarius, Pisces) gives emotional stability, good reputation, and public favor. The native is well-liked and has a pleasant demeanor.",
    keywords: ["moon", "benefic", "emotional stability", "reputation", "public favor"],
  },
  {
    topic: "Moon in Malefic Signs",
    interpretation: "The Moon in malefic signs (Aries, Scorpio, Capricorn) gives emotional turbulence but also resilience. The native learns emotional strength through challenges. Mental health practices are essential.",
    keywords: ["moon", "malefic", "emotional turbulence", "resilience", "mental health"],
  },
  {
    topic: "Mercury Afflicted",
    interpretation: "When Mercury is afflicted by conjunction with malefics or in debilitation, the native may face challenges in education, communication, or business. Nervous system needs care. Speech therapy or writing practice helps.",
    keywords: ["mercury", "afflicted", "education", "communication", "nervous system"],
  },
  {
    topic: "Venus Well-Placed",
    interpretation: "When Venus is well-placed, the native enjoys marital happiness, artistic talents, vehicle comforts, and material luxuries. Creative pursuits bring both fame and fortune.",
    keywords: ["venus", "well-placed", "marriage", "artistic", "luxury", "creative"],
  },
  {
    topic: "Saturn in Upachaya Houses",
    interpretation: "Saturn in upachaya houses (3, 6, 10, 11) gives excellent results. The native overcomes enemies, defeats diseases, achieves career success, and gains wealth. Saturn's difficulties become blessings in these houses.",
    keywords: ["saturn", "upachaya", "overcome enemies", "career success", "wealth", "blessing"],
  },
  {
    topic: "Rahu in Kendra",
    interpretation: "Rahu in a kendra (1, 4, 7, 10) can give sudden rise to fame and material success if well-associated. The native may achieve through unconventional means. Foreign connections are strong.",
    keywords: ["rahu", "kendra", "sudden fame", "unconventional", "foreign", "material success"],
  },
  {
    topic: "Ketu in Moksha Houses",
    interpretation: "Ketu in 4, 8, or 12 house gives strong spiritual inclination. The native has natural mystical insight and may achieve liberation. Detachment from material world grows with age.",
    keywords: ["ketu", "moksha", "spiritual", "mystical", "detachment", "liberation"],
  },
  {
    topic: "Multiple Planets in One House",
    interpretation: "When multiple planets occupy one house, their combined energy creates a powerful focus in that life area. The house matters become central to the native's life story. Planetary friendships determine if the combination is harmonious.",
    keywords: ["conjunction", "multiple planets", "house focus", "central theme", "planetary friendship"],
  },
  {
    topic: "Combust Planet",
    interpretation: "A planet too close to the Sun becomes combust (astha). Its significations are suppressed but not destroyed. The native may feel frustrated in that area until the planet's dasha or transit brings expression.",
    keywords: ["combust", "sun", "suppressed", "frustration", "delayed expression"],
  },
  {
    topic: "Retrograde Planet",
    interpretation: "A retrograde planet has heightened strength (chesta bala) but expresses in unconventional ways. The native revisits that planet's themes repeatedly. Past-life mastery is indicated. The planet's significations are intense but inward-directed.",
    keywords: ["retrograde", "heightened strength", "unconventional", "past-life", "intense", "inward"],
  },
];
