// ============================================================================
// @zeal/astrology/knowledge — Classical Astrology Knowledge Base
// ============================================================================
// Structured knowledge from classical Vedic astrology texts, organized for
// retrieval-augmented generation (RAG) and rule-based interpretation.
// ============================================================================

// ─── Local Imports for Use Within This File ────────────────────────────────────
import { bphsPlanetInSign, bphsHouseThemes, type BPHSVerse } from "./texts/bphs";
import { phaladeepikaInterpretations, type PhaladeepikaEntry } from "./texts/phaladeepika";
import { jatakaParijataRules, type JatakaParijataEntry } from "./texts/jataka-parijata";
import { YOGAS, type YogaDefinition } from "./texts/yogas";
import { DASHA_INTERPRETATIONS, type DashaInterpretation } from "./texts/dashas";
import { TRANSIT_INTERPRETATIONS, SADE_SATI_INTERPRETATION, type TransitInterpretation } from "./texts/transits";
import { NAKSHATRA_DATA, getNakshatraInfo, getNakshatraByName, type NakshatraInfo } from "./texts/nakshatras";

// ─── Classical Texts ──────────────────────────────────────────────────────────
export { bphsPlanetInSign, bphsHouseThemes } from "./texts/bphs";
export type { BPHSVerse } from "./texts/bphs";

export { phaladeepikaInterpretations } from "./texts/phaladeepika";
export type { PhaladeepikaEntry } from "./texts/phaladeepika";

export { jatakaParijataRules } from "./texts/jataka-parijata";
export type { JatakaParijataEntry } from "./texts/jataka-parijata";

export { YOGAS, detectYogas } from "./texts/yogas";
export type { YogaDefinition, YogaPlanet, DetectedYoga } from "./texts/yogas";

export { DASHA_INTERPRETATIONS } from "./texts/dashas";
export type { DashaInterpretation } from "./texts/dashas";

export { TRANSIT_INTERPRETATIONS, SADE_SATI_INTERPRETATION } from "./texts/transits";
export type { TransitInterpretation } from "./texts/transits";

export { NAKSHATRA_DATA, getNakshatraInfo, getNakshatraByName } from "./texts/nakshatras";
export type { NakshatraInfo } from "./texts/nakshatras";

// ─── Interpretation Functions ─────────────────────────────────────────────────
export {
  interpretPlanetInSign,
  interpretAllPlanetsInSigns,
} from "./interpretations/planets-in-signs";
export type { InterpretationResult } from "./interpretations/planets-in-signs";

export {
  interpretPlanetInHouse,
  interpretAllPlanetsInHouses,
} from "./interpretations/planets-in-houses";

export { interpretAspect } from "./interpretations/aspects";

export { interpretNavamsa } from "./interpretations/divisional";

// ─── Knowledge Chunk Type (for RAG) ──────────────────────────────────────────
export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  source: string;
  category: "planet-sign" | "planet-house" | "yoga" | "dasha" | "transit" | "nakshatra" | "aspect" | "general";
}

/**
 * Build all knowledge chunks for indexing/retrieval.
 */
export function buildKnowledgeChunks(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  // Planet-in-sign chunks (already imported at top)
  for (const [planet, signs] of Object.entries(bphsPlanetInSign)) {
    for (const [sign, verse] of Object.entries(signs as Record<string, BPHSVerse>)) {
      chunks.push({
        id: `ps-${planet}-${sign}`.toLowerCase().replace(/\s/g, "-"),
        title: `${planet} in ${sign}`,
        content: `${verse.translation}\n\n${verse.interpretation}`,
        keywords: verse.keywords,
        source: "BPHS",
        category: "planet-sign",
      });
    }
  }

  // Yoga chunks
  for (const yoga of YOGAS) {
    chunks.push({
      id: `yoga-${yoga.name.toLowerCase().replace(/\s+/g, "-")}`,
      title: yoga.name,
      content: `${yoga.sanskrit}\n\n${yoga.description}\n\nEffects: ${yoga.effects}${yoga.remedialMeasures ? `\n\nRemedies: ${yoga.remedialMeasures}` : ""}`,
      keywords: yoga.keywords,
      source: "Classical Yogas",
      category: "yoga",
    });
  }

  // Dasha chunks
  for (const [planet, dasha] of Object.entries(DASHA_INTERPRETATIONS) as [string, DashaInterpretation][]) {
    chunks.push({
      id: `dasha-${planet.toLowerCase()}`,
      title: `${planet} Mahadasha`,
      content: `${dasha.general}\n\nCareer: ${dasha.career}\n\nRelationships: ${dasha.relationships}\n\nHealth: ${dasha.health}\n\nSpiritual: ${dasha.spiritual}\n\nChallenges: ${dasha.challenges}\n\nRemedies: ${dasha.remedies}`,
      keywords: dasha.keywords,
      source: "Dasha Interpretations",
      category: "dasha",
    });
  }

  // Nakshatra chunks
  for (const nak of NAKSHATRA_DATA) {
    chunks.push({
      id: `nak-${nak.name.toLowerCase()}`,
      title: `${nak.name} Nakshatra`,
      content: `${nak.sanskrit} — Ruled by ${nak.lord}, deity: ${nak.deity}.\n\n${nak.interpretation}\n\nCareer: ${nak.career}\n\nRelationships: ${nak.relationships}`,
      keywords: nak.keywords,
      source: "27 Nakshatras",
      category: "nakshatra",
    });
  }

  // Transit chunks
  for (const [planet, transit] of Object.entries(TRANSIT_INTERPRETATIONS)) {
    chunks.push({
      id: `transit-${planet.toLowerCase()}`,
      title: `${planet} Transit`,
      content: `${transit.general}\n\n${Object.entries(transit.through_houses).map(([h, text]) => `House ${h}: ${text}`).join("\n\n")}`,
      keywords: transit.keywords,
      source: "Transit Interpretations",
      category: "transit",
    });
  }

  // House theme chunks
  for (const [houseNum, verse] of Object.entries(bphsHouseThemes)) {
    chunks.push({
      id: `house-${houseNum}`,
      title: `${houseNum}th House`,
      content: `${verse.translation}\n\n${verse.interpretation}`,
      keywords: verse.keywords,
      source: "BPHS",
      category: "planet-house",
    });
  }

  // Phaladeepika chunks
  for (const entry of phaladeepikaInterpretations) {
    chunks.push({
      id: `pd-${entry.topic.toLowerCase().replace(/\s+/g, "-")}`,
      title: entry.topic,
      content: entry.interpretation,
      keywords: entry.keywords,
      source: "Phaladeepika",
      category: "general",
    });
  }

  // Jataka Parijata chunks
  for (const entry of jatakaParijataRules) {
    chunks.push({
      id: `jp-${entry.rule.toLowerCase().replace(/\s+/g, "-")}`,
      title: entry.rule,
      content: entry.interpretation,
      keywords: entry.keywords,
      source: "Jataka Parijata",
      category: "general",
    });
  }

  return chunks;
}
