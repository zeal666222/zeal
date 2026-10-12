// apps/web/lib/dream/analyzer.ts
// Client-side NLP dream analysis engine — no API keys required
// Uses keyword matching, theme detection, emotion analysis, and archetype classification

import type {
  DreamAnalysisResult, DreamSymbol, DreamThemeAnalysis,
  DreamArchetypeAnalysis, DreamEmotionAnalysis, DreamEmotion,
  DreamTheme, DreamArchetype, DreamElement,
} from "./types";
import {
  SYMBOL_DICTIONARY, THEME_INTERPRETATIONS,
  ARCHETYPE_PROFILES, EMOTION_PROFILES,
} from "./knowledge";

// ─── TEXT PREPROCESSING ─────────────────────────────────────────────────────────

function preprocess(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
}

function extractPhrases(text: string, maxLen = 4): string[] {
  const words = preprocess(text);
  const phrases: string[] = [];
  for (let len = maxLen; len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      phrases.push(words.slice(i, i + len).join(" "));
    }
  }
  return phrases;
}

// ─── EMOTION DETECTION ──────────────────────────────────────────────────────────

const EMOTION_KEYWORDS: Record<DreamEmotion, string[]> = {
  joy: ["happy", "joy", "joyful", "laughing", "laugh", "smile", "smiling", "excited", "excitement", "wonderful", "amazing", "beautiful", "delight", "delighted", "celebrating", "celebration", "bliss", "blissful", "euphoria", "euphoric", "thrilled", "glad", "cheerful"],
  fear: ["afraid", "scared", "terrified", "terror", "frightened", "horror", "horrified", "panic", "panicking", "petrified", "dread", "dreading", "phobia", "nightmare", "creepy", "spooky", "eerie"],
  anxiety: ["anxious", "anxiety", "worried", "worry", "nervous", "nervousness", "uneasy", "tense", "tension", "stressed", "stress", "overwhelmed", "panic", "panicking", "restless", "restlessness", "agitated"],
  sadness: ["sad", "sadness", "crying", "cry", "cried", "tears", "grief", "grieving", "mourning", "mourn", "sorrow", "sorrowful", "depressed", "depression", "melancholy", "melancholic", "heartbroken", "lonely", "loneliness", "lost", "empty"],
  anger: ["angry", "anger", "furious", "fury", "rage", "raging", "mad", "enraged", "irritated", "irritation", "frustrated", "frustration", "annoyed", "annoyance", "hostile", "hostility"],
  confusion: ["confused", "confusion", "lost", "bewildered", "bewildered", "puzzled", "puzzle", "disoriented", "disorientation", "uncertain", "uncertainty", "unsure", "strange", "weird", "bizarre", "surreal", "dreamlike"],
  peace: ["peaceful", "peace", "calm", "calm", "serene", "serenity", "tranquil", "tranquility", "still", "stillness", "quiet", "quiet", "relaxed", "relaxation", "harmonious", "harmony", "balanced", "balance"],
  awe: ["awed", "awe", "amazed", "amazement", "astonished", "astonishment", "wonder", "wondrous", "incredible", "magnificent", "majestic", "majesty", "divine", "sacred", "holy", "transcendent", "numinous", "sublime"],
  loneliness: ["alone", "lonely", "loneliness", "isolated", "isolation", "abandoned", "abandonment", "deserted", "empty", "emptiness", "solitary", "solitude", "forgotten", "unseen", "invisible"],
  love: ["love", "loving", "loved", "affection", "affectionate", "tender", "tenderness", "caring", "cared", "warm", "warmth", "gentle", "gentleness", "compassion", "compassionate", "intimate", "intimacy", "connected", "connection", "beloved"],
};

function detectEmotions(text: string): DreamEmotionAnalysis[] {
  const lower = text.toLowerCase();
  const results: DreamEmotionAnalysis[] = [];

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let count = 0;
    const triggers: string[] = [];
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      const matches = lower.match(regex);
      if (matches) {
        count += matches.length;
        triggers.push(kw);
      }
    }
    if (count > 0) {
      results.push({
        emotion: emotion as DreamEmotion,
        intensity: Math.min(count / 3, 1),
        triggers: [...new Set(triggers)],
      });
    }
  }

  return results.sort((a, b) => b.intensity - a.intensity);
}

// ─── SYMBOL EXTRACTION ──────────────────────────────────────────────────────────

function extractSymbols(text: string): DreamSymbol[] {
  const phrases = extractPhrases(text);
  const found = new Map<string, DreamSymbol>();
  const usedKeywords = new Set<string>();

  for (const entry of SYMBOL_DICTIONARY) {
    for (const keyword of entry.keywords) {
      if (usedKeywords.has(keyword)) continue;
      const kwLower = keyword.toLowerCase();

      for (const phrase of phrases) {
        if (phrase.includes(kwLower) || kwLower.includes(phrase)) {
          if (!found.has(entry.keywords[0]!)) {
            const category = inferCategory(kwLower);
            found.set(entry.keywords[0]!, {
              symbol: entry.keywords[0]!,
              category,
              archetypes: entry.archetypes,
              themes: entry.themes,
              emotions: entry.emotions,
            });
          }
          usedKeywords.add(keyword);
          break;
        }
      }
    }
  }

  return Array.from(found.values());
}

function inferCategory(symbol: string): DreamElement {
  const locationWords = ["house", "room", "forest", "mountain", "ocean", "river", "garden", "school", "office", "church", "temple", "desert", "field", "cave", "castle", "palace", "basement", "attic", "kitchen", "bedroom", "bathroom"];
  const actionWords = ["flying", "falling", "running", "chased", "swimming", "driving", "climbing", "fighting", "dancing", "singing", "hiding"];
  const objectWords = ["car", "key", "mirror", "door", "window", "book", "ring", "knife", "gun", "phone", "computer", "money", "food", "flower", "tree"];
  const colorWords = ["red", "blue", "green", "yellow", "purple", "white", "black", "gold", "silver", "orange", "pink"];
  const numberWords = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const characterWords = ["mother", "father", "sister", "brother", "baby", "child", "stranger", "friend", "god", "angel", "demon"];

  if (locationWords.some((w) => symbol.includes(w))) return "location";
  if (actionWords.some((w) => symbol.includes(w))) return "action";
  if (colorWords.some((w) => symbol.includes(w))) return "color";
  if (numberWords.some((w) => symbol.includes(w))) return "number";
  if (characterWords.some((w) => symbol.includes(w))) return "character";
  if (objectWords.some((w) => symbol.includes(w))) return "object";
  return "symbol";
}

// ─── THEME ANALYSIS ─────────────────────────────────────────────────────────────

function analyzeThemes(text: string, symbols: DreamSymbol[]): DreamThemeAnalysis[] {
  const themeCounts = new Map<DreamTheme, number>();
  const themeVariations = new Map<DreamTheme, Set<string>>();

  for (const symbol of symbols) {
    for (const theme of symbol.themes) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
      if (!themeVariations.has(theme)) themeVariations.set(theme, new Set());
      themeVariations.get(theme)!.add(symbol.symbol);
    }
  }

  const lower = text.toLowerCase();
  const themeKeywords: Record<DreamTheme, string[]> = {
    falling: ["fall", "falling", "fell", "drop", "dropping", "plummet", "cliff", "edge"],
    flying: ["fly", "flying", "flight", "float", "floating", "soar", "soaring", "airborne"],
    being_chased: ["chase", "chased", "chasing", "pursue", "pursued", "pursuit", "run from", "hiding", "hide", "escape", "escaping"],
    teeth: ["teeth", "tooth", "dental", "crumble", "crumbling"],
    water: ["water", "ocean", "sea", "river", "lake", "swim", "swimming", "drown", "rain", "wave", "flood", "underwater"],
    death: ["death", "die", "dying", "dead", "funeral", "grave", "ghost", "spirit", "killed", "murder"],
    animals: ["animal", "dog", "cat", "snake", "bird", "fish", "horse", "wolf", "bear", "spider", "butterfly", "insect"],
    naked: ["naked", "nude", "undressed", "exposed", "clothes missing", "no clothes"],
    exam: ["exam", "test", "school", "classroom", "study", "unprepared", "grade", "fail"],
    lost: ["lost", "lose", "can't find", "cannot find", "maze", "confused", "wander", "searching"],
    house: ["house", "home", "building", "room", "basement", "attic", "door", "window", "stairs"],
    vehicle: ["car", "drive", "driving", "vehicle", "train", "bus", "plane", "boat", "bicycle"],
    nature: ["forest", "tree", "mountain", "garden", "flower", "desert", "storm", "sun", "moon", "star", "sky"],
    family: ["mother", "father", "parent", "sister", "brother", "family", "husband", "wife", "baby", "child"],
    work: ["work", "office", "job", "boss", "meeting", "deadline", "career"],
    supernatural: ["god", "angel", "demon", "heaven", "hell", "magic", "divine", "sacred", "prayer", "miracle"],
  };

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        themeCounts.set(theme as DreamTheme, (themeCounts.get(theme as DreamTheme) ?? 0) + 1);
        if (!themeVariations.has(theme as DreamTheme)) themeVariations.set(theme as DreamTheme, new Set());
        themeVariations.get(theme as DreamTheme)!.add(kw);
      }
    }
  }

  return Array.from(themeCounts.entries())
    .map(([theme, count]) => ({
      theme,
      intensity: Math.min(count / 3, 1),
      variations: Array.from(themeVariations.get(theme) ?? []),
    }))
    .sort((a, b) => b.intensity - a.intensity);
}

// ─── ARCHETYPE ANALYSIS ─────────────────────────────────────────────────────────

function analyzeArchetypes(symbols: DreamSymbol[]): DreamArchetypeAnalysis[] {
  const archetypeCounts = new Map<DreamArchetype, number>();
  const archetypeManifestations = new Map<DreamArchetype, Set<string>>();

  for (const symbol of symbols) {
    for (const archetype of symbol.archetypes) {
      archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
      if (!archetypeManifestations.has(archetype)) archetypeManifestations.set(archetype, new Set());
      archetypeManifestations.get(archetype)!.add(symbol.symbol);
    }
  }

  return Array.from(archetypeCounts.entries())
    .map(([archetype, count]) => ({
      archetype,
      presence: Math.min(count / 3, 1),
      manifestations: Array.from(archetypeManifestations.get(archetype) ?? []),
    }))
    .sort((a, b) => b.presence - a.presence);
}

// ─── NARRATIVE EXTRACTION ───────────────────────────────────────────────────────

function extractNarrative(text: string): string {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length === 0) return text.slice(0, 200);
  if (sentences.length <= 3) return sentences.join(". ") + ".";

  const opening = sentences[0]!;
  const middle = sentences[Math.floor(sentences.length / 2)]!;
  const closing = sentences[sentences.length - 1]!;

  return `${opening}. ... ${middle}. ... ${closing}.`;
}

// ─── RECURRENCE & LUCIDITY DETECTION ────────────────────────────────────────────

function detectLucidity(text: string): number {
  const lucidKeywords = ["knew", "realized", "aware", "lucid", "dreaming", "this is a dream", "control", "chose", "decided", "conscious"];
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of lucidKeywords) {
    if (lower.includes(kw)) count++;
  }
  return Math.min(count / 3, 1);
}

function detectRecurrence(text: string): number {
  const recurrenceKeywords = ["again", "recurring", "same dream", "repeated", "always", "often", "frequently", "every night", "keeps happening", "used to have"];
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of recurrenceKeywords) {
    if (lower.includes(kw)) count++;
  }
  return Math.min(count / 2, 1);
}

// ─── OVERALL INSIGHT GENERATION ─────────────────────────────────────────────────

function generateOverallInsight(
  themes: DreamThemeAnalysis[],
  archetypes: DreamArchetypeAnalysis[],
  emotions: DreamEmotionAnalysis[],
): string {
  const parts: string[] = [];

  if (themes.length > 0) {
    const topTheme = THEME_INTERPRETATIONS[themes[0]!.theme];
    parts.push(`Your dream centers on the theme of ${topTheme.name.toLowerCase()} — ${topTheme.coreMeaning.toLowerCase()}.`);
  }

  if (archetypes.length > 0) {
    const topArch = ARCHETYPE_PROFILES[archetypes[0]!.archetype];
    parts.push(`The ${topArch.name} archetype is strongly present, suggesting ${topArch.description.split(".")[0]?.toLowerCase() ?? "a powerful psychic dynamic at work"}.`);
  }

  if (emotions.length > 0) {
    const topEmo = EMOTION_PROFILES[emotions[0]!.emotion];
    parts.push(`The dominant emotion of ${topEmo.name.toLowerCase()} ${topEmo.meaning.split("—")[1]?.trim().toLowerCase() ?? "signals an important aspect of your inner life"}.`);
  }

  if (parts.length === 0) {
    return "Your dream contains subtle symbolic content worth exploring. Consider recording more details upon waking — the unconscious often reveals its messages gradually.";
  }

  return parts.join(" ");
}

// ─── MAIN ANALYSIS FUNCTION ─────────────────────────────────────────────────────

export function analyzeDream(text: string): DreamAnalysisResult {
  if (!text || text.trim().length < 10) {
    throw new Error("Please describe your dream in more detail — at least a few sentences.");
  }

  const symbols = extractSymbols(text);
  const themes = analyzeThemes(text, symbols);
  const archetypes = analyzeArchetypes(symbols);
  const emotions = detectEmotions(text);
  const narrative = extractNarrative(text);
  const lucidityIndicators = detectLucidity(text);
  const recurrenceIndicators = detectRecurrence(text);
  const overallInsight = generateOverallInsight(themes, archetypes, emotions);

  return {
    symbols,
    themes,
    archetypes,
    emotions,
    narrative,
    lucidityIndicators,
    recurrenceIndicators,
    overallInsight,
  };
}
