// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Per-turn Knowledge Grounding (~340-chunk corpus, zero-dependency RAG)
// ─────────────────────────────────────────────────────────────────────────────
// Injects the most relevant excerpts from the training corpus (astrology +
// psychology + communication + tarot + numerology + palmistry + healing)
// directly into the system prompt so every AI consultant answers from real
// domain grounding, not generic horoscope fluff — and so legitimate topics
// like love/marriage yogas never trigger the upstream model's safety caution.
//
// Design:
//   • No embeddings, no Vectorize, no paid service. Pure keyword + substring
//     scoring on the query, executed in <0.5 ms on the worker isolate.
//   • Multi-lingual: Devanagari + Latin transliteration synonyms both score.
//   • Category boost: each category gets domain weights; consultant
//     specialties add a per-persona boost on top.
//   • Cache: corpus is a static array, no re-parsing per request.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TrainingChunk } from "../../../../packages/astrology/knowledge/training/index";
import {
  ASTROLOGY_BOOKS,
  PSYCHOLOGY_BOOKS,
  HUMAN_PSYCHOLOGY,
  EMOTIONAL_DEPTH,
  CHAT_STYLE,
  COMMUNICATION_SKILLS,
  TAROT_BOOKS,
  NUMEROLOGY_BOOKS,
  PALMISTRY_BOOKS,
  HEALING_BOOKS,
} from "../../../../packages/astrology/knowledge/training/index";

const CORPUS: TrainingChunk[] = [
  ...ASTROLOGY_BOOKS,
  ...PSYCHOLOGY_BOOKS,
  ...HUMAN_PSYCHOLOGY,
  ...EMOTIONAL_DEPTH,
  ...CHAT_STYLE,
  ...COMMUNICATION_SKILLS,
  ...TAROT_BOOKS,
  ...NUMEROLOGY_BOOKS,
  ...PALMISTRY_BOOKS,
  ...HEALING_BOOKS,
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
  // ─── Psychology & Emotion Patterns ───
  { match: /(scared|fear|afraid|darr|bhay|phobia|panic)/i,
    add: ["anxiety", "grounding", "window of tolerance", "co-regulation", "safety", "breath", "4-7-8"] },
  { match: /(angry|gussa|naraaz|furious|rage|frustrat)/i,
    add: ["listen for hurt", "validate first", "secondary emotion", "don't match energy", "de-escalation"] },
  { match: /(sad|crying|cry|tears|unhappy|depressed|low|down|dukhi)/i,
    add: ["presence over solutions", "witness", "validate pain", "normalize feeling", "grief"] },
  { match: /(confused|lost|don'?t know|samajh nahi|kya karun|overwhelm|too much)/i,
    add: ["simplify", "one thing at a time", "concrete language", "small next step", "scaling questions"] },
  { match: /(hopeless|no point|no hope|give up|stuck|trapped|kuch nahi)/i,
    add: ["find exception", "small step", "miracle question", "solution-focused", "post-traumatic growth"] },
  { match: /(lonely|alone|akela|no one|isolated|disconnected)/i,
    add: ["connection", "warm presence", "bid for connection", "turning toward", "trust battery"] },
  { match: /(guilt|guilty|shame|ashamed|sorry|fault|galti|sharminda)/i,
    add: ["guilt vs shame", "self-compassion", "channel to repair", "inner critic", "distinguish"] },
  { match: /(relationship|fight|argue|argument|conflict|partner|spouse|husband|wife)/i,
    add: ["attachment", "four horsemen", "gentle startup", "repair attempts", "bid for connection", "5:1 ratio"] },
  { match: /(trust|betray|cheat|lied|lying|broken trust)/i,
    add: ["trust battery", "attachment", "repair checklist", "vulnerability", "rebuild"] },
  { match: /(breakup|broke up|left me|dumped|divorce|separated|ex)/i,
    add: ["grief", "attachment protest", "anxious-avoidant", "loss", "reconstruction", "stages of grief"] },
  { match: /(parent|mother|father|mom|dad|maa|papa|family|in-law)/i,
    add: ["attachment", "parent-adult child", "differentiation", "boundaries", "joint family", "inner child"] },
  { match: /(career|job|work|nokri|profession|boss|colleague)/i,
    add: ["protean career", "quarter-life crisis", "mid-life reckoning", "identity", "values", "burnout"] },
  { match: /(decision|choose|confused about|what should|should I)/i,
    add: ["paradox of choice", "loss aversion", "values", "miracle question", "scaling questions"] },
  { match: /(sleep|insomnia|can'?t sleep|tired|exhausted|fatigue)/i,
    add: ["sleep psychology", "stress bucket", "foundations", "breath", "window of tolerance"] },
  { match: /(past|childhood|grew up|used to|when I was|trauma|abuse)/i,
    add: ["attachment", "repetition compulsion", "core wounds", "shadow", "inner child", "schema"] },
  { match: /(change|habit|addiction|stop doing|quit|can'?t stop)/i,
    add: ["stages of change", "habit loop", "atomic habits", "urge surfing", "motivational interviewing"] },
  { match: /(worthless|not good enough|imposter|failure|can'?t do|useless)/i,
    add: ["self-worth", "imposter syndrome", "core wounds", "inner critic", "self-compassion", "strengths"] },
  { match: /(meaning|purpose|why me|what for|point of life|existential)/i,
    add: ["meaning-making", "PERMA", "logotherapy", "existential", "will to meaning", "Frankl"] },
  { match: /(calm|peace|meditat|mindful|relax|breathe|shanti)/i,
    add: ["mindfulness", "RAIN", "breath", "4-7-8", "grounding", "window of tolerance", "co-regulation"] },
];

// Weight per keyword hit; also boost for chunk-domain relevance per persona.
const DOMAIN_WEIGHTS: Record<string, Record<string, number>> = {
  ASTROLOGER:     { astrology: 3.0, psychology: 1.2, communication: 0.6 },
  TAROT:          { tarot: 3.2, astrology: 1.0, psychology: 1.4, communication: 0.6 },
  NUMEROLOGIST:   { numerology: 3.2, astrology: 1.0, psychology: 1.2, communication: 0.6 },
  PALMIST:        { palmistry: 3.2, astrology: 1.0, psychology: 1.2, communication: 0.6 },
  PSYCHOLOGIST:   { astrology: 0.4, psychology: 3.0, communication: 1.6 },
  LIFE_COACH:     { astrology: 0.6, psychology: 2.4, communication: 2.0 },
  REIKI:          { healing: 2.8, astrology: 1.4, psychology: 1.4, communication: 1.0 },
  HEALER:         { healing: 2.8, astrology: 1.0, psychology: 1.8, communication: 1.2 },
  SPIRITUAL_GUIDE:{ astrology: 1.6, healing: 1.2, psychology: 1.6, communication: 1.0 },
  VASTU:          { astrology: 2.4, psychology: 0.6, communication: 0.8 },
  YOGA_INSTRUCTOR:{ astrology: 1.4, healing: 1.4, psychology: 1.6, communication: 1.2 },
};

interface Scored { chunk: TrainingChunk; score: number; }

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreChunk(chunk: TrainingChunk, tokens: string[], extra: string[], domainBoost: number, specialtyTerms: string[]): number {
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

  // Per-consultant specialty boost — a tarot reader tagged "Celtic Cross"
  // outranks a generic chunk on the same query.
  if (specialtyTerms.length > 0) {
    let specHits = 0;
    for (const spec of specialtyTerms) {
      if (
        chunk.keywords.some((k) => k.toLowerCase().includes(spec)) ||
        chunk.title.toLowerCase().includes(spec) ||
        contentLower.includes(spec)
      ) specHits++;
    }
    if (specHits > 0) score *= 1 + Math.min(specHits, 3) * 0.3;
  }

  return score * domainBoost;
}

/**
 * Retrieve the top-K most relevant training chunks for a user message,
 * formatted as a compact grounding block ready to append to the system prompt.
 * `specialtyTerms` (the consultant's specialties from D1) tilts retrieval
 * toward that consultant's declared expertise.
 */
export function retrieveKnowledge(
  userMessage: string,
  personaCategory: string,
  topK = 6,
  specialtyTerms?: string[],
): string {
  const trimmed = userMessage.trim();
  if (!trimmed) return "";

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return "";

  const specialties = (specialtyTerms ?? [])
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length >= 3);

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
    const s = scoreChunk(chunk, tokens, [...extra], boost, specialties);
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
