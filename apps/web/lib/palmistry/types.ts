// apps/web/lib/palmistry/types.ts

export type HandSide = "left" | "right";
export type HandElement = "fire" | "earth" | "air" | "water";
export type FingerShape = "square" | "conic" | "spatulate" | "pointed";
export type LineQuality = "strong" | "moderate" | "faint" | "absent";
export type LineCurvature = "straight" | "slight_curve" | "curved" | "wavy";
export type MountDevelopment = "over_developed" | "well_developed" | "moderate" | "flat";

export interface LineAnalysis {
  present: boolean;
  quality: LineQuality;
  length: "short" | "medium" | "long";
  depth: number;
  curvature: LineCurvature;
  branches: number;
  breaks: number;
  chains: boolean;
  forks: number;
  islands: boolean;
  startRegion?: string;
  endRegion?: string;
  score: number;
}

export interface MountAnalysis {
  name: string;
  planet: string;
  development: MountDevelopment;
  score: number;
}

export interface HandShapeAnalysis {
  element: HandElement;
  palmWidth: number;
  palmLength: number;
  fingerLength: number;
  fingerRatio: number;
  dominantFingerShape: FingerShape;
  confidence: number;
}

export interface PalmAnalysisResult {
  handSide: HandSide;
  handShape: HandShapeAnalysis;
  lines: {
    heart: LineAnalysis;
    head: LineAnalysis;
    life: LineAnalysis;
    fate: LineAnalysis;
    sun: LineAnalysis;
    marriage: LineAnalysis;
  };
  mounts: MountAnalysis[];
  overallScore: number;
  dominantTraits: string[];
  imageUrl?: string;
}

export interface PalmReading {
  analysis: PalmAnalysisResult;
  summary: string;
  sections: ReadingSection[];
  aiSynthesis?: string;
}

export interface ReadingSection {
  title: string;
  icon: string;
  content: string;
  highlights: string[];
  score: number;
}

export interface PalmUploadState {
  phase: "intro" | "upload" | "analyzing" | "visualizing" | "reading";
  image: string | null;
  analysis: PalmAnalysisResult | null;
  reading: PalmReading | null;
  handSide: HandSide;
  primaryFocus: string;
  error: string | null;
}

export const PALM_LINES = [
  "heart",
  "head",
  "life",
  "fate",
  "sun",
  "marriage",
] as const;

export type PalmLineName = (typeof PALM_LINES)[number];

export const MOUNT_NAMES = [
  "venus",
  "jupiter",
  "saturn",
  "apollo",
  "mercury",
  "moon",
  "mars_positive",
  "mars_negative",
] as const;

export type MountName = (typeof MOUNT_NAMES)[number];

export const PRIMARY_FOCUS_OPTIONS = [
  { value: "general", label: "General Reading", icon: "✨" },
  { value: "love", label: "Love & Relationships", icon: "💕" },
  { value: "career", label: "Career & Destiny", icon: "🎯" },
  { value: "health", label: "Health & Vitality", icon: "🌿" },
  { value: "spiritual", label: "Spiritual Growth", icon: "🔮" },
  { value: "finance", label: "Wealth & Prosperity", icon: "💰" },
] as const;
