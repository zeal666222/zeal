// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/fillers — FillerEngine
// ═══════════════════════════════════════════════════════════════════════════════
// Hindi + English fillers that mask latency. Never generic — always warm and
// in-character for a human consultant.
//
// Empirical basis:
//   • Typing indicators within 200-500ms cut abandonment by ~40%.
//   • Conversational fillers improve perceived speed during high-latency.
//   • After 5s of silence, a status update is required.
// ═══════════════════════════════════════════════════════════════════════════════

export type FillerReason = "first-token" | "slow" | "fallback";
export type FillerLocale = "hi-en" | "en" | "hi";

const FILLERS: Record<FillerLocale, Record<FillerReason, string[]>> = {
  "hi-en": {
    "first-token": [
      "Hmm, let me check that for you…",
      "Acha, ek minute — main dekh raha hu…",
      "Thoda ruko, main aapke liye check karta hu…",
      "Hmm, interesting question. Let me think…",
      "Ek second, main dhyan se dekh raha hu…",
      "Haan ji, main samajh raha hu. Let me reflect…",
      "Acha, ye important hai. Let me look closer…",
    ],
    "slow": [
      "Hmm, thoda time lag raha hai — main carefully dekh raha hu…",
      "Almost there, bas ek moment aur…",
      "Aapke liye sahi answer dhundh raha hu, thoda ruko…",
      "Just a moment, I want to give you an accurate answer…",
      "Ek minute, main aur detail check kar raha hu…",
    ],
    "fallback": [
      "Hmm, let me try another way to look at this…",
      "Ek different approach se dekhta hu…",
      "Let me reconsider — ek minute…",
    ],
  },
  en: {
    "first-token": [
      "Hmm, let me check that for you…",
      "Let me think about this carefully…",
      "One moment, I'm looking into it…",
      "That's a good question — let me reflect…",
      "Give me a second, I want to get this right…",
    ],
    "slow": [
      "Almost there — just a moment longer…",
      "I'm working through this carefully…",
      "Let me double-check to make sure this is accurate…",
    ],
    "fallback": [
      "Let me try another angle…",
      "Let me reconsider…",
    ],
  },
  hi: {
    "first-token": [
      "हम्म, मैं देख रहा हूँ…",
      "एक मिनट, मैं आपके लिए चेक करता हूँ…",
      "थोड़ा रुको, मैं ध्यान से देख रहा हूँ…",
    ],
    "slow": [
      "बस एक पल, मैं सही जवाब ढूंढ रहा हूँ…",
      "थोड़ा और समय दीजिए, मैं ठीक से देख रहा हूँ…",
    ],
    "fallback": [
      "एक और तरीके से देखता हूँ…",
    ],
  },
};

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length] ?? list[0] ?? "";
}

export class FillerEngine {
  private readonly locale: FillerLocale;
  private counter = 0;
  private lastEmittedAt = 0;
  private readonly minGapMs: number;

  constructor(locale: FillerLocale = "hi-en", minGapMs = 2_500) {
    this.locale = locale;
    this.minGapMs = minGapMs;
  }

  next(reason: FillerReason): string | null {
    const now = Date.now();
    if (now - this.lastEmittedAt < this.minGapMs) return null;
    this.lastEmittedAt = now;
    this.counter++;
    return pick(FILLERS[this.locale][reason], this.counter * 7 + reason.length);
  }

  nextForce(reason: FillerReason): string {
    this.lastEmittedAt = Date.now();
    this.counter++;
    return pick(FILLERS[this.locale][reason], this.counter * 7 + reason.length);
  }
}
