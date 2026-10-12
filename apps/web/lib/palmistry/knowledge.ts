// apps/web/lib/palmistry/knowledge.ts
// Comprehensive palmistry knowledge base — lines, mounts, hand types, interpretations

import type {
  HandElement, FingerShape, LineQuality, LineCurvature,
  MountDevelopment, MountName,
} from "./types";

// ─── LINE INTERPRETATIONS ──────────────────────────────────────────────────────

export const LINE_DISPLAY: Record<string, { name: string; icon: string; color: string; governs: string }> = {
  heart: { name: "Heart Line", icon: "💖", color: "#f43f5e", governs: "Emotions, Love, Relationships" },
  head: { name: "Head Line", icon: "🧠", color: "#8b5cf6", governs: "Intellect, Communication, Thinking" },
  life: { name: "Life Line", icon: "🌿", color: "#22c55e", governs: "Vitality, Energy, Life Transitions" },
  fate: { name: "Fate Line", icon: "⭐", color: "#eab308", governs: "Destiny, Career, Life Purpose" },
  sun: { name: "Sun Line", icon: "☀️", color: "#f97316", governs: "Fame, Success, Creative Fulfillment" },
  marriage: { name: "Marriage Lines", icon: "💍", color: "#ec4899", governs: "Partnerships, Significant Bonds" },
};

export const ELEMENT_TRAITS: Record<HandElement, {
  name: string; icon: string; gradient: string;
  strengths: string[]; weaknesses: string[];
  description: string;
}> = {
  fire: {
    name: "Fire Hand",
    icon: "🔥",
    gradient: "from-orange-500 to-red-500",
    strengths: ["Charismatic leader", "Boundless energy", "Creative visionary", "Natural motivator"],
    weaknesses: ["Impulsive decisions", "Restless nature", "Impatience with details"],
    description: "Fire hands reveal a passionate, dynamic spirit. You lead with your heart and inspire others with your infectious enthusiasm. Your short fingers on a long palm show you act first, think later — but your charisma carries you through.",
  },
  earth: {
    name: "Earth Hand",
    icon: "🌍",
    gradient: "from-amber-600 to-yellow-700",
    strengths: ["Unwavering reliability", "Practical wisdom", "Patient builder", "Sensual appreciation"],
    weaknesses: ["Stubborn resistance", "Overly material focus", "Slow to adapt"],
    description: "Earth hands ground you in the material world. Your broad, square palm with short fingers shows a builder's nature — you create lasting structures, both physical and relational. Your steady energy is the foundation others lean on.",
  },
  air: {
    name: "Air Hand",
    icon: "💨",
    gradient: "from-sky-400 to-cyan-400",
    strengths: ["Brilliant communicator", "Analytical mind", "Adaptive thinker", "Intellectual curiosity"],
    weaknesses: ["Over-analysis paralysis", "Emotional detachment", "Indecisive tendencies"],
    description: "Air hands mark a brilliant, communicative mind. Your square palm with long fingers reveals someone who processes the world through ideas and conversation. You thrive in intellectual exchange and bring clarity to complex situations.",
  },
  water: {
    name: "Water Hand",
    icon: "🌊",
    gradient: "from-blue-500 to-indigo-500",
    strengths: ["Deep intuition", "Profound empathy", "Artistic sensitivity", "Emotional wisdom"],
    weaknesses: ["Emotional volatility", "Oversensitivity", "Mood fluctuations"],
    description: "Water hands flow with deep emotional currents. Your long, narrow palm with tapered fingers reveals a natural empath — you feel the world deeply and create from that wellspring. Your psychic sensitivity is your greatest gift.",
  },
};

export const FINGER_SHAPE_MEANINGS: Record<FingerShape, {
  name: string; traits: string[];
}> = {
  square: {
    name: "Square Tips",
    traits: ["Methodical precision", "Rule-following nature", "Detail-oriented approach", "Practical problem-solving"],
  },
  conic: {
    name: "Conic Tips",
    traits: ["Artistic intuition", "Creative expression", "Whimsical charm", "Aesthetic sensitivity"],
  },
  spatulate: {
    name: "Spatulate Tips",
    traits: ["Entrepreneurial drive", "Active creativity", "Original thinking", "Leadership initiative"],
  },
  pointed: {
    name: "Pointed Tips",
    traits: ["Philosophical depth", "Spiritual aspiration", "Idealistic vision", "Psychic sensitivity"],
  },
};

// ─── LINE INTERPRETATION RULES ─────────────────────────────────────────────────

interface LineRule {
  condition: (l: { quality: LineQuality; length: string; curvature: LineCurvature; branches: number; breaks: number; chains: boolean; forks: number; islands: boolean }) => boolean;
  meaning: string;
  sentiment: "positive" | "neutral" | "challenging";
}

export const HEART_LINE_RULES: LineRule[] = [
  { condition: (l) => l.quality === "strong" && l.length === "long" && l.curvature === "curved", meaning: "You love deeply and express emotions freely. Your generous heart sets high ideals in relationships, and you give wholeheartedly to those you care about.", sentiment: "positive" },
  { condition: (l) => l.quality === "strong" && l.curvature === "straight", meaning: "You approach emotions with logical clarity. Your controlled feelings are a strength — you love steadily without dramatic highs and lows.", sentiment: "positive" },
  { condition: (l) => l.quality === "faint", meaning: "Your emotional nature is subtle and introspective. You feel deeply but may keep your feelings private, processing them internally before sharing.", sentiment: "neutral" },
  { condition: (l) => l.breaks > 0, meaning: "Your heart line shows periods of emotional transformation. These breaks mark significant shifts in how you love — each one leading to deeper emotional wisdom.", sentiment: "challenging" },
  { condition: (l) => l.branches > 2, meaning: "Branches from your heart line show emotional energy radiating outward. You care for many people simultaneously, though this can scatter your emotional focus.", sentiment: "neutral" },
  { condition: (l) => l.chains, meaning: "Chains at the start of your heart line suggest early emotional complexity. You may have navigated confusing feelings in youth, building emotional intelligence that serves you now.", sentiment: "challenging" },
  { condition: (l) => l.forks > 0, meaning: "A forked heart end reveals divided emotional awareness — you balance head and heart in relationships, weighing both logic and feeling before committing.", sentiment: "neutral" },
  { condition: (l) => l.islands, meaning: "Islands on your heart line mark periods of intense emotional experience. These pockets of depth brought powerful feelings that ultimately enriched your emotional landscape.", sentiment: "challenging" },
  { condition: (l) => l.length === "short", meaning: "Your concise heart line shows emotional independence. You value freedom in relationships and don't need grand romantic gestures to feel connected.", sentiment: "neutral" },
  { condition: (l) => l.quality === "strong", meaning: "A well-defined heart line reveals strong emotional awareness. You know what you feel and aren't afraid to show it to those who matter.", sentiment: "positive" },
];

export const HEAD_LINE_RULES: LineRule[] = [
  { condition: (l) => l.quality === "strong" && l.curvature === "straight", meaning: "Your mind operates with laser precision. Logical, methodical thinking is your superpower — you cut through noise to find clear solutions.", sentiment: "positive" },
  { condition: (l) => l.curvature === "curved", meaning: "A curved head line reveals a creative, intuitive thinker. Your mind naturally connects disparate ideas, making you an innovative problem-solver with artistic flair.", sentiment: "positive" },
  { condition: (l) => l.length === "long", meaning: "Your long head line shows sustained mental focus. Once engaged, your mind stays with a problem until it's solved — excellent concentration and analytical depth.", sentiment: "positive" },
  { condition: (l) => l.length === "short", meaning: "Your concise head line indicates practical, direct thinking. You prefer real-world solutions over abstract theorizing — a natural pragmatist.", sentiment: "neutral" },
  { condition: (l) => l.quality === "faint", meaning: "A lighter head line suggests a mind that processes many threads simultaneously. You may seem easily distracted, but you're actually absorbing more than others realize.", sentiment: "neutral" },
  { condition: (l) => l.breaks > 0, meaning: "Breaks in your head line mark significant shifts in thinking. Each break represents a mental evolution — a moment when your worldview transformed.", sentiment: "challenging" },
  { condition: (l) => l.forks > 0, meaning: "A forked head line (writer's fork) reveals mental flexibility. You can hold two perspectives simultaneously — both analytical and creative — making you an exceptional communicator.", sentiment: "positive" },
  { condition: (l) => l.chains, meaning: "Chains on your head line indicate periods of mental fog or indecision. These phases pass, leaving you with stronger mental clarity on the other side.", sentiment: "challenging" },
  { condition: (l) => l.islands, meaning: "Islands on your head line mark periods of intense mental activity. These can bring breakthrough insights but also mental exhaustion — balance is key.", sentiment: "challenging" },
];

export const LIFE_LINE_RULES: LineRule[] = [
  { condition: (l) => l.quality === "strong" && l.length === "long", meaning: "Your deep, sweeping life line reveals robust vitality and enduring energy. You possess remarkable resilience — life's challenges bounce off your strong constitution.", sentiment: "positive" },
  { condition: (l) => l.curvature === "curved", meaning: "A wide-arching life line shows an adventurous spirit. You embrace new experiences, love travel, and draw energy from exploring the unknown.", sentiment: "positive" },
  { condition: (l) => l.curvature === "straight", meaning: "A closer-arching life line reveals a home-centered nature. You draw strength from familiar surroundings and close relationships — your inner circle is your power source.", sentiment: "neutral" },
  { condition: (l) => l.quality === "faint", meaning: "A lighter life line suggests sensitivity over brute force. Your energy flows in gentle waves — you thrive with rest cycles and may be more attuned to subtle energies than physical exertion.", sentiment: "neutral" },
  { condition: (l) => l.breaks > 0, meaning: "Breaks in your life line mark major life transitions — relocations, career changes, or personal transformations. Each break begins a new chapter, not an ending.", sentiment: "challenging" },
  { condition: (l) => l.chains, meaning: "Chains on your life line suggest variable energy patterns. You may have had a delicate start but have developed stronger vitality through conscious self-care.", sentiment: "challenging" },
  { condition: (l) => l.islands, meaning: "Islands on your life line mark periods of reduced vitality. These are your body's signal to slow down, rest, and recharge — honoring these cycles strengthens your overall constitution.", sentiment: "challenging" },
  { condition: (l) => l.forks > 0, meaning: "Forks at the end of your life line show energy divided between home life and public achievement. You balance personal and professional worlds with dynamic versatility.", sentiment: "neutral" },
  { condition: (l) => l.branches > 2, meaning: "Branches from your life line show energy extending into multiple life areas. You're a multi-passionate person who refuses to choose just one path.", sentiment: "positive" },
];

export const FATE_LINE_RULES: LineRule[] = [
  { condition: (l) => l.quality === "strong" && l.length === "long", meaning: "A strong fate line reveals a clear sense of purpose. You know your calling and move through life with directed intention — destiny guides your steps.", sentiment: "positive" },
  { condition: (l) => l.quality === "absent" || !true, meaning: "No visible fate line doesn't mean lack of destiny — it means you forge your own path. You're not bound by predetermined routes; you create your destiny through choices.", sentiment: "positive" },
  { condition: (l) => l.quality === "faint", meaning: "A subtle fate line suggests flexibility in your life direction. You adapt your path as opportunities arise, preferring organic growth over rigid planning.", sentiment: "neutral" },
  { condition: (l) => l.breaks > 0, meaning: "Breaks in your fate line mark career pivots and life direction changes. Each break opens a new professional chapter — you evolve rather than stagnate.", sentiment: "challenging" },
  { condition: (l) => l.curvature === "wavy", meaning: "A wavy fate line shows many changes in direction. Your career path is anything but linear — you explore multiple fields before finding your true calling.", sentiment: "neutral" },
  { condition: (l) => l.islands, meaning: "Islands on your fate line mark periods of career confusion or stagnation. These phases feel stuck but are actually incubation periods for your next breakthrough.", sentiment: "challenging" },
  { condition: (l) => l.forks > 0, meaning: "Forks in your fate line show diversification — you branch into multiple income streams or career paths simultaneously, building a rich professional tapestry.", sentiment: "positive" },
];

export const SUN_LINE_RULES: LineRule[] = [
  { condition: (l) => l.quality === "strong", meaning: "A clear Sun line reveals strong potential for public recognition. Your creative gifts are meant to be seen — you thrive when your work reaches an audience.", sentiment: "positive" },
  { condition: (l) => l.quality === "faint", meaning: "A subtle Sun line suggests your success comes through quiet, consistent effort rather than public acclaim. Your satisfaction is internal, not dependent on applause.", sentiment: "neutral" },
  { condition: (l) => l.quality === "absent" || !true, meaning: "No visible Sun line means your fulfillment comes from private achievement. You don't need external validation — your creative satisfaction is self-sustaining.", sentiment: "neutral" },
  { condition: (l) => l.breaks > 0, meaning: "Breaks in your Sun line mark periods when recognition fades temporarily. These pauses rebuild your creative energy for an even brighter emergence.", sentiment: "challenging" },
];

export const MARRIAGE_LINE_RULES: LineRule[] = [
  { condition: (l) => l.quality === "strong" && l.length === "long", meaning: "A deep, clear marriage line indicates a significant, enduring partnership. This bond will be a cornerstone of your emotional life.", sentiment: "positive" },
  { condition: (l) => l.quality === "faint", meaning: "A subtle marriage line suggests relationships that develop slowly and quietly. Deep connections form beneath the surface before becoming visible to the world.", sentiment: "neutral" },
  { condition: (l) => l.breaks > 0, meaning: "Breaks in marriage lines show periods of relationship transformation. These disruptions, while painful, lead to stronger bonds when both partners commit to growth.", sentiment: "challenging" },
  { condition: (l) => l.branches > 1, meaning: "Multiple branches suggest a rich emotional life with several significant connections. Each bond teaches you something unique about love.", sentiment: "neutral" },
];

export const LINE_RULES_MAP: Record<string, LineRule[]> = {
  heart: HEART_LINE_RULES,
  head: HEAD_LINE_RULES,
  life: LIFE_LINE_RULES,
  fate: FATE_LINE_RULES,
  sun: SUN_LINE_RULES,
  marriage: MARRIAGE_LINE_RULES,
};

// ─── MOUNT INTERPRETATIONS ─────────────────────────────────────────────────────

export const MOUNT_KNOWLEDGE: Record<MountName, {
  name: string; planet: string; icon: string;
  governs: string;
  interpretations: Record<MountDevelopment, string>;
}> = {
  venus: {
    name: "Mount of Venus", planet: "Venus", icon: "♀️",
    governs: "Love, Vitality, Compassion, Sensuality",
    interpretations: {
      over_developed: "Your Venus mount is exceptionally full — you radiate warmth and magnetism. Love of beauty, art, and pleasure defines your approach to life. Beware of overindulgence.",
      well_developed: "A well-developed Venus mount shows vibrant vitality and genuine warmth. You love life and express affection generously. Your compassion draws people to you naturally.",
      moderate: "Your Venus mount shows balanced emotional warmth. You appreciate beauty and connection without being ruled by them.",
      flat: "A flatter Venus mount suggests you channel energy into intellectual or spiritual pursuits over sensual ones. You love deeply but express it through actions, not physical affection.",
    },
  },
  jupiter: {
    name: "Mount of Jupiter", planet: "Jupiter", icon: "♃",
    governs: "Leadership, Ambition, Confidence, Spirituality",
    interpretations: {
      over_developed: "Your Jupiter mount reveals commanding presence and strong leadership instincts. Others naturally look to you for direction. Watch for pride becoming arrogance.",
      well_developed: "A strong Jupiter mount shows natural leadership and healthy ambition. You lead with honor and inspire confidence in others. Spiritual depth guides your decisions.",
      moderate: "Your Jupiter mount shows balanced confidence. You step up when needed without needing to dominate every situation.",
      flat: "A flatter Jupiter mount suggests humility over ambition. You prefer collaboration over hierarchy and find leadership uncomfortable but possible when purpose demands it.",
    },
  },
  saturn: {
    name: "Mount of Saturn", planet: "Saturn", icon: "♄",
    governs: "Wisdom, Discipline, Responsibility, Introspection",
    interpretations: {
      over_developed: "Your Saturn mount reveals deep philosophical wisdom and serious introspection. You carry old-soul energy. Beware of melancholy — lighten your perspective.",
      well_developed: "A well-developed Saturn mount shows excellent judgment and natural wisdom. You're the person others consult for thoughtful advice. Discipline is your superpower.",
      moderate: "Your Saturn mount shows balanced seriousness. You know when to be disciplined and when to let go.",
      flat: "A flatter Saturn mount suggests you prefer living in the moment over deep introspection. You're spontaneous and light-hearted — a refreshing contrast to heavy thinkers.",
    },
  },
  apollo: {
    name: "Mount of Apollo", planet: "Apollo", icon: "☀️",
    governs: "Creativity, Happiness, Fame, Artistic Talent",
    interpretations: {
      over_developed: "Your Apollo mount blazes with creative fire. You're destined for the spotlight — art, performance, or public recognition calls to you. Your charm is magnetic.",
      well_developed: "A strong Apollo mount reveals genuine creative brilliance and natural happiness. You bring joy to others and have artistic gifts that deserve expression.",
      moderate: "Your Apollo mount shows balanced creative energy. You appreciate art and beauty without needing constant creative output.",
      flat: "A flatter Apollo mount suggests you find happiness in quiet achievement rather than public recognition. Your creative satisfaction is personal, not performative.",
    },
  },
  mercury: {
    name: "Mount of Mercury", planet: "Mercury", icon: "☿",
    governs: "Communication, Intelligence, Commerce, Wit",
    interpretations: {
      over_developed: "Your Mercury mount reveals razor-sharp intellect and eloquent communication. You think fast, speak well, and have natural business acumen. Watch for manipulation.",
      well_developed: "A strong Mercury mount shows excellent communication skills and quick intelligence. You express ideas clearly and have a natural gift for commerce and negotiation.",
      moderate: "Your Mercury mount shows balanced communication. You speak when you have something worth saying and listen well.",
      flat: "A flatter Mercury mount suggests you communicate through action rather than words. You may be quieter but your actions speak volumes.",
    },
  },
  moon: {
    name: "Mount of Moon", planet: "Moon", icon: "☽",
    governs: "Imagination, Intuition, Dreams, Subconscious",
    interpretations: {
      over_developed: "Your Moon mount blazes with imagination and psychic sensitivity. Dreams come vividly to you, and your intuition is almost supernatural. Ground yourself regularly.",
      well_developed: "A strong Moon mount reveals rich imagination and strong intuitive gifts. You dream creatively and trust your inner knowing. Artistic vision flows naturally.",
      moderate: "Your Moon mount shows balanced imagination. You dream but stay grounded — practical creativity is your style.",
      flat: "A flatter Moon mount suggests you prioritize the tangible over the abstract. You're practical and present-focused, which brings stability.",
    },
  },
  mars_positive: {
    name: "Mount of Mars (Positive)", planet: "Mars", icon: "♂",
    governs: "Physical Courage, Endurance, Resilience",
    interpretations: {
      over_developed: "Your Mars mount reveals fierce physical courage and unstoppable determination. You fight for what you believe in with unwavering resolve. Channel this energy constructively.",
      well_developed: "A strong Mars mount shows genuine courage and physical stamina. You face challenges head-on with moral strength and resilience.",
      moderate: "Your Mars mount shows balanced courage. You stand your ground when it matters without seeking conflict.",
      flat: "A flatter Mars mount suggests you prefer diplomacy over confrontation. Peace is your default, and you avoid unnecessary battles.",
    },
  },
  mars_negative: {
    name: "Mount of Mars (Negative)", planet: "Mars", icon: "♂",
    governs: "Moral Courage, Justice, Composure",
    interpretations: {
      over_developed: "Your Mars (Negative) mount reveals unshakeable moral courage. You stand for justice even when it's unpopular. Your composure in crisis is remarkable.",
      well_developed: "A strong Mars (Negative) mount shows excellent moral fiber and composure under pressure. You do what's right with calm determination.",
      moderate: "Your Mars (Negative) mount shows balanced ethical strength. You have principles and generally follow them.",
      flat: "A flatter Mars (Negative) mount suggests you're flexible with rules and conventions. You adapt your ethics to the situation rather than following rigid codes.",
    },
  },
};
