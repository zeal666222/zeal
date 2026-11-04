// Compact tarot deck for chat worker — card names, keywords, and guidance only.
// Full meanings live in apps/web/lib/tarot/deck.ts; the worker sends structured
// data and the frontend renders the rich card UI.

export interface WorkerTarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: string;
  symbol: string;
  keywords: string[];
  upright: string;
  reversed: string;
  guidance: string;
}

export interface WorkerDrawnCard {
  card: WorkerTarotCard;
  isReversed: boolean;
  position: string;
}

export const SPREADS = {
  single: { name: "Single Card", count: 1, positions: ["Guidance"] },
  three: { name: "Three-Card Spread", count: 3, positions: ["Past", "Present", "Future"] },
  love: { name: "Love Spread", count: 5, positions: ["You", "Your Partner", "The Bond", "Challenge", "Outcome"] },
  celtic: { name: "Celtic Cross", count: 5, positions: ["Present", "Challenge", "Subconscious", "Recent Past", "Possible Future"] },
} as const;

export type SpreadKey = keyof typeof SPREADS;

const MAJOR: WorkerTarotCard[] = [
  { id: "major-0", name: "The Fool", arcana: "major", symbol: "🃏", keywords: ["beginnings", "innocence", "spontaneity"], upright: "New beginnings, infinite potential, a leap of faith", reversed: "Recklessness, risk-taking, holding back from a needed change", guidance: "Trust the journey ahead — even uncertainty has its own wisdom." },
  { id: "major-1", name: "The Magician", arcana: "major", symbol: "🪄", keywords: ["willpower", "creation", "skill"], upright: "Manifestation, resourcefulness, power and inspired action", reversed: "Manipulation, untapped talents, trickery", guidance: "You have all the tools you need — channel them with intention." },
  { id: "major-2", name: "The High Priestess", arcana: "major", symbol: "🌙", keywords: ["intuition", "mystery", "subconscious"], upright: "Intuition, sacred knowledge, the unseen realm", reversed: "Secrets, withdrawal, silence", guidance: "Listen to the quiet voice within — it knows what the mind cannot see." },
  { id: "major-3", name: "The Empress", arcana: "major", symbol: "👑", keywords: ["abundance", "nurturing", "fertility"], upright: "Feminine power, nurture, growth and abundance", reversed: "Creative block, dependence on others", guidance: "Create space for growth — nature does not hurry, yet everything is accomplished." },
  { id: "major-4", name: "The Emperor", arcana: "major", symbol: "🏛️", keywords: ["authority", "structure", "control"], upright: "Leadership, vision, discipline and authority", reversed: "Domination, excessive control, rigidity", guidance: "Build with structure — true power comes from clarity of purpose." },
  { id: "major-5", name: "The Hierophant", arcana: "major", symbol: "📿", keywords: ["tradition", "conformity", "education"], upright: "Spiritual wisdom, tradition, conformity", reversed: "Rebellion, subversiveness, new approaches", guidance: "Honour the wisdom of the past, but question what no longer serves." },
  { id: "major-6", name: "The Lovers", arcana: "major", symbol: "💕", keywords: ["love", "harmony", "choices"], upright: "Love, harmony, relationships, values alignment", reversed: "Disharmony, imbalance, misalignment", guidance: "Choose with your heart — the right path feels like coming home." },
  { id: "major-7", name: "The Chariot", arcana: "major", symbol: "⚡", keywords: ["determination", "willpower", "victory"], upright: "Control, willpower, success through determination", reversed: "Lack of direction, aggression, no control", guidance: "Hold the reins steady — victory comes to those who do not waver." },
  { id: "major-8", name: "Strength", arcana: "major", symbol: "🦁", keywords: ["courage", "patience", "compassion"], upright: "Inner strength, courage, patience and compassion", reversed: "Self-doubt, weakness, insecurity", guidance: "True strength is gentle — tame the storm within with quiet resolve." },
  { id: "major-9", name: "The Hermit", arcana: "major", symbol: "🏔️", keywords: ["introspection", "solitude", "wisdom"], upright: "Soul-searching, introspection, being alone", reversed: "Isolation, loneliness, withdrawal", guidance: "Step back and look within — the answers you seek are in the silence." },
  { id: "major-10", name: "Wheel of Fortune", arcana: "major", symbol: "🎡", keywords: ["change", "cycles", "destiny"], upright: "Good luck, karma, life cycles, turning point", reversed: "Bad luck, resistance to change, breaking cycles", guidance: "The wheel turns — embrace change as the universe rearranges for your benefit." },
  { id: "major-11", name: "Justice", arcana: "major", symbol: "⚖️", keywords: ["fairness", "truth", "balance"], upright: "Fairness, truth, cause and effect, law", reversed: "Unfairness, dishonesty, unaccountability", guidance: "Seek truth over comfort — justice always finds its balance." },
  { id: "major-12", name: "The Hanged Man", arcana: "major", symbol: "🔄", keywords: ["surrender", "perspective", "pause"], upright: "Pause, surrender, letting go, new perspectives", reversed: "Delays, resistance, stalling", guidance: "Sometimes you must stop to see clearly — surrender is not defeat." },
  { id: "major-13", name: "Death", arcana: "major", symbol: "🦋", keywords: ["transformation", "ending", "transition"], upright: "Endings, change, transformation, transition", reversed: "Resistance to change, personal transformation delayed", guidance: "What ends makes space for what begins — transformation is not loss." },
  { id: "major-14", name: "Temperance", arcana: "major", symbol: "⏳", keywords: ["balance", "moderation", "patience"], upright: "Balance, moderation, patience, purpose", reversed: "Imbalance, excess, self-healing needed", guidance: "Blend opposites with patience — the middle path holds the deepest wisdom." },
  { id: "major-15", name: "The Devil", arcana: "major", symbol: "⛓️", keywords: ["shadow", "attachment", "illusion"], upright: "Shadow self, attachment, addiction, restriction", reversed: "Releasing limiting beliefs, exploring dark thoughts, detachment", guidance: "Name the chain — awareness is the first step to freedom." },
  { id: "major-16", name: "The Tower", arcana: "major", symbol: "🌩️", keywords: ["upheaval", "revelation", "awakening"], upright: "Sudden change, upheaval, revelation, awakening", reversed: "Fear of change, averting disaster, delaying the inevitable", guidance: "What crumbles was built on false ground — rebuild on truth." },
  { id: "major-17", name: "The Star", arcana: "major", symbol: "⭐", keywords: ["hope", "inspiration", "serenity"], upright: "Hope, faith, purpose, renewal, spirituality", reversed: "Lack of faith, despair, self-trust issues", guidance: "Even in the darkest sky, your star still shines — keep looking up." },
  { id: "major-18", name: "The Moon", arcana: "major", symbol: "🌕", keywords: ["illusion", "fear", "subconscious"], upright: "Illusion, fear, anxiety, subconscious, intuition", reversed: "Release of fear, repressed emotion, inner clarity", guidance: "Not all is as it seems — trust your intuition to navigate the fog." },
  { id: "major-19", name: "The Sun", arcana: "major", symbol: "☀️", keywords: ["joy", "success", "vitality"], upright: "Positivity, fun, warmth, success, vitality", reversed: "Inner child, feeling down, overly optimistic", guidance: "Step into the light — you have earned this warmth and joy." },
  { id: "major-20", name: "Judgement", arcana: "major", symbol: "📯", keywords: ["rebirth", "calling", "reckoning"], upright: "Rebirth, inner calling, absolution, reckoning", reversed: "Self-doubt, refusal of calling, self-forgiveness needed", guidance: "Answer the call within — it is time to rise into who you are becoming." },
  { id: "major-21", name: "The World", arcana: "major", symbol: "🌍", keywords: ["completion", "integration", "accomplishment"], upright: "Completion, integration, accomplishment, travel", reversed: "Seeking personal closure, short-cuts, delays", guidance: "A cycle completes — honour the journey, then step boldly into the next." },
];

const MINOR_SUITS: Array<{ suit: string; symbol: string; element: string }> = [
  { suit: "wands", symbol: "🔥", element: "fire" },
  { suit: "cups", symbol: "💧", element: "water" },
  { suit: "swords", symbol: "💨", element: "air" },
  { suit: "pentacles", symbol: "🌍", element: "earth" },
];

const COURT = ["Page", "Knight", "Queen", "King"];
const MINOR_NAMES = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function buildMinorDeck(): WorkerTarotCard[] {
  const cards: WorkerTarotCard[] = [];
  for (const { suit, symbol } of MINOR_SUITS) {
    for (let i = 0; i < MINOR_NAMES.length; i++) {
      const name = MINOR_NAMES[i]!;
      cards.push({
        id: `minor-${suit}-${i + 1}`,
        name: `${name} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`,
        arcana: "minor",
        suit,
        symbol,
        keywords: [suit, name.toLowerCase()],
        upright: `The ${name} of ${suit.charAt(0).toUpperCase() + suit.slice(1)} — a moment of ${suit}-energy in your life.`,
        reversed: `Reversed ${name} of ${suit.charAt(0).toUpperCase() + suit.slice(1)} — blocked or shadow ${suit}-energy.`,
        guidance: `Reflect on how ${suit}-energy shows up in your current situation.`,
      });
    }
    for (let j = 0; j < COURT.length; j++) {
      const rank = COURT[j]!;
      cards.push({
        id: `minor-${suit}-court-${j}`,
        name: `${rank} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`,
        arcana: "minor",
        suit,
        symbol,
        keywords: [suit, rank.toLowerCase()],
        upright: `The ${rank} of ${suit.charAt(0).toUpperCase() + suit.slice(1)} — embody the mature ${suit} quality.`,
        reversed: `Reversed ${rank} of ${suit.charAt(0).toUpperCase() + suit.slice(1)} — immaturity or excess of ${suit}-energy.`,
        guidance: `Consider what the ${rank} archetype teaches you about ${suit}-energy.`,
      });
    }
  }
  return cards;
}

export const FULL_DECK: WorkerTarotCard[] = [...MAJOR, ...buildMinorDeck()];

export function shuffleDeck(deck: WorkerTarotCard[] = FULL_DECK): WorkerTarotCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function drawCards(count: number, positions: string[], deck?: WorkerTarotCard[]): WorkerDrawnCard[] {
  const shuffled = shuffleDeck(deck);
  return shuffled.slice(0, count).map((card, i) => ({
    card,
    isReversed: Math.random() < 0.3,
    position: positions[i] ?? `Position ${i + 1}`,
  }));
}

// Detect tarot intent in user message
const TAROT_KEYWORDS = [
  "tarot", "card", "cards", "draw", "reading", "spread",
  "oracle", "deck", "major arcana", "minor arcana",
  "pull a card", "pick a card", "what does the card say",
];

export function detectTarotIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return TAROT_KEYWORDS.some((kw) => lower.includes(kw));
}

export function pickSpread(message: string): SpreadKey {
  const lower = message.toLowerCase();
  if (lower.includes("love") || lower.includes("relationship") || lower.includes("partner")) return "love";
  if (lower.includes("celtic") || lower.includes("cross") || lower.includes("detailed")) return "celtic";
  if (lower.includes("three") || lower.includes("past") || lower.includes("future")) return "three";
  return "single";
}
