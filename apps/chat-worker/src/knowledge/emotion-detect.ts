// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Real-Time Emotional State Detection
// ─────────────────────────────────────────────────────────────────────────────
// Analyzes the user's message BEFORE the AI generates a response. Detects
// emotional state, communication patterns, and underlying needs — then injects
// a psychology-grounded directive into the system prompt so the AI responds
// with appropriate emotional intelligence.
//
// This is NOT therapy — it's the same emotional awareness a skilled human
// practitioner brings to every conversation automatically.
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmotionSignal {
  /** Primary detected emotional state */
  state: EmotionState;
  /** Confidence 0-1 */
  confidence: number;
  /** What the person likely needs from this response */
  need: EmotionalNeed;
  /** Communication approach to use */
  approach: CommunicationApproach;
  /** Specific techniques to apply */
  techniques: string[];
}

export type EmotionState =
  | "anxious" | "sad" | "angry" | "confused" | "hopeless"
  | "lonely" | "guilty" | "vulnerable" | "neutral" | "curious"
  | "excited" | "frustrated" | "grieving" | "overwhelmed";

export type EmotionalNeed =
  | "certainty" | "presence" | "validation" | "clarity" | "hope"
  | "connection" | "self-compassion" | "safety" | "space" | "guidance"
  | "acknowledgment" | "permission" | "understanding";

export type CommunicationApproach =
  | "ground-first" | "validate-first" | "simplify" | "witness"
  | "explore-gently" | "match-energy" | "slow-down" | "normal-conversation";

// ─── Signal Patterns ─────────────────────────────────────────────────────────
// Each pattern maps linguistic cues to emotional states. These are derived from
// real psychology research (Gottman, Rosenberg, Burns, Linehan, etc.)

interface PatternRule {
  patterns: RegExp[];
  state: EmotionState;
  confidence: number;
  need: EmotionalNeed;
  approach: CommunicationApproach;
  techniques: string[];
}

const EMOTION_RULES: PatternRule[] = [
  // ─── Anxiety ───
  {
    patterns: [
      /\b(worried|worry|anxious|anxiety|nervous|scared|fear|panic|panicking)\b/i,
      /\b(what if|kya hoga|kya hoga agar|if something happens)\b/i,
      /\b(can'?t stop thinking|mind racing|racing thoughts|overthinking)\b/i,
      /\b(heart (is )?(racing|pounding|beating fast))\b/i,
      /\b(can'?t (sleep|breathe|relax|calm down))\b/i,
      /\b(tension|tense|restless|on edge|uneasy)\b/i,
    ],
    state: "anxious",
    confidence: 0.85,
    need: "certainty",
    approach: "ground-first",
    techniques: ["validate-anxiety", "offer-certainty", "ground-before-explore"],
  },

  // ─── Sadness / Depression ───
  {
    patterns: [
      /\b(sad|unhappy|depressed|depression|crying|cry|tears|weep)\b/i,
      /\b(don'?t (care|matter|want)|no point|what'?s the point|give up)\b/i,
      /\b(lost|empty|hollow|numb|nothing matters|feeling low)\b/i,
      /\b(dukhi|udas|akela|alone|lonely|isolated)\b/i,
      /\b(heavy (heart|chest)|can'?t get out of bed|no energy)\b/i,
    ],
    state: "sad",
    confidence: 0.8,
    need: "presence",
    approach: "witness",
    techniques: ["presence-over-solutions", "validate-pain", "normalize-feeling"],
  },

  // ─── Anger ───
  {
    patterns: [
      /\b(angry|furious|rage|pissed|mad|hate|frustrated|frustrating)\b/i,
      /\b(it'?s not fair|unfair|why me|why always me|fed up|sick of)\b/i,
      /\b(gussa|naraaz|naraz|gussa aa raha|so angry)\b/i,
      /\b(can'?t stand|can'?t take it|done with|finished with|enough)\b/i,
      /\b(they (always|never)|everyone (always|never))\b/i,
    ],
    state: "angry",
    confidence: 0.75,
    need: "validation",
    approach: "validate-first",
    techniques: ["listen-for-hurt", "don't-match-energy", "lower-voice"],
  },

  // ─── Confusion / Overwhelm ───
  {
    patterns: [
      /\b(confused|don'?t understand|lost|clueless|no idea|what do i do)\b/i,
      /\b(too much|overwhelmed|overwhelming|can'?t handle|can'?t deal)\b/i,
      /\b(everything at once|so many things|don'?t know where to start)\b/i,
      /\b(samajh nahi aa raha|kya karun|help me figure|make sense)\b/i,
    ],
    state: "confused",
    confidence: 0.7,
    need: "clarity",
    approach: "simplify",
    techniques: ["one-thing-at-a-time", "concrete-language", "small-next-step"],
  },

  // ─── Hopelessness ───
  {
    patterns: [
      /\b(nothing will (change|ever|work)|hopeless|no hope|no way out)\b/i,
      /\b(will never|can'?t ever|impossible|no point trying)\b/i,
      /\b(stuck|trapped|no escape|nowhere to go|dead end)\b/i,
      /\b(kuch nahi hoga|kabhi nahi hoga|life is pointless)\b/i,
    ],
    state: "hopeless",
    confidence: 0.85,
    need: "hope",
    approach: "explore-gently",
    techniques: ["find-exception", "small-step", "don't-argue-with-false-positivity"],
  },

  // ─── Loneliness ───
  {
    patterns: [
      /\b(lonely|alone|no one (cares|understands|listens)|isolated)\b/i,
      /\b(don'?t have anyone|no friends|no one to talk to|by myself)\b/i,
      /\b(akela|akelapan|no connection|disconnected|invisible)\b/i,
    ],
    state: "lonely",
    confidence: 0.8,
    need: "connection",
    approach: "match-energy",
    techniques: ["warm-presence", "i-am-here", "validate-loneliness"],
  },

  // ─── Guilt / Shame ───
  {
    patterns: [
      /\b(guilty|guilt|my fault|I (should|shouldn'?t have)|regret)\b/i,
      /\b(ashamed|shame|embarrassed|stupid|worthless|bad person)\b/i,
      /\b(I'?m sorry for|apologize|forgive me|let (them|everyone) down)\b/i,
      /\b(galti|sharmindagi|pachtava|should have done)\b/i,
    ],
    state: "guilty",
    confidence: 0.75,
    need: "self-compassion",
    approach: "validate-first",
    techniques: ["distinguish-guilt-shame", "channel-to-repair", "normalize-struggle"],
  },

  // ─── Vulnerability ───
  {
    patterns: [
      /\b(I'?m scared to|afraid to|don'?t know if I can|scared that)\b/i,
      /\b(trust (issues|problem)|hard to open up|don'?t share easily)\b/i,
      /\b(feeling exposed|raw|sensitive right now|fragile)\b/i,
      /\b(I'?ll be honest|truth is|secret|don'?t tell anyone)\b/i,
    ],
    state: "vulnerable",
    confidence: 0.7,
    need: "safety",
    approach: "slow-down",
    techniques: ["honor-trust", "no-judgment", "thank-for-sharing"],
  },

  // ─── Grief ───
  {
    patterns: [
      /\b(died|death|passed away|lost (him|her|them|my)|grief|grieving)\b/i,
      /\b(miss (him|her|them|my)|funeral|memorial|mourning)\b/i,
      /\b(breakup|broke up|divorce|separated|left me|ended)\b/i,
      /\b(can'?t accept|still not over|haven'?t moved on)\b/i,
    ],
    state: "grieving",
    confidence: 0.85,
    need: "presence",
    approach: "witness",
    techniques: ["presence-over-solutions", "don't-rush-grief", "validate-loss"],
  },

  // ─── Overwhelm (specific pattern) ───
  {
    patterns: [
      /\b(too much (going on|happening|on my plate)|can'?t keep up)\b/i,
      /\b(stressed|stress|pressure|deadline|burning out|burnout)\b/i,
      /\b(exhausted|tired of|drained|no bandwidth|stretching thin)\b/i,
    ],
    state: "overwhelmed",
    confidence: 0.75,
    need: "space",
    approach: "simplify",
    techniques: ["one-thing-at-a-time", "prioritize", "permission-to-rest"],
  },

  // ─── Frustration ───
  {
    patterns: [
      /\b(frustrated|annoyed|irritated|bothered|upsetting)\b/i,
      /\b(keeps happening|always happens|why does|again and again)\b/i,
      /\b(tried everything|nothing works|can'?t get through|blocked)\b/i,
    ],
    state: "frustrated",
    confidence: 0.7,
    need: "acknowledgment",
    approach: "validate-first",
    techniques: ["acknowledge-effort", "name-frustration", "explore-after-validation"],
  },

  // ─── Curiosity / Openness ───
  {
    patterns: [
      /\b(I'?m curious|wondering|interested in|want to learn|tell me about)\b/i,
      /\b(what does|how does|why does|explain|help me understand)\b/i,
      /\b(explore|discover|learn more|deep dive)\b/i,
    ],
    state: "curious",
    confidence: 0.6,
    need: "understanding",
    approach: "normal-conversation",
    techniques: ["engage-curiosity", "offer-depth", "meet-where-they-are"],
  },

  // ─── Excitement / Hope ───
  {
    patterns: [
      /\b(excited|hopeful|looking forward|can'?t wait|thrilled)\b/i,
      /\b(new beginning|fresh start|opportunity|possibility)\b/i,
      /\b(feeling good|great|amazing|wonderful|blessed)\b/i,
    ],
    state: "excited",
    confidence: 0.6,
    need: "guidance",
    approach: "match-energy",
    techniques: ["match-enthusiasm", "channel-energy", "build-on-momentum"],
  },
];

// ─── Detection Engine ────────────────────────────────────────────────────────

/**
 * Analyze a user message for emotional signals. Returns the strongest match
 * or "neutral" if no clear signal is detected.
 *
 * This runs in <0.1ms — pure regex matching, no AI call needed.
 */
export function detectEmotion(message: string): EmotionSignal {
  const text = message.trim();
  if (!text || text.length < 3) {
    return neutralSignal();
  }

  let bestMatch: { rule: PatternRule; hits: number } | null = null;

  for (const rule of EMOTION_RULES) {
    let hits = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) hits++;
    }
    if (hits > 0 && (!bestMatch || hits > bestMatch.hits)) {
      bestMatch = { rule, hits };
    }
  }

  if (!bestMatch || bestMatch.hits < 1) {
    return neutralSignal();
  }

  const { rule, hits } = bestMatch;
  // Confidence scales with number of pattern hits, capped by rule's base confidence
  const scaledConfidence = Math.min(rule.confidence, 0.4 + hits * 0.2);

  return {
    state: rule.state,
    confidence: scaledConfidence,
    need: rule.need,
    approach: rule.approach,
    techniques: rule.techniques,
  };
}

function neutralSignal(): EmotionSignal {
  return {
    state: "neutral",
    confidence: 0,
    need: "understanding",
    approach: "normal-conversation",
    techniques: [],
  };
}

// ─── Directive Builder ───────────────────────────────────────────────────────

/**
 * Build a system prompt directive from the detected emotional state.
 * This gets injected into the AI's system prompt BEFORE knowledge retrieval,
 * so the AI's response is emotionally intelligent from the start.
 */
export function buildEmotionDirective(signal: EmotionSignal): string {
  if (signal.state === "neutral" || signal.confidence < 0.3) {
    return "";
  }

  const parts: string[] = [];

  parts.push(`EMOTIONAL CONTEXT (detected from user's message — use naturally, never mention this analysis):`);
  parts.push(`The user appears to be feeling ${signal.state} (confidence: ${Math.round(signal.confidence * 100)}%).`);
  parts.push(`What they likely need right now: ${signal.need}.`);
  parts.push(`Communication approach: ${describeApproach(signal.approach)}.`);

  if (signal.techniques.length > 0) {
    parts.push(`Apply these techniques naturally: ${signal.techniques.map(describeTechnique).join("; ")}.`);
  }

  parts.push(`Remember: validate the emotion BEFORE offering any guidance. People need to feel heard before they can hear you.`);

  return parts.join("\n");
}

function describeApproach(approach: CommunicationApproach): string {
  switch (approach) {
    case "ground-first": return "Ground them in safety first — slow pace, warm tone, offer certainty before exploring the issue";
    case "validate-first": return "Validate their feeling before anything else — 'That makes sense you'd feel this way'";
    case "simplify": return "Simplify — one thing at a time, concrete language, small next step";
    case "witness": return "Be present with them — don't rush to fix, don't offer silver linings, just witness";
    case "explore-gently": return "Explore gently — ask open questions, find exceptions to hopelessness, build on small strengths";
    case "match-energy": return "Match their energy — warm and present, don't be clinical or distant";
    case "slow-down": return "Slow down — create safety, honor their vulnerability, don't push for more than they're ready to share";
    case "normal-conversation": return "Natural conversation — they're in a good place, engage authentically";
  }
}

function describeTechnique(technique: string): string {
  const TECHNIQUE_MAP: Record<string, string> = {
    "validate-anxiety": "acknowledge the anxiety is real and makes sense",
    "offer-certainty": "provide something concrete they can hold onto",
    "ground-before-explore": "ground them in safety before exploring deeper",
    "presence-over-solutions": "be present with their pain, don't jump to fixing",
    "validate-pain": "validate that their pain is real and understandable",
    "normalize-feeling": "normalize that feeling this way is human",
    "listen-for-hurt": "listen for the hurt or fear beneath the anger",
    "don't-match-energy": "don't match their intensity — stay calm and grounded",
    "lower-voice": "use slower, warmer language to co-regulate",
    "one-thing-at-a-time": "focus on one thing at a time, not the whole mountain",
    "concrete-language": "use concrete, specific language — not abstractions",
    "small-next-step": "offer one small, doable next step",
    "find-exception": "find an exception to the hopelessness — even a tiny one",
    "small-step": "suggest a small step toward what they want",
    "don't-argue-with-false-positivity": "don't argue with false positivity — sit with the difficulty first",
    "warm-presence": "be warmly present — 'I'm here with you'",
    "i-am-here": "signal that you're here and they're not alone",
    "validate-loneliness": "validate that loneliness is painful and real",
    "distinguish-guilt-shame": "distinguish guilt (I did something bad) from shame (I am bad)",
    "channel-to-repair": "channel guilt toward repair — what amends can be made",
    "normalize-struggle": "normalize that struggling with this is human",
    "honor-trust": "honor the trust it takes to share this",
    "no-judgment": "hold zero judgment — create complete safety",
    "thank-for-sharing": "acknowledge their courage in sharing",
    "don't-rush-grief": "don't rush grief — let it unfold at its own pace",
    "validate-loss": "validate that their loss is real and matters",
    "prioritize": "help them prioritize — what matters most right now",
    "permission-to-rest": "give permission to rest and not do everything",
    "acknowledge-effort": "acknowledge the effort they've already put in",
    "name-frustration": "name the frustration — 'That sounds incredibly frustrating'",
    "explore-after-validation": "only explore options after validation is complete",
    "engage-curiosity": "engage their curiosity — meet them where they are",
    "offer-depth": "offer depth and substance — they're ready for it",
    "meet-where-they-are": "meet them where they are, don't over-explain",
    "match-enthusiasm": "match their enthusiasm — be genuinely glad for them",
    "channel-energy": "channel their energy toward what matters",
    "build-on-momentum": "build on their positive momentum",
  };
  return TECHNIQUE_MAP[technique] ?? technique;
}

// ─── Conversation-Level Emotion Tracking ─────────────────────────────────────

/**
 * Track emotional trajectory across a conversation. If the user has been
 * anxious for 3 turns straight, the approach should deepen. If they've
 * shifted from sad to curious, follow the shift.
 */
export function trackEmotionalTrajectory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentSignal: EmotionSignal,
): EmotionAdjustment {
  if (history.length < 2) return { adjust: false };

  const recentUserMessages = history
    .filter(m => m.role === "user")
    .slice(-4);

  const recentSignals = recentUserMessages.map(m => detectEmotion(m.content));

  // Check for sustained state (same emotion 3+ turns)
  if (recentSignals.length >= 3) {
    const last3 = recentSignals.slice(-3);
    if (last3.every(s => s.state === currentSignal.state && s.confidence > 0.5)) {
      return {
        adjust: true,
        reason: `sustained-${currentSignal.state}`,
        adjustment: `The user has been feeling ${currentSignal.state} for multiple turns. Deepen your approach — don't repeat the same validation. Offer something more substantive: a new perspective, a small action step, or a deeper exploration of what's underneath.`,
      };
    }
  }

  // Check for emotional shift
  if (recentSignals.length >= 2) {
    const prev = recentSignals[recentSignals.length - 2];
    if (prev.state !== currentSignal.state && prev.confidence > 0.5 && currentSignal.confidence > 0.5) {
      return {
        adjust: true,
        reason: `shift-${prev.state}-to-${currentSignal.state}`,
        adjustment: `The user has shifted from ${prev.state} to ${currentSignal.state}. Follow the shift — acknowledge the change naturally ('It sounds like this is bringing up some ${currentSignal.state} feelings too'). Don't get stuck on the previous emotion.`,
      };
    }
  }

  return { adjust: false };
}

export interface EmotionAdjustment {
  adjust: boolean;
  reason?: string;
  adjustment?: string;
}
