// ═══════════════════════════════════════════════════════════════════════════════
// Suggested follow-ups — 2-3 quick-reply chips shown after every AI reply
// ───────────────────────────────────────────────────────────────────────────────
// Same idea as ChatGPT/Claude's suggested replies, but tuned to the persona
// and to the shape of what the model just said. We never call the AI for
// these — that would double the cost. The templates are deterministic per
// (category, intent-tag found in the reply, locale).
//
// Client contract: on the `done` SSE event the payload now includes
//   suggestions: Array<{ label: string; prompt: string; icon?: string }>
// Chips render under the assistant bubble; clicking one calls send() with
// the `prompt` string as if the user had typed it.
// ═══════════════════════════════════════════════════════════════════════════════

export interface Suggestion {
  label: string;
  prompt: string;
  icon?: "sparkle" | "chart" | "heart" | "briefcase" | "moon" | "clock";
}

const BANK: Record<string, Record<"en" | "hi-en", Suggestion[]>> = {
  astrology: {
    "hi-en": [
      { label: "Career ka next move", prompt: "Career ke liye aane wale 6 months ka plan batao.", icon: "briefcase" },
      { label: "Love & marriage", prompt: "Love aur marriage ke yog ka detail mein matlab batao.", icon: "heart" },
      { label: "Aaj ka muhurat", prompt: "Aaj ka shubh muhurat aur Rahu Kaal batao.", icon: "clock" },
    ],
    en: [
      { label: "Next career move", prompt: "What should my next career move look like over the next 6 months?", icon: "briefcase" },
      { label: "Love & marriage", prompt: "Explain my marriage and love-life yogas in more detail.", icon: "heart" },
      { label: "Today's muhurat", prompt: "Give me today's shubh muhurat and Rahu Kaal.", icon: "clock" },
    ],
  },
  tarot: {
    "hi-en": [
      { label: "Card ka deeper matlab", prompt: "In cards ka sabse important message kya hai?", icon: "sparkle" },
      { label: "Timing batao", prompt: "Ye ghatnayen kab tak ho sakti hain?", icon: "clock" },
      { label: "Remedy", prompt: "Is spread ke liye koi simple upay batao.", icon: "moon" },
    ],
    en: [
      { label: "Deeper card meaning", prompt: "What is the single most important message across these cards?", icon: "sparkle" },
      { label: "Timing", prompt: "How soon could these events unfold?", icon: "clock" },
      { label: "Remedy", prompt: "Suggest a simple remedy for this spread.", icon: "moon" },
    ],
  },
  numerology: {
    "hi-en": [
      { label: "Life Path detail", prompt: "Mere Life Path number ka poora detail batao.", icon: "chart" },
      { label: "Lucky numbers", prompt: "Aane wale mahine ke lucky dates batao.", icon: "sparkle" },
      { label: "Naam change?", prompt: "Kya mera naam number-wise theek hai ya change karna chahiye?", icon: "moon" },
    ],
    en: [
      { label: "Life Path detail", prompt: "Give me the full meaning of my Life Path number.", icon: "chart" },
      { label: "Lucky numbers", prompt: "Which dates should I mark as lucky this month?", icon: "sparkle" },
      { label: "Name correction", prompt: "Does my name numerologically fit, or should I adjust the spelling?", icon: "moon" },
    ],
  },
  kundali: {
    "hi-en": [
      { label: "Dasha timeline", prompt: "Meri current dasha ka next phase kya hai?", icon: "clock" },
      { label: "Dosha remedy", prompt: "Koi dosha hai to uska upay batao.", icon: "moon" },
      { label: "Marriage yog", prompt: "Shaadi ka yog kab tak ban raha hai?", icon: "heart" },
    ],
    en: [
      { label: "Dasha timeline", prompt: "What is my next dasha phase and roughly when does it start?", icon: "clock" },
      { label: "Dosha remedy", prompt: "If there is any dosha, walk me through the remedy.", icon: "moon" },
      { label: "Marriage yoga", prompt: "When does my marriage yoga look strongest?", icon: "heart" },
    ],
  },
  horoscope: { "hi-en": [], en: [] },
  panchang: {
    "hi-en": [
      { label: "Shubh kaam aaj", prompt: "Aaj kaunse kaam karne chahiye aur kaunse avoid?", icon: "clock" },
      { label: "Vrat/tithi", prompt: "Aaj ka vrat aur tithi detail batao.", icon: "moon" },
    ],
    en: [
      { label: "Favourable tasks", prompt: "Which activities are favoured today and which to avoid?", icon: "clock" },
      { label: "Vrat & tithi", prompt: "Explain today's vrat and tithi significance.", icon: "moon" },
    ],
  },
  milan: {
    "hi-en": [
      { label: "Score improve kaise", prompt: "Milan score kaise behtar banayein, tips batao.", icon: "heart" },
      { label: "Mangal dosha", prompt: "Mangal dosha ka asar aur upay batao.", icon: "moon" },
    ],
    en: [
      { label: "Improve the score", prompt: "How do we improve our guna milan score?", icon: "heart" },
      { label: "Mangal dosha", prompt: "Explain the Mangal dosha impact and remedies.", icon: "moon" },
    ],
  },
  dream: {
    "hi-en": [
      { label: "Aur sapne", prompt: "Aise hi aur sapne ka matlab batao.", icon: "sparkle" },
      { label: "Recurring dream", prompt: "Jo baar-baar aata hai uska kya matlab?", icon: "moon" },
    ],
    en: [
      { label: "Recurring dreams", prompt: "What does a recurring version of this dream usually mean?", icon: "moon" },
      { label: "Action step", prompt: "What should I actually do differently tomorrow based on this?", icon: "sparkle" },
    ],
  },
  palmistry: {
    "hi-en": [
      { label: "Life line detail", prompt: "Meri life line ka detailed matlab batao.", icon: "chart" },
      { label: "Career lines", prompt: "Career lines se kya pata chalta hai?", icon: "briefcase" },
    ],
    en: [
      { label: "Life line detail", prompt: "Walk me through what my life line is telling.", icon: "chart" },
      { label: "Career lines", prompt: "What do my career lines say?", icon: "briefcase" },
    ],
  },
  therapy: {
    "hi-en": [
      { label: "Chhota next step", prompt: "Aaj ke liye ek chhota practical step batao.", icon: "sparkle" },
      { label: "Reflection prompt", prompt: "Mujhe journal ke liye ek sawaal do.", icon: "heart" },
    ],
    en: [
      { label: "One small step", prompt: "Give me one small, practical step for today.", icon: "sparkle" },
      { label: "Reflection prompt", prompt: "Ask me one journaling question to sit with.", icon: "heart" },
    ],
  },
  vastu: {
    "hi-en": [
      { label: "Room arrangement", prompt: "Mere room ka layout kaise behtar ho?", icon: "chart" },
      { label: "Direction check", prompt: "Kaunsi disha mujhe shubh hai?", icon: "compass" as never },
    ],
    en: [
      { label: "Room layout", prompt: "How should I rearrange my room for better flow?", icon: "chart" },
      { label: "Direction check", prompt: "Which facing is most auspicious for me?", icon: "moon" },
    ],
  },
};

// Generic set used when the persona category is unknown or empty.
const GENERIC: Record<"en" | "hi-en", Suggestion[]> = {
  "hi-en": [
    { label: "Aur detail", prompt: "Iska thoda aur detail mein matlab batao.", icon: "sparkle" },
    { label: "Simple remedy", prompt: "Koi asaan upay batao.", icon: "moon" },
    { label: "Next step", prompt: "Ab mujhe kya karna chahiye?", icon: "briefcase" },
  ],
  en: [
    { label: "More detail", prompt: "Could you go into more detail on that reading?", icon: "sparkle" },
    { label: "Simple remedy", prompt: "Suggest a simple remedy I can start today.", icon: "moon" },
    { label: "Next step", prompt: "What should I actually do next?", icon: "briefcase" },
  ],
};

function pickBucket(category: string | undefined): keyof typeof BANK {
  if (!category) return "astrology";
  const c = category.toLowerCase();
  if (c.includes("astrolog")) return "astrology";
  if (c.includes("tarot")) return "tarot";
  if (c.includes("numerolog")) return "numerology";
  if (c.includes("kundali") || c.includes("birth")) return "kundali";
  if (c.includes("horoscope") || c.includes("rashifal")) return "horoscope";
  if (c.includes("panchang") || c.includes("muhurat")) return "panchang";
  if (c.includes("milan") || c.includes("match")) return "milan";
  if (c.includes("dream") || c.includes("swapna")) return "dream";
  if (c.includes("palm") || c.includes("hast")) return "palmistry";
  if (c.includes("therap") || c.includes("counsel") || c.includes("psych")) return "therapy";
  if (c.includes("vastu")) return "vastu";
  return "astrology";
}

export function pickSuggestionLocale(text: string): "en" | "hi-en" {
  if (/[\u0900-\u097F]/.test(text)) return "hi-en";
  if (/\b(kya|kaise|kaisa|meri|mera|mujhe|aap|hai|nahi|karna|karo|kyu|kyon|bahut|zyada|thoda|kal|aaj)\b/i.test(text)) {
    return "hi-en";
  }
  return "en";
}

// If the assistant's reply mentioned a specific theme, promote matching
// suggestions to the front so they feel like an in-context offer, not a
// generic quick-reply.
function rerankByReplyText(items: Suggestion[], reply: string): Suggestion[] {
  const r = reply.toLowerCase();
  const boosts: Array<[RegExp, Suggestion["icon"]]> = [
    [/\b(career|job|business|noukri|karrier|kam)\b/i, "briefcase"],
    [/\b(love|marriage|relationship|pyar|shaadi|rishta)\b/i, "heart"],
    [/\b(dasha|dashas?|transit|kaal|time|year|month)\b/i, "clock"],
    [/\b(remedy|upay|donation|daan|puja|mantra)\b/i, "moon"],
    [/\b(dream|sapna|swapna)\b/i, "sparkle"],
  ];
  for (const [re, icon] of boosts) {
    if (re.test(r)) {
      const idx = items.findIndex((s) => s.icon === icon);
      if (idx > 0) items.unshift(...items.splice(idx, 1));
    }
  }
  return items;
}

export function buildSuggestions(
  category: string | undefined,
  replyText: string,
  locale: "en" | "hi-en",
): Suggestion[] {
  const bucket = pickBucket(category);
  let list = BANK[bucket]?.[locale] ?? [];
  if (!list.length) list = GENERIC[locale];
  const copy = list.map((s) => ({ ...s }));
  return rerankByReplyText(copy, replyText).slice(0, 3);
}
