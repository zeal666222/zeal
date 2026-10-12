// ============================================================================
// Astrology RAG Pipeline — Keyword-based retrieval from knowledge base
// ============================================================================
// Given chart data + user question, retrieves the most relevant knowledge
// chunks to provide context for the LLM interpretation.
//
// Uses keyword matching (TF-IDF-like scoring) rather than vector embeddings
// for simplicity and zero-cost operation. Can be upgraded to embeddings later.
// ============================================================================

import {
  buildKnowledgeChunks,
  type KnowledgeChunk,
  interpretPlanetInSign,
  interpretPlanetInHouse,
  interpretAspect,
  DASHA_INTERPRETATIONS,
  getNakshatraByName,
  detectYogas,
  type YogaPlanet,
} from "@zeal/astrology/knowledge";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RAGContext {
  /** The retrieved knowledge chunks, ordered by relevance */
  chunks: KnowledgeChunk[];
  /** Formatted context string for the LLM prompt */
  contextString: string;
  /** Total chunks available in the knowledge base */
  totalChunks: number;
  /** Time taken to retrieve (ms) */
  retrievalTimeMs: number;
}

export interface ChartDataForRAG {
  planets: Array<{
    planet: string;
    sign: string;
    signIndex: number;
    house: number;
    degree: number;
    isRetrograde: boolean;
    nakshatra?: string;
  }>;
  ascendant: {
    sign: string;
    signIndex: number;
  };
  aspects?: Array<{
    planet1: string;
    planet2: string;
    type: string;
    orb: number;
  }>;
  dasha?: {
    mahadasha: { planet: string };
    antardasha: { planet: string };
  };
}

// ─── Knowledge Base Singleton ─────────────────────────────────────────────────

let _chunks: KnowledgeChunk[] | null = null;

function getChunks(): KnowledgeChunk[] {
  if (!_chunks) {
    _chunks = buildKnowledgeChunks();
  }
  return _chunks;
}

// ─── Keyword Extraction ───────────────────────────────────────────────────────

/**
 * Extract relevant keywords from chart data and user question.
 */
function extractKeywords(chart: ChartDataForRAG, question?: string): string[] {
  const keywords: string[] = [];

  // Planet names
  for (const p of chart.planets) {
    keywords.push(p.planet.toLowerCase());
  }

  // Sign names
  const signs = new Set(chart.planets.map(p => p.sign.toLowerCase()));
  signs.add(chart.ascendant.sign.toLowerCase());
  keywords.push(...signs);

  // House numbers
  for (const p of chart.planets) {
    keywords.push(`house ${p.house}`);
    keywords.push(`${p.house}th house`);
  }

  // Planet-sign combinations
  for (const p of chart.planets) {
    keywords.push(`${p.planet.toLowerCase()} ${p.sign.toLowerCase()}`);
  }

  // Planet-house combinations
  for (const p of chart.planets) {
    keywords.push(`${p.planet.toLowerCase()} house ${p.house}`);
  }

  // Dasha planets
  if (chart.dasha) {
    keywords.push(`${chart.dasha.mahadasha.planet.toLowerCase()} dasha`);
    keywords.push(`${chart.dasha.mahadasha.planet.toLowerCase()} mahadasha`);
    keywords.push(`${chart.dasha.antardasha.planet.toLowerCase()} antardasha`);
  }

  // Nakshatra names
  for (const p of chart.planets) {
    if (p.nakshatra) {
      keywords.push(p.nakshatra.toLowerCase());
    }
  }

  // Aspects
  if (chart.aspects) {
    for (const a of chart.aspects) {
      keywords.push(a.type.toLowerCase());
      keywords.push(`${a.planet1.toLowerCase()} ${a.planet2.toLowerCase()}`);
    }
  }

  // Ascendant
  keywords.push("ascendant");
  keywords.push("lagna");
  keywords.push(chart.ascendant.sign.toLowerCase());

  // Common yoga keywords
  keywords.push("yoga", "raja yoga", "gaja kesari");

  // Question keywords (if provided)
  if (question) {
    const qWords = question
      .toLowerCase()
      .replace(/[?.!,]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3);
    keywords.push(...qWords);

    // Topic detection
    if (/career|job|work|profession|business/i.test(question)) {
      keywords.push("career", "10th house", "karma");
    }
    if (/marriage|relationship|love|spouse|partner/i.test(question)) {
      keywords.push("marriage", "7th house", "venus", "partnership");
    }
    if (/health|disease|illness|body/i.test(question)) {
      keywords.push("health", "6th house", "8th house", "disease");
    }
    if (/money|wealth|finance|income/i.test(question)) {
      keywords.push("wealth", "2nd house", "11th house", "dhana");
    }
    if (/spiritual|religion|god|meditation|moksha/i.test(question)) {
      keywords.push("spiritual", "9th house", "12th house", "moksha", "dharma");
    }
    if (/children|kids|son|daughter/i.test(question)) {
      keywords.push("children", "5th house", "jupiter");
    }
    if (/father|mother|family|parent/i.test(question)) {
      keywords.push("father", "mother", "family", "4th house", "9th house");
    }
    if (/foreign|travel|abroad/i.test(question)) {
      keywords.push("foreign", "12th house", "9th house", "travel");
    }
  }

  return [...new Set(keywords)];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a knowledge chunk against extracted keywords.
 * Uses a simple TF-IDF-like scoring: count keyword matches in chunk keywords + content.
 */
function scoreChunk(chunk: KnowledgeChunk, keywords: string[]): number {
  let score = 0;

  // Keyword match in chunk's keyword list (high weight)
  for (const kw of keywords) {
    for (const chunkKw of chunk.keywords) {
      if (chunkKw.toLowerCase() === kw.toLowerCase()) {
        score += 3;
      } else if (chunkKw.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(chunkKw.toLowerCase())) {
        score += 1;
      }
    }
  }

  // Keyword match in chunk title (medium weight)
  const titleLower = chunk.title.toLowerCase();
  for (const kw of keywords) {
    if (titleLower.includes(kw.toLowerCase())) {
      score += 2;
    }
  }

  // Keyword match in chunk content (low weight)
  const contentLower = chunk.content.toLowerCase();
  for (const kw of keywords) {
    if (contentLower.includes(kw.toLowerCase())) {
      score += 0.5;
    }
  }

  // Category boost: planet-sign and dasha are most relevant for natal interpretation
  if (chunk.category === "planet-sign") score += 1;
  if (chunk.category === "dasha") score += 1;
  if (chunk.category === "yoga") score += 0.5;

  return score;
}

// ─── Rule-based Interpretations ───────────────────────────────────────────────

/**
 * Generate rule-based interpretation strings for the chart.
 * These are deterministic and don't need the LLM.
 */
export function generateRuleBasedInterpretations(chart: ChartDataForRAG): string[] {
  const interpretations: string[] = [];

  // Planet in sign interpretations
  for (const p of chart.planets) {
    const interp = interpretPlanetInSign(p.planet, p.sign);
    interpretations.push(`**${interp.title}**: ${interp.summary}`);
  }

  // Planet in house interpretations
  for (const p of chart.planets) {
    const interp = interpretPlanetInHouse(p.planet, p.house);
    interpretations.push(`**${interp.title}**: ${interp.summary}`);
  }

  // Aspect interpretations
  if (chart.aspects) {
    for (const a of chart.aspects) {
      const interp = interpretAspect(a.planet1, a.planet2, a.type, a.orb);
      interpretations.push(`**${interp.title}**: ${interp.summary}`);
    }
  }

  // Dasha interpretation
  if (chart.dasha) {
    const mahaDasha = DASHA_INTERPRETATIONS[chart.dasha.mahadasha.planet];
    if (mahaDasha) {
      interpretations.push(`**Current Mahadasha: ${chart.dasha.mahadasha.planet}** (${mahaDasha.duration} years): ${mahaDasha.general}`);
    }
    const antaraDasha = DASHA_INTERPRETATIONS[chart.dasha.antardasha.planet];
    if (antaraDasha) {
      interpretations.push(`**Current Antardasha: ${chart.dasha.antardasha.planet}** (${antaraDasha.duration} years): ${antaraDasha.general}`);
    }
  }

  // Nakshatra interpretations
  for (const p of chart.planets) {
    if (p.nakshatra) {
      const nakInfo = getNakshatraByName(p.nakshatra);
      if (nakInfo) {
        interpretations.push(`**${p.planet} in ${nakInfo.name} Nakshatra** (ruled by ${nakInfo.lord}, deity: ${nakInfo.deity}): ${nakInfo.interpretation}`);
      }
    }
  }

  // Yoga detection
  const yogaPlanets: YogaPlanet[] = chart.planets.map(p => ({
    planet: p.planet,
    sign: p.signIndex,
    house: p.house,
    isRetrograde: p.isRetrograde,
  }));
  const detectedYogas = detectYogas(yogaPlanets, chart.ascendant.signIndex);
  for (const dy of detectedYogas) {
    interpretations.push(`**${dy.yoga.name} (${dy.yoga.sanskrit})** [${dy.strength}]: ${dy.yoga.effects}`);
    if (dy.yoga.remedialMeasures) {
      interpretations.push(`  Remedies: ${dy.yoga.remedialMeasures}`);
    }
  }

  return interpretations;
}

// ─── Main RAG Retrieval ───────────────────────────────────────────────────────

/**
 * Retrieve the most relevant knowledge chunks for a chart + question.
 * Returns both the chunks and a formatted context string for the LLM.
 */
export function retrieveKnowledge(
  chart: ChartDataForRAG,
  question?: string,
  maxChunks: number = 15,
): RAGContext {
  const startTime = Date.now();
  const allChunks = getChunks();
  const keywords = extractKeywords(chart, question);

  // Score all chunks
  const scored = allChunks
    .map(chunk => ({ chunk, score: scoreChunk(chunk, keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  const retrievedChunks = scored.map(s => s.chunk);

  // Build context string
  const contextString = buildContextString(retrievedChunks, chart, question);

  return {
    chunks: retrievedChunks,
    contextString,
    totalChunks: allChunks.length,
    retrievalTimeMs: Date.now() - startTime,
  };
}

/**
 * Build the context string for the LLM prompt.
 */
function buildContextString(
  chunks: KnowledgeChunk[],
  chart: ChartDataForRAG,
  question?: string,
): string {
  const sections: string[] = [];

  // Rule-based interpretations (deterministic)
  const ruleBased = generateRuleBasedInterpretations(chart);
  if (ruleBased.length > 0) {
    sections.push("## Chart Interpretations (Rule-based)\n" + ruleBased.join("\n"));
  }

  // Retrieved knowledge chunks
  if (chunks.length > 0) {
    const chunkTexts = chunks.map(c =>
      `### ${c.title} (${c.source})\n${c.content}`
    );
    sections.push("## Classical Knowledge\n" + chunkTexts.join("\n\n"));
  }

  return sections.join("\n\n---\n\n");
}
