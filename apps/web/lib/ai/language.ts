// ═══════════════════════════════════════════════════════════════════════════════
// Zeal AI — language detection
// ─────────────────────────────────────────────────────────────────────────────
// Zeal's default reply language is Hinglish (warm Roman-script Hindi + English
// mix). When the seeker writes in a clear English or Devanagari-Hindi register,
// the model should mirror it. This module gives the chat pipeline a fast,
// deterministic signal so it can prepend an explicit per-turn directive instead
// of hoping the model infers it.
//
// Returns:
//   "hi"        — Devanagari present (Hindi / Marathi / Nepali script).
//   "en"        — Latin-only with no Hindi-phonetic markers.
//   "hinglish"  — Latin script with Hindi-phonetic markers (default).
// ═══════════════════════════════════════════════════════════════════════════════

export type SeekerLang = "hi" | "en" | "hinglish";

const DEVANAGARI = /[\u0900-\u097F]/;

/**
 * Common Roman-script Hindi phonetic markers. If ≥1 appears in a Latin-script
 * message, treat the user as writing Hinglish rather than English.
 *
 * Deliberately narrow — we'd rather mis-classify as English and let the model
 * mirror the user's actual mix than force Hinglish on a clear English message.
 */
const HINGLISH_MARKERS = new Set<string>([
  // pronouns / copulas
  "aap", "aapki", "aapka", "aapko", "aapne", "tum", "tumne", "tumhari", "tumhara",
  "tumhe", "mujhe", "mujhko", "mujhse", "hamen", "hamein", "hum", "woh", "unhe",
  "unki", "unka", "isko", "is", "us", "yeh", "yah", "kya", "kyu", "kyon", "kyun",
  "kyunki", "hai", "hain", "ho", "hua", "hue", "hoga", "hogi", "hota", "hoti",
  "tha", "thi", "the", "raha", "rahi", "rahe",
  // question / quantity words
  "kab", "kabhi", "kabse", "kaise", "kaisa", "kaisi", "kitna", "kitni", "kitne",
  "kaun", "kaunsa", "kaunsi", "kahan", "kahaan", "yahan", "wahan", "kuch", "kuchh",
  "thoda", "thodi", "thode", "zyada", "kam", "bahut", "bohot", "badiya", "badhiya",
  // common verbs / directives
  "karo", "kariye", "kijiye", "karein", "karun", "kar", "karna", "karne", "kiya",
  "kijiye", "batao", "bataiye", "bataye", "batayein", "dekho", "dekhiye", "dekh",
  "sun", "suno", "sunen", "puchho", "pucho", "poocho", "maano", "samjho", "samjha",
  "milega", "milegi", "milenge", "milen", "hojaye", "hojayein", "hojao",
  // greetings / fillers
  "namaste", "namaskar", "pranam", "kripya", "dhanyavaad", "shukriya", "thik",
  "theek", "sahi", "galat", "bilkul", "ekdam", "shayad", "zaroor", "haan", "na",
  "nahi", "nahin", "mat", "please", "haa", "nahin", "nahi",
]);

function latinTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function detectLanguage(text: string): SeekerLang {
  if (!text) return "hinglish";
  if (DEVANAGARI.test(text)) return "hi";
  const tokens = latinTokens(text);
  if (tokens.length === 0) return "hinglish";
  const hits = tokens.filter((t) => HINGLISH_MARKERS.has(t)).length;
  // A single Hindi-phonetic word in a long English sentence is not enough to
  // flip to Hinglish — we want a clear signal (≥1 hit AND ≥10% of the tokens).
  if (hits === 0) return "en";
  const ratio = hits / tokens.length;
  return ratio >= 0.08 ? "hinglish" : "en";
}

const DIRECTIVE: Record<SeekerLang, string> = {
  en: "The seeker wrote this turn in English — reply in English.",
  hi: "The seeker wrote this turn in Devanagari Hindi — reply in Hindi (Devanagari script).",
  hinglish:
    "The seeker wrote this turn in Hinglish — reply in warm Roman-script Hindi+English mix.",
};

export function languageDirective(lang: SeekerLang): string {
  return DIRECTIVE[lang];
}

/** Convenience: detect + produce the directive in one call. */
export function directiveFor(text: string): string {
  return DIRECTIVE[detectLanguage(text)];
}
