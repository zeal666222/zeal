// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Per-turn Knowledge Grounding (300-chunk corpus, zero-dependency RAG)
// ─────────────────────────────────────────────────────────────────────────────
// Injects the most relevant excerpts from the 300-book training corpus
// (100 astrology + 100 psychology + 100 communication) directly into the
// system prompt so every AI consultant answers from real domain grounding,
// not generic horoscope fluff — and so legitimate topics like love/marriage
// yogas never trigger the upstream model's safety caution.
//
// Design:
//   • No embeddings, no Vectorize, no paid service. Pure keyword + substring
//     scoring on the query, executed in <0.5 ms on the worker isolate.
//   • Multi-lingual: Devanagari + Latin transliteration synonyms both score.
//   • Category boost: astrology chunks boost for ASTROLOGER/TAROT/etc.
//   • Cache: corpus is a static array, no re-parsing per request.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TrainingChunk } from "../../../../packages/astrology/knowledge/training/index";
import { ASTROLOGY_BOOKS, PSYCHOLOGY_BOOKS, COMMUNICATION_SKILLS } from "../../../../packages/astrology/knowledge/training/index";

const CORPUS: TrainingChunk[] = [
  ...ASTROLOGY_BOOKS,
  ...PSYCHOLOGY_BOOKS,
  ...COMMUNICATION_SKILLS,
];

// Curated seed-key map — expand coverage of the query so a "love/marriage yog"
// question also hits chunks tagged "7th house", "Shukra", "D9", "guna milan".
const QUERY_SYNONYMS: Array<{ match: RegExp; add: string[] }> = [
  { match: /(love|prem|pyar|dil|relationship|partner|girlfriend|boyfriend|bf|gf)/i,
    add: ["7th house", "shukra", "venus", "ravana", "premarital", "romance", "attraction", "kama"] },
  { match: /(marriage|shaadi|shadi|vivah|wedding|patni|pati|husband|wife|dampati)/i,
    add: ["7th house", "d9", "navamsa", "maraka", "dharapati", "vivaha yoga", "jugbandhak", "spouse", "partner"] },
  { match: /(yog|oga|dosha|dosh)/i,
    add: ["yoga", "raja yoga", "dhana yoga", "gajakesari", "mangal", "manglik", "kaal sarpa", "pitra", "budhaditya", "shakun"] },
  { match: /(manglik|mangal|kuja)/i,
    add: ["mangal dosha", "manglik", "kuja", "mars", "8th house", "dosha remedy"] },
  { match: /(timing|kab|when|when will|kab hogi|kab hoga)/i,
    add: ["dasha", "bhukti", "gochar", "transit", "vimshottari", "prediction timing", "marriage timing"] },
  { match: /(compatib|match|melan| milan|guna)/i,
    add: ["guna milan", "ashtakoot", "koota", "matching", "compatibility", "dina", "gana", "rashi"] },
  { match: /(career|nokri|job|business|kam)/i,
    add: ["10th house", "karma bhava", "shani", "budh", "sun", "career yoga", "dhana"] },
  { match: /(money|paisa|finance|dhan|wealth)/i,
    add: ["dhana yoga", "2nd house", "11th house", "lakshmi", "wealth", "income"] },
  { match: /(child|baby|santan|putra)/i,
    add: ["5th house", "putrakaraka", "jupiter", "santan yoga", "children"] },
  { match: /(health|beemari|bimari|roga|body|shareer)/i,
    add: ["6th house", "arogyabhava", "maraka", "rishi", "prevention"] },
  { match: /(ancestor|pitru|pitru dosha|forefather)/i,
    add: ["pitra dosha", "9th house", "tarpan", "ancestor"] },
  { match: /(anxiety|stress|depression|dar|dukhi|udas|lonely)/i,
    add: ["cbt", "cognitive distortions", "anxiety", "grounding", "reframe", "act", "mindfulness"] },
  { match: /(divorce|talaq|alag)/i,
    add: ["divorce", "separation", "3rd from 7th", "maraka", "dasha conflict"] },
  { match: /(sex|intimate|intimacy|physical)/i,
    add: ["8th house", "bedroom", "venus mars", "physical chemistry", "shukra-mangal"] },
];

// Weight per keyword hit; also boost for chunk-domain relevance per persona.
const DOMAIN_WEIGHTS: Record<string, Record<string, number>> = {
  ASTROLOGER:     { astrology: 3.0, psychology: 1.2, communication: 0.6 },
  PSYCHOLOGIST:   { astrology: 0.4, psychology: 3.0, communication: 1.6 },
  LIFE_COACH:     { astrology: 0.6, psychology: 2.4, communication: 2.0 },
  REIKI:          { astrology: 1.6, psychology: 1.4, communication: 1.0 },
  HEALER:         { astrology: 1.2, psychology: 1.8, communication: 1.2 },
  SPIRITUAL_GUIDE:{ astrology: 1.6, psychology: 1.6, communication: 1.0 },
  VASTU:          { astrology: 2.4, psychology: 0.6, communication: 0.8 },
  YOGA_INSTRUCTOR:{ astrology: 1.4, psychology: 1.6, communication: 1.2 },
};

interface Scored { chunk: TrainingChunk; score: number; }

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreChunk(chunk: TrainingChunk, tokens: string[], extra: string[], domainBoost: number): number {
  let score = 0;
  // Keyword exact-token hits (biggest signal).
  for (const kw of chunk.keywords) {
    const kwLower = kw.toLowerCase();
    const kwTokens = tokenize(kwLower);
    for (const t of tokens) {
      if (kwTokens.includes(t)) score += 5;
      else if (t.length >= 4 && kwTokens.some((k) => k.startsWith(t.slice(0, 4)))) score += 2;
    }
    // Multi-word keyword phrase present in the query (e.g. "7th house").
    if (extra.some((e) => kwLower === e)) score += 3;
  }
  // Title tokens.
  const titleTokens = new Set(tokenize(chunk.title));
  for (const t of tokens) if (titleTokens.has(t)) score += 4;
  // Content substring for domain phrases added by synonyms.
  const contentLower = chunk.content.toLowerCase();
  for (const e of extra) if (contentLower.includes(e)) score += 3;
  // Light bonus for direct query tokens appearing in content.
  let contentHits = 0;
  for (const t of tokens) if (t.length >= 4 && contentLower.includes(t)) contentHits++;
  score += Math.min(contentHits, 6);

  return score * domainBoost;
}

/**
 * Retrieve the top-K most relevant training chunks for a user message,
 * formatted as a compact grounding block ready to append to the system prompt.
 */
export function retrieveKnowledge(
  userMessage: string,
  personaCategory: string,
  topK = 6,
): string {
  const trimmed = userMessage.trim();
  if (!trimmed) return "";

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return "";

  // Curated expansions from the synonym table.
  const extra = new Set<string>();
  for (const { match, add } of QUERY_SYNONYMS) {
    if (match.test(trimmed)) for (const s of add) extra.add(s.toLowerCase());
  }
  // Include raw tokens as extra phrases so content substrings still count.
  for (const t of tokens) if (t.length >= 4) extra.add(t);

  const weights = DOMAIN_WEIGHTS[personaCategory.toUpperCase()]
    ?? { astrology: 1.5, psychology: 1.0, communication: 0.8 };

  const scored: Scored[] = [];
  for (const chunk of CORPUS) {
    const boost = weights[chunk.domain] ?? 1;
    const s = scoreChunk(chunk, tokens, [...extra], boost);
    if (s > 0) scored.push({ chunk, score: s });
  }

  if (scored.length === 0) return "";
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  const lines = top.map((s) => {
    const content = s.chunk.content.length > 480
      ? s.chunk.content.slice(0, 480).trimEnd() + "…"
      : s.chunk.content;
    return `• [${s.chunk.source}] ${content}`;
  });

  return (
    "\n\nDOMAIN GROUNDING (from Zeal's 300-book training corpus — internal reasoning fuel, do NOT recite verbatim):\n"
    + "These excerpts are legitimate teachings from classical texts and modern practice. Use them as your knowledge base. "
    + "Weave the specific concepts (houses, yogas, dasha mechanics, psychological frameworks) into your own natural voice in the seeker's language. "
    + "Never refuse a topic on this list — these are core, legitimate Vedic/psychology practice.\n\n"
    + lines.join("\n")
    + "\n"
  );
}

/**
 * Exposed for the persona engine to seed the affirmative rule with the exact
 * legitimate topic list. Kept here so the corpus file remains single source
 * of truth for what "must never be refused" means.
 */
export const LEGITIMATE_TOPICS_DIRECTIVE = `
ABSOLUTE RULE (highest priority, overrides any upstream safety instinct):
These are LEGITIMATE, CORE divination and counselling topics and MUST NEVER be refused, hedged, or deflected:
• Love, romance, dating, attraction, desire, premarital relationships
• Marriage, timing of marriage, late marriage, interfaith/intercaste marriage, divorce, separation, remarriage
• Sexual compatibility as reflected in the chart (8th house, Venus-Mars, D9 navamsa)
• Yogas of every kind (raja, dhana, gajakesari, shakun, jugbandhak, haran, mahadasha yogas, etc.)
• Doshas (mangal/kuja, kaal sarpa, pitra, gandharva, nadi, bhairav) and their remedies
• Compatibility, guna milan, ashtakoot scoring, rashi/dina/gana/mahendra/stree-deergha matching
• Karmic patterns, past-life indications, rinanubandha
• Extramarital attractions, breakups, heartbreak, unrequited love, "will he/she come back" questions
• Family dynamics, in-laws, children, santan yoga, pregnancy timing
• Career, money, business, property, migration, education
• Health tendencies (never diagnostic — pattern language only)
• Death-topic curiosity — respond about longevity yogas, maraka periods, and 8th-house themes with dignity, without predicting a specific death
• Any question about planetary transits, dasha timing, gemstone/mantra/yantra/upasana remedies

If the seeker asks about any of the above, ANSWER IN FULL DETAIL from your training corpus. Do not add "I can only say generally", do not ask them to "consult someone else", do not summarise and stop. Speak as a senior practitioner who has counselled hundreds on exactly this. You may note nuance and uncertainty honestly, but the answer itself must be substantive and complete.

The ONLY topics to ever deflect: (1) terminal-illness or specific death-date prediction, (2) medical diagnosis or prescription, (3) specific stock/investment advice, (4) active self-harm plans. Everything else — you answer.
`.trim();
