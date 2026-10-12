// apps/web/lib/dream/types.ts

export type DreamEmotion = "joy" | "fear" | "anxiety" | "sadness" | "anger" | "confusion" | "peace" | "awe" | "loneliness" | "love";
export type DreamTheme = "falling" | "flying" | "being_chased" | "teeth" | "water" | "death" | "animals" | "naked" | "exam" | "lost" | "house" | "vehicle" | "nature" | "family" | "work" | "supernatural";
export type DreamArchetype = "shadow" | "anima" | "animus" | "self" | "persona" | "wise_old_man" | "great_mother" | "trickster" | "hero" | "divine_child";
export type DreamElement = "symbol" | "character" | "location" | "object" | "action" | "emotion" | "color" | "number";

export interface DreamSymbol {
  symbol: string;
  category: DreamElement;
  archetypes: DreamArchetype[];
  themes: DreamTheme[];
  emotions: DreamEmotion[];
  personalContext?: string;
}

export interface DreamThemeAnalysis {
  theme: DreamTheme;
  intensity: number;
  variations: string[];
}

export interface DreamArchetypeAnalysis {
  archetype: DreamArchetype;
  presence: number;
  manifestations: string[];
}

export interface DreamEmotionAnalysis {
  emotion: DreamEmotion;
  intensity: number;
  triggers: string[];
}

export interface DreamAnalysisResult {
  symbols: DreamSymbol[];
  themes: DreamThemeAnalysis[];
  archetypes: DreamArchetypeAnalysis[];
  emotions: DreamEmotionAnalysis[];
  narrative: string;
  lucidityIndicators: number;
  recurrenceIndicators: number;
  overallInsight: string;
}

export interface DreamReading {
  analysis: DreamAnalysisResult;
  summary: string;
  sections: DreamReadingSection[];
}

export interface DreamReadingSection {
  title: string;
  icon: string;
  content: string;
  insights: string[];
}

export const DREAM_FOCUS_OPTIONS = [
  { value: "general", label: "General Interpretation", icon: "🌙" },
  { value: "psychological", label: "Psychological Insight", icon: "🧠" },
  { value: "spiritual", label: "Spiritual Meaning", icon: "✨" },
  { value: "emotional", label: "Emotional Healing", icon: "💚" },
  { value: "guidance", label: "Life Guidance", icon: "🧭" },
  { value: "creative", label: "Creative Inspiration", icon: "🎨" },
] as const;

export type DreamFocus = (typeof DREAM_FOCUS_OPTIONS)[number]["value"];
