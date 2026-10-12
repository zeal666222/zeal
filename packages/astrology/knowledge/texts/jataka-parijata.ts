// ============================================================================
// Jataka Parijata — Key Rules
// ============================================================================
// Vaidyanatha Dikshita's Jataka Parijata — rules for planetary strengths
// and special combinations.
// ============================================================================

export interface JatakaParijataEntry {
  rule: string;
  interpretation: string;
  keywords: string[];
}

export const jatakaParijataRules: JatakaParijataEntry[] = [
  {
    rule: "Planet in Friend's Sign",
    interpretation: "A planet in a friend's sign gives favorable results. The native receives support from the people and matters that planet signifies. Relationships are harmonious in that area of life.",
    keywords: ["friend sign", "support", "harmonious", "favorable"],
  },
  {
    rule: "Planet in Enemy's Sign",
    interpretation: "A planet in an enemy's sign gives resistance in that life area. The native must work harder for results. Relationships related to that planet's significations may be challenging.",
    keywords: ["enemy sign", "resistance", "challenging", "hard work"],
  },
  {
    rule: "Planet Between Friends",
    interpretation: "A planet surrounded by benefic planets (benefic planets on both sides) receives strength and protection. The native gets support from multiple sources in that life area.",
    keywords: ["benefic surrounded", "protection", "support", "strength"],
  },
  {
    rule: "Planet Between Malefics",
    interpretation: "A planet hemmed between malefic planets (papa kartari) is stressed. The native faces pressure in that life area but develops resilience. Remedial measures are recommended.",
    keywords: ["papa kartari", "malefic surrounded", "pressure", "resilience", "remedial"],
  },
  {
    rule: "Kendra Lord Strength",
    interpretation: "The lord of a kendra house (1, 4, 7, 10) is naturally strong and gives material achievement. When connected with a trikona lord (1, 5, 9), it creates Raja Yoga — royal combination.",
    keywords: ["kendra lord", "material achievement", "raja yoga", "strength"],
  },
  {
    rule: "Trikona Lord Grace",
    interpretation: "The lord of a trikona house (1, 5, 9) gives dharma, grace, and fortune. When well-placed, the native enjoys divine protection and good luck. Past-life merit manifests.",
    keywords: ["trikona lord", "dharma", "grace", "fortune", "divine protection", "merit"],
  },
  {
    rule: "Dusthana Lord Challenge",
    interpretation: "The lord of a dusthana house (6, 8, 12) brings challenges in its dasha/antar periods. However, when strong, the native overcomes obstacles and gains from crises. Transformation is the gift.",
    keywords: ["dusthana lord", "challenge", "obstacles", "overcome", "transformation"],
  },
  {
    rule: "Upachaya Lord Growth",
    interpretation: "The lord of an upachaya house (3, 6, 10, 11) grows stronger over time. The native improves in that life area with age and effort. Late-blooming success is indicated.",
    keywords: ["upachaya lord", "growth", "improvement", "late-blooming", "effort"],
  },
  {
    rule: "Vargottama Planet",
    interpretation: "A planet in the same sign in both Rashi and Navamsa charts (vargottama) is exceptionally strong. Its significations are guaranteed to manifest. The native has mastery in that area from past lives.",
    keywords: ["vargottama", "exceptionally strong", "guaranteed", "mastery", "past life"],
  },
  {
    rule: "Neecha Bhanga (Cancellation of Debilitation)",
    interpretation: "When a debilitated planet's debilitation is cancelled (neeche bhanga), the native rises from the depths to great heights. The planet's signification becomes a source of extraordinary strength after initial struggle.",
    keywords: ["neecha bhanga", "debilitation cancelled", "rise from depths", "extraordinary strength"],
  },
];
