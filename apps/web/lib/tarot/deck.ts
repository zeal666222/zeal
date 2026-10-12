// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Complete Tarot Deck (78 cards: 22 Major + 56 Minor Arcana)
// ═══════════════════════════════════════════════════════════════════════════════
// Each card has upright/reversed meanings, element, numerology, and symbolism.
// Used by the gamified tarot reading page for accurate, rich interpretations.
// ═══════════════════════════════════════════════════════════════════════════════

export type TarotSuit = "wands" | "cups" | "swords" | "pentacles";
export type TarotElement = "fire" | "water" | "air" | "earth";

export interface TarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: TarotSuit;
  number: number;
  element?: TarotElement;
  symbol: string;
  keywords: string[];
  upright: string;
  reversed: string;
  description: string;
}

// ─── Major Arcana (22 cards) ──────────────────────────────────────────────────

export const MAJOR_ARCANA: TarotCard[] = [
  {
    id: "major-0", name: "The Fool", arcana: "major", number: 0,
    symbol: "\ud83c\udccf", element: "air",
    keywords: ["beginnings", "innocence", "spontaneity", "leap of faith"],
    upright: "New beginnings, innocence, spontaneity, a free spirit. You stand at the edge of a great adventure. Trust the journey.",
    reversed: "Recklessness, risk-taking, holding back from a leap you need to take. Fear of the unknown is keeping you small.",
    description: "The Fool steps off a cliff with eyes turned skyward \u2014 pure trust, pure potential.",
  },
  {
    id: "major-1", name: "The Magician", arcana: "major", number: 1,
    symbol: "\ud83c\udfaf", element: "air",
    keywords: ["manifestation", "willpower", "skill", "resourcefulness"],
    upright: "Manifestation, willpower, skill. You have everything you need. Channel your focus and act with intention.",
    reversed: "Manipulation, untapped talents, trickery. Your gifts are scattered or being misused. Reclaim your power.",
    description: "As above, so below. The Magician channels the four elements through sheer will.",
  },
  {
    id: "major-2", name: "The High Priestess", arcana: "major", number: 2,
    symbol: "\ud83c\udf19", element: "water",
    keywords: ["intuition", "mystery", "inner wisdom", "the subconscious"],
    upright: "Intuition, mystery, inner knowledge. The answer you seek is within. Be still and listen to your deeper knowing.",
    reversed: "Secrets, withdrawal, disconnection from intuition. You're ignoring your inner voice. Surface noise is drowning out wisdom.",
    description: "She sits between the pillars of light and shadow, keeper of what cannot be spoken.",
  },
  {
    id: "major-3", name: "The Empress", arcana: "major", number: 3,
    symbol: "\ud83d\udc51", element: "earth",
    keywords: ["abundance", "nurturing", "fertility", "nature"],
    upright: "Abundance, nurturing, fertility, beauty. A time of growth and creation. Connect with nature and your senses.",
    reversed: "Creative block, dependence, neglecting self-care. You've been giving from an empty cup. Refill first.",
    description: "The mother of the deck \u2014 abundance flows where she walks.",
  },
  {
    id: "major-4", name: "The Emperor", arcana: "major", number: 4,
    symbol: "\u2694\ufe0f", element: "fire",
    keywords: ["authority", "structure", "stability", "leadership"],
    upright: "Authority, structure, control, father figure. Establish order and take command of your situation with confidence.",
    reversed: "Tyranny, rigidity, loss of control. Too much structure suffocates. Bend before you break.",
    description: "He sits on a stone throne \u2014 unyielding, structured, the architect of empires.",
  },
  {
    id: "major-5", name: "The Hierophant", arcana: "major", number: 5,
    symbol: "\ud83d\udcff", element: "earth",
    keywords: ["tradition", "conformity", "education", "spiritual wisdom"],
    upright: "Tradition, spiritual wisdom, education, institutions. Seek a teacher or return to foundational practices.",
    reversed: "Rebellion, unorthodox approaches, questioning authority. The old ways no longer serve you. Find your own path.",
    description: "Bridge between heaven and earth, keeper of sacred tradition.",
  },
  {
    id: "major-6", name: "The Lovers", arcana: "major", number: 6,
    symbol: "\ud83d\udc95", element: "air",
    keywords: ["love", "harmony", "choices", "alignment"],
    upright: "Love, harmony, partnerships, value alignment. A meaningful choice approaches \u2014 choose with your heart and values.",
    reversed: "Disharmony, imbalance, misalignment. A relationship or decision feels off. Re-examine what you truly value.",
    description: "Two figures beneath an angel \u2014 the sacred choice between paths.",
  },
  {
    id: "major-7", name: "The Chariot", arcana: "major", number: 7,
    symbol: "\ud83c\udfc7", element: "water",
    keywords: ["determination", "willpower", "victory", "control"],
    upright: "Determination, willpower, victory through control. Harness opposing forces and drive forward with focus.",
    reversed: "Lack of direction, aggression, feeling out of control. You're pulling in too many directions. Choose one path.",
    description: "Two sphinxes pull in different directions \u2014 only the charioteer's will unites them.",
  },
  {
    id: "major-8", name: "Strength", arcana: "major", number: 8,
    symbol: "\ud83e\udd81", element: "fire",
    keywords: ["courage", "patience", "compassion", "inner strength"],
    upright: "Courage, patience, compassion, gentle strength. True power is soft. Tame your fears with love, not force.",
    reversed: "Self-doubt, weakness, insecurity. You're being harder on yourself than the situation demands. Find your gentle core.",
    description: "A woman gently closes a lion's mouth \u2014 compassion conquers where force fails.",
  },
  {
    id: "major-9", name: "The Hermit", arcana: "major", number: 9,
    symbol: "\ud83c\udfee", element: "earth",
    keywords: ["solitude", "introspection", "inner guidance", "wisdom"],
    upright: "Solitude, introspection, inner guidance. Step back from the noise. The answers you seek are found in stillness.",
    reversed: "Isolation, loneliness, withdrawal. Solitude has become exile. It's time to reconnect with the world.",
    description: "An old man holds his lantern on a mountaintop \u2014 light for those who seek.",
  },
  {
    id: "major-10", name: "Wheel of Fortune", arcana: "major", number: 10,
    symbol: "\ud83c\udfa1", element: "fire",
    keywords: ["cycles", "destiny", "turning point", "luck"],
    upright: "Cycles, destiny, a turning point. The wheel turns \u2014 what was down rises. Embrace change as the natural order.",
    reversed: "Bad luck, resistance to change, feeling stuck. You're fighting the turn. Surrender to the cycle.",
    description: "The great wheel spins \u2014 what rises must descend, what falls shall rise again.",
  },
  {
    id: "major-11", name: "Justice", arcana: "major", number: 11,
    symbol: "\u2696\ufe0f", element: "air",
    keywords: ["truth", "fairness", "karma", "accountability"],
    upright: "Truth, fairness, karmic justice. Actions have consequences \u2014 and rewards. The truth will be seen.",
    reversed: "Unfairness, dishonesty, avoiding accountability. Something is out of balance. Own your part in it.",
    description: "She holds the sword of truth and the scales of karma \u2014 nothing escapes either.",
  },
  {
    id: "major-12", name: "The Hanged Man", arcana: "major", number: 12,
    symbol: "\ud83d\udd2e", element: "water",
    keywords: ["surrender", "new perspective", "letting go", "pause"],
    upright: "Surrender, new perspective, letting go. Sometimes you must hang upside down to see clearly. Pause and shift your view.",
    reversed: "Stalling, resistance, unnecessary sacrifice. You're stuck because you refuse to let go of something.",
    description: "Suspended by one foot, he sees the world inverted \u2014 and finally understands.",
  },
  {
    id: "major-13", name: "Death", arcana: "major", number: 13,
    symbol: "\ud83e\udd8b", element: "water",
    keywords: ["transformation", "endings", "transition", "rebirth"],
    upright: "Transformation, endings that lead to rebirth. Something must die for something new to live. This is not loss \u2014 it is metamorphosis.",
    reversed: "Resistance to change, stagnation, fear of endings. You're clinging to what's already gone. Release it.",
    description: "Not physical death, but the death of who you were \u2014 the butterfly emerging.",
  },
  {
    id: "major-14", name: "Temperance", arcana: "major", number: 14,
    symbol: "\ud83c\udffa", element: "fire",
    keywords: ["balance", "moderation", "patience", "harmony"],
    upright: "Balance, moderation, patience, purpose. Mix opposing forces with care. The middle path leads to peace.",
    reversed: "Imbalance, excess, impatience. You've gone too far in one direction. Recalibrate.",
    description: "An angel pours water between two cups \u2014 the art of perfect balance.",
  },
  {
    id: "major-15", name: "The Devil", arcana: "major", number: 15,
    symbol: "\ud83d\udd25", element: "earth",
    keywords: ["shadow", "attachment", "addiction", "restriction"],
    upright: "Shadow self, attachment, addiction, restriction. Examine what binds you. The chains are looser than you think \u2014 you could remove them.",
    reversed: "Releasing limiting beliefs, breaking free, facing your shadow. You're beginning to see the cage for what it is.",
    description: "The chains around their necks are loose \u2014 they could leave at any time. Why don't they?",
  },
  {
    id: "major-16", name: "The Tower", arcana: "major", number: 16,
    symbol: "\u26a1", element: "fire",
    keywords: ["upheaval", "revelation", "sudden change", "awakening"],
    upright: "Sudden upheaval, revelation, awakening. What was built on false foundations crumbles. The destruction is necessary liberation.",
    reversed: "Avoiding disaster, delaying the inevitable, fear of change. The tower still stands, but the cracks are visible.",
    description: "Lightning strikes the tower \u2014 what was built on lies cannot stand.",
  },
  {
    id: "major-17", name: "The Star", arcana: "major", number: 17,
    symbol: "\u2b50", element: "air",
    keywords: ["hope", "faith", "renewal", "inspiration"],
    upright: "Hope, faith, renewal, serenity. After the storm, the star appears. Trust that the universe is guiding you toward healing.",
    reversed: "Despair, lack of faith, disconnection from hope. You've lost sight of the light. It's still there \u2014 look up.",
    description: "A naked woman pours living water under an infinite sky of stars.",
  },
  {
    id: "major-18", name: "The Moon", arcana: "major", number: 18,
    symbol: "\ud83c\udf19", element: "water",
    keywords: ["illusion", "fear", "subconscious", "intuition"],
    upright: "Illusion, fear, the subconscious, intuition. Not everything is as it seems. Trust your instincts through the fog.",
    reversed: "Release of fear, clarity emerging, confronting the subconscious. The fog is lifting. Face what you've been avoiding.",
    description: "A path between two towers, a wolf and dog howling \u2014 the landscape of dreams and fears.",
  },
  {
    id: "major-19", name: "The Sun", arcana: "major", number: 19,
    symbol: "\u2600\ufe0f", element: "fire",
    keywords: ["joy", "success", "vitality", "confidence"],
    upright: "Joy, success, vitality, confidence. Everything the light touches is yours. Celebrate, create, shine.",
    reversed: "Temporary sadness, dimmed confidence, inner child wounds. The sun is behind the clouds, not gone. Tend to your inner child.",
    description: "A child rides naked in the sunlight \u2014 pure joy, pure being.",
  },
  {
    id: "major-20", name: "Judgement", arcana: "major", number: 20,
    symbol: "\ud83d\udcef", element: "fire",
    keywords: ["rebirth", "calling", "reckoning", "absolution"],
    upright: "Rebirth, inner calling, reckoning. A higher version of yourself is asking to be born. Answer the call.",
    reversed: "Self-doubt, refusal of the call, harsh self-judgement. You're judging yourself by old standards. Forgive and rise.",
    description: "An angel sounds the trumpet \u2014 the dead rise, not in horror, but in recognition.",
  },
  {
    id: "major-21", name: "The World", arcana: "major", number: 21,
    symbol: "\ud83c\udf0d", element: "earth",
    keywords: ["completion", "integration", "accomplishment", "wholeness"],
    upright: "Completion, integration, accomplishment, travel. A great cycle closes. You've arrived \u2014 celebrate, then begin again.",
    reversed: "Incompletion, shortcuts, seeking closure. Something remains unfinished. Don't leave before the lesson is learned.",
    description: "A dancer within a laurel wreath \u2014 the world complete, the dance eternal.",
  },
];

// ─── Minor Arcana (56 cards) ──────────────────────────────────────────────────

const MINOR_MEANINGS: Record<TarotSuit, { element: TarotElement; theme: string; keywords: string[][] }> = {
  wands: {
    element: "fire",
    theme: "passion, creativity, action, ambition",
    keywords: [
      ["inspiration", "new opportunity"], ["planning", "decisions"], ["expansion", "foresight"],
      ["celebration", "harmony"], ["conflict", "competition"], ["victory", "recognition"],
      ["bravery", " confrontation"], ["speed", "momentum"], ["resilience", "persistence"],
      ["burden", "responsibility"], ["creativity", "invention"], ["action", "initiative"],
    ],
  },
  cups: {
    element: "water",
    theme: "emotions, relationships, love, intuition",
    keywords: [
      ["new love", "emotional beginning"], ["partnership", "connection"], ["celebration", "friendship"],
      ["apathy", "reevaluation"], ["loss", "grief"], ["nostalgia", "memories"],
      ["fantasy", "imagination"], ["withdrawal", "self-care"], ["fulfillment", "satisfaction"],
      ["harmony", "alignment"], ["creativity", "expression"], ["emotional mastery", "joy"],
    ],
  },
  swords: {
    element: "air",
    theme: "thought, communication, conflict, truth",
    keywords: [
      ["clarity", "breakthrough"], ["difficult choices", "tension"], ["heartbreak", "sorrow"],
      ["rest", " recuperation"], ["conflict", "disagreement"], ["transition", "change"],
      ["deception", "strategy"], ["restriction", "limitation"], ["anxiety", "worry"],
      ["ending", "release"], ["truth", "intellect"], ["mental clarity", "resolution"],
    ],
  },
  pentacles: {
    element: "earth",
    theme: "material world, work, finances, health",
    keywords: [
      ["opportunity", "prosperity"], ["balance", "adaptation"], ["skill", "craftsmanship"],
      ["security", "conservation"], ["disruption", "change"], ["generosity", "giving"],
      ["patience", "investment"], [" diligence", "effort"], ["self-sufficiency", "independence"],
      ["inheritance", "legacy"], ["abundance", "luxury"], ["manifestation", "wealth"],
    ],
  },
};

const SUIT_SYMBOLS: Record<TarotSuit, string[]> = {
  wands:      ["\ud83d\udd25", "\ud83c\udf31", "\ud83d\ude80", "\ud83c\udf3b", "\u2694\ufe0f", "\ud83c\udfc6", "\ud83d\udee1\ufe0f", "\u26a1", "\ud83d\udcaa", "\ud83c\udfcb\ufe0f", "\ud83c\udfa8", "\ud83c\udf1f"],
  cups:       ["\ud83d\udc97", "\ud83e\udd1d", "\ud83c\udf89", "\ud83d\udca7", "\ud83d\udc94", "\ud83c\udfad", "\ud83e\udd84", "\ud83c\udf0a", "\ud83d\ude0a", "\ud83d\udc95", "\ud83c\udfa8", "\ud83c\udf08"],
  swords:     ["\ud83d\udca1", "\u2694\ufe0f", "\ud83d\udc94", "\ud83d\ude34", "\ud83c\udf27\ufe0f", "\ud83c\udf2c\ufe0f", "\ud83c\udfad", "\u26d3\ufe0f", "\ud83d\ude28", "\ud83c\udf42", "\ud83e\udde0", "\u2600\ufe0f"],
  pentacles:  ["\u2b50", "\u2696\ufe0f", "\ud83d\udee0\ufe0f", "\ud83c\udfe0", "\ud83d\udc8e", "\ud83d\ude4f", "\u23f3", "\ud83c\udf3e", "\ud83c\udf33", "\ud83d\udcbc", "\ud83c\udfe1", "\ud83d\udcb0"],
};

const COURT_TITLES = ["Page", "Knight", "Queen", "King"];

function buildMinorArcana(): TarotCard[] {
  const cards: TarotCard[] = [];

  for (const [suit, data] of Object.entries(MINOR_MEANINGS) as [TarotSuit, typeof MINOR_MEANINGS[TarotSuit]][]) {
    for (let i = 0; i < 14; i++) {
      const num = i + 1;
      const isCourt = num >= 11;
      const name = isCourt
        ? `${COURT_TITLES[i - 11]!} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`
        : `${num === 1 ? "Ace" : num === 10 ? "Ten" : num === 11 ? "Page" : num === 12 ? "Knight" : num === 13 ? "Queen" : "King"} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;

      const kw = data.keywords[i] ?? ["change", "growth"];
      const symbol = SUIT_SYMBOLS[suit]![i] ?? "\u2728";

      cards.push({
        id: `minor-${suit}-${num}`,
        name,
        arcana: "minor",
        suit,
        number: num,
        element: data.element,
        symbol,
        keywords: kw,
        upright: `${kw[0]!.charAt(0).toUpperCase() + kw[0]!.slice(1)} in the realm of ${data.theme}. This card speaks to ${kw.join(" and ").toLowerCase()} in your current situation.`,
        reversed: `Blocked ${kw[0]!.toLowerCase()} energy. The ${data.theme} aspect of your life may feel stuck or distorted. Re-examine your approach.`,
        description: `A ${suit} card of ${kw.join(" and ").toLowerCase()}.`,
      });
    }
  }

  return cards;
}

export const MINOR_ARCANA: TarotCard[] = buildMinorArcana();
export const FULL_DECK: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface DrawnCard {
  card: TarotCard;
  isReversed: boolean;
  position: string;
}

export function shuffleDeck(deck: TarotCard[] = FULL_DECK): TarotCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function drawCards(
  count: number,
  positions: string[],
  deck: TarotCard[] = FULL_DECK,
): DrawnCard[] {
  const shuffled = shuffleDeck(deck);
  return shuffled.slice(0, count).map((card, i) => ({
    card,
    isReversed: Math.random() < 0.3,
    position: positions[i] ?? `Position ${i + 1}`,
  }));
}

export const SPREADS = {
  single: {
    name: "Single Card",
    count: 1,
    positions: ["Guidance"],
    description: "One card. One truth. Perfect for daily guidance.",
  },
  three: {
    name: "Three-Card Spread",
    count: 3,
    positions: ["Past", "Present", "Future"],
    description: "Past, Present, Future \u2014 the classic timeline reading.",
  },
  love: {
    name: "Love Spread",
    count: 5,
    positions: ["You", "Your Partner", "The Relationship", "Challenge", "Outcome"],
    description: "Five cards exploring the dynamics of love.",
  },
  celtic: {
    name: "Celtic Cross",
    count: 5,
    positions: ["Present", "Challenge", "Foundation", "Recent Past", "Possible Future"],
    description: "A focused 5-card Celtic Cross for quick deep insight.",
  },
} as const;

export type SpreadName = keyof typeof SPREADS;

export const ELEMENT_COLORS: Record<TarotElement, { bg: string; text: string; border: string }> = {
  fire:  { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  water: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  air:   { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  earth: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
};

export const SUIT_GRADIENTS: Record<TarotSuit, string> = {
  wands: "from-orange-500 to-red-600",
  cups: "from-blue-500 to-cyan-600",
  swords: "from-slate-400 to-indigo-600",
  pentacles: "from-emerald-500 to-green-700",
};

export const MAJOR_GRADIENT = "from-violet-600 via-purple-600 to-indigo-700";
