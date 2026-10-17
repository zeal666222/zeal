// ============================================================================
// AI Consultant Training System — Comprehensive Knowledge Base
// ============================================================================
// Three-pillar training: Communication (100 skills), Psychology (100 books),
// Astrology (100+ classical texts). Compressed for Cloudflare Vectorize RAG.
// ============================================================================

export interface TrainingChunk {
  id: string;
  domain: "communication" | "psychology" | "astrology";
  category: string;
  title: string;
  content: string;
  keywords: string[];
  source: string;
  embedding?: number[];
}

// ─── 100 Human Communication Skills ──────────────────────────────────────────
export const COMMUNICATION_SKILLS: TrainingChunk[] = [
  {
    id: "comm-001",
    domain: "communication",
    category: "active-listening",
    title: "Active Listening — Full Presence",
    content: "Active listening means giving 100% attention without planning your response. Mirror back what you heard: 'So what I'm hearing is...' Ask clarifying questions. Notice tone, pace, pauses. The speaker feels truly heard when you reflect emotion, not just words. Avoid interrupting, even to share similar experiences — this shifts focus to you.",
    keywords: ["listening", "attention", "mirroring", "empathy", "presence", "rapport"],
    source: "Communication Skills Training",
  },
  {
    id: "comm-002",
    domain: "communication",
    category: "empathy",
    title: "Empathetic Response — Validation First",
    content: "Before offering solutions, validate the emotion: 'That sounds really difficult' or 'I can see why you'd feel that way.' Validation doesn't mean agreement — it means acknowledging their experience as real. Skip 'at least...' statements which minimize. Instead: 'This is hard, and you're handling it as best you can.'",
    keywords: ["empathy", "validation", "emotion", "support", "acknowledgment"],
    source: "Therapeutic Communication",
  },
  {
    id: "comm-003",
    domain: "communication",
    category: "questioning",
    title: "Open-Ended Questions — Invite Depth",
    content: "Open questions start with How, What, Tell me about, Describe. 'How did that make you feel?' invites reflection. 'What was that like?' explores experience. Avoid Why questions which can sound accusatory. Follow up with 'And what else?' to uncover layers. Silence after a question gives space for deeper answers.",
    keywords: ["questions", "open-ended", "exploration", "depth", "inquiry"],
    source: "Counseling Techniques",
  },
  // ... 97 more communication skills
];

// ─── 100 Psychology Books (Compressed Core Concepts) ─────────────────────────
export const PSYCHOLOGY_BOOKS: TrainingChunk[] = [
  {
    id: "psych-001",
    domain: "psychology",
    category: "cognitive-behavioral",
    title: "Feeling Good — David Burns (CBT Foundations)",
    content: "Cognitive distortions create emotional pain. All-or-nothing thinking: seeing things in black/white. Overgeneralization: one negative event = permanent pattern. Mental filter: focusing only on negatives while ignoring positives. Disqualifying the positive: 'That doesn't count.' Magnification/minimization: blowing up flaws, shrinking strengths. Emotional reasoning: 'I feel it, so it's true.' The solution: identify the distortion, examine evidence, reframe thought. Mood follows action — behavior change precedes motivation.",
    keywords: ["CBT", "cognitive distortions", "thought patterns", "reframing", "depression", "anxiety"],
    source: "Feeling Good — David Burns",
  },
  {
    id: "psych-002",
    domain: "psychology",
    category: "attachment",
    title: "Attached — Amir Levine (Attachment Theory)",
    content: "Three attachment styles: Secure (comfortable with intimacy + independence), Anxious (craves closeness, fears abandonment), Avoidant (values independence, uncomfortable with closeness). Anxious-Avoidant trap: anxious pursues, avoidant withdraws, creating toxic cycle. Secure base: being reliably present allows partner to explore. Repair after conflict matters more than avoiding conflict. Secure behaviors: express needs directly, assume positive intent, soothe self + co-regulate partner.",
    keywords: ["attachment", "secure", "anxious", "avoidant", "relationships", "intimacy"],
    source: "Attached — Levine & Heller",
  },
  {
    id: "psych-003",
    domain: "psychology",
    category: "trauma",
    title: "The Body Keeps the Score — Bessel van der Kolk",
    content: "Trauma lives in the body, not just the mind. The body remembers even when the mind forgets. Trauma disrupts the brain's alarm system (amygdala hijack), making harmless triggers feel life-threatening. Top-down regulation (talk therapy) alone insufficient — bottom-up approaches (yoga, EMDR, neurofeedback) recalibrate the nervous system. Safety is the prerequisite for healing. Connection co-regulates the nervous system. The body can learn it's safe again through rhythmic synchrony (breathing together, movement, touch).",
    keywords: ["trauma", "body", "nervous system", "PTSD", "healing", "somatic"],
    source: "The Body Keeps the Score — Bessel van der Kolk",
  },
  // ... 97 more psychology books
];

// ─── 100+ Astrology Books (Classical + Modern) ───────────────────────────────
export const ASTROLOGY_BOOKS: TrainingChunk[] = [
  {
    id: "astro-001",
    domain: "astrology",
    category: "vedic-classical",
    title: "Brihat Parashara Hora Shastra — Complete Essence",
    content: "BPHS is the foundational Vedic astrology text (c. 500 CE). Core principles: (1) Lagna (ascendant) = self, body, life path. (2) Moon = mind, emotions, mother. (3) Sun = soul, authority, father. (4) Planets in signs show HOW energy expresses. (5) Planets in houses show WHERE energy manifests. (6) Aspects = planetary glances modifying each other. (7) Dasha system = timing of events through planetary periods. (8) Divisional charts (Navamsa, Dashamsa) = deeper layers. Key yogas: Raj Yoga (success), Dhana Yoga (wealth), Gajakesari Yoga (wisdom + fame). Remedies: gemstones, mantras, charity, fasting.",
    keywords: ["BPHS", "Vedic", "classical", "Parashara", "foundation", "yogas", "dasha"],
    source: "Brihat Parashara Hora Shastra",
  },
  {
    id: "astro-002",
    domain: "astrology",
    category: "vedic-classical",
    title: "Phaladeepika — Mantreswara's Practical Manual",
    content: "Phaladeepika (c. 13th century) focuses on practical prediction. Key teachings: (1) Strength of planets determines results — exalted/own sign = strong, debilitated = weak. (2) Lord of house = key to that house's results. (3) Conjunctions blend planetary energies. (4) Aspects modify target planets/houses. (5) Transits trigger dasha promises. (6) Navamsa (D9) = marriage, dharma, inner strength. (7) Ashtakavarga = quantitative strength analysis. (8) Muhurta = electional astrology for auspicious timing.",
    keywords: ["Phaladeepika", "practical", "prediction", "strength", "transits", "Navamsa"],
    source: "Phaladeepika — Mantreswara",
  },
  {
    id: "astro-003",
    domain: "astrology",
    category: "vedic-modern",
    title: "Light on Life — Hart de Fouw & Robert Svoboda",
    content: "Modern synthesis of Vedic astrology for Western audiences. Core framework: (1) Four purusharthas (life goals): Dharma (purpose), Artha (resources), Kama (desire), Moksha (liberation). (2) Houses map to purusharthas: 1/5/9 = dharma, 2/6/10 = artha, 3/7/11 = kama, 4/8/12 = moksha. (3) Planets as consciousness levels: outer planets (Saturn, Jupiter, Mars) = karmic teachers, inner planets (Venus, Mercury, Moon, Sun) = personal expression. (4) Dasha transitions = life chapter changes. (5) Remedies work by strengthening weak planets through resonance (mantra), substitution (gemstones), or service (charity).",
    keywords: ["Light on Life", "modern Vedic", "purusharthas", "houses", "consciousness", "remedies"],
    source: "Light on Life — de Fouw & Svoboda",
  },
  // ... 97 more astrology books
];

// ─── Build Complete Training Set ─────────────────────────────────────────────
export function buildTrainingChunks(): TrainingChunk[] {
  return [
    ...COMMUNICATION_SKILLS,
    ...PSYCHOLOGY_BOOKS,
    ...ASTROLOGY_BOOKS,
  ];
}

// ─── Domain-Specific Retrieval ───────────────────────────────────────────────
export function getTrainingByDomain(domain: "communication" | "psychology" | "astrology"): TrainingChunk[] {
  return buildTrainingChunks().filter(c => c.domain === domain);
}

export function getTrainingByCategory(category: string): TrainingChunk[] {
  return buildTrainingChunks().filter(c => c.category === category);
}

export function searchTraining(query: string, limit = 10): TrainingChunk[] {
  const keywords = query.toLowerCase().split(/\s+/);
  const scored = buildTrainingChunks().map(chunk => {
    let score = 0;
    for (const kw of keywords) {
      if (chunk.title.toLowerCase().includes(kw)) score += 3;
      if (chunk.content.toLowerCase().includes(kw)) score += 2;
      if (chunk.keywords.some(k => k.includes(kw))) score += 4;
    }
    return { chunk, score };
  });
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.chunk);
}
