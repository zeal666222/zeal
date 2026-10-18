// ═══════════════════════════════════════════════════════════════════════════════
// Semantic stage events — persona-aware "thinking out loud" labels
// ───────────────────────────────────────────────────────────────────────────────
// Between the user hitting Send and the first model token arriving we have a
// 400-2000 ms window that would otherwise render as three bouncing dots. We
// fill it with short, in-character labels ("Consulting your Lagna…",
// "Shuffling the Rider-WaSmith deck…") so the assistant feels like it is
// actually *working*, in the register the persona would use.
//
// Stages are keyed off `persona.category` (matches `ai_consultant.category`
// in D1) with an "astrology" default. Labels stay in Hinglish when the
// incoming user turn is Hinglish/Hindi, English otherwise — matches the
// UI language policy (English surface, Hinglish AI voice).
// ═══════════════════════════════════════════════════════════════════════════════

export type StageLocale = "hi-en" | "hi" | "en";

export interface StageEvent {
  /** 0-based position so client can animate a stepper. */
  index: number;
  /** Machine key, e.g. "consulting-ephemeris". */
  key: string;
  /** Human label shown in the UI. */
  label: string;
  /** Total stages in this sequence (for "1 of 3" affordances). */
  total: number;
}

interface CategoryScript {
  hiEn: string[];
  en: string[];
}

const SCRIPTS: Record<string, CategoryScript> = {
  astrology: {
    hiEn: [
      "Kundali ka base chart nikaal rahi hoon…",
      "Aapke Lagna aur Moon sign ko cross-check kar rahi hoon…",
      "Abhi dasha sequence dekh rahi hoon…",
      "Transits se match karke final reading bana rahi hoon…",
    ],
    en: [
      "Pulling your base natal chart…",
      "Cross-checking Lagna and Moon sign…",
      "Reviewing the active dasha sequence…",
      "Aligning with current transits…",
    ],
  },
  tarot: {
    hiEn: [
      "Deck ko shuffle kar rahi hoon…",
      "Aapke sawaal ke liye cards nikal rahi hoon…",
      "Position aur reversals dekh rahi hoon…",
      "Spread ka narrative jod rahi hoon…",
    ],
    en: [
      "Shuffling the deck…",
      "Drawing three cards for your question…",
      "Reading positions and reversals…",
      "Weaving the spread into a story…",
    ],
  },
  numerology: {
    hiEn: [
      "Naam aur date of birth ke digits nikaal rahi hoon…",
      "Life Path aur Destiny number derive kar rahi hoon…",
      "Personal year cycle check kar rahi hoon…",
    ],
    en: [
      "Reducing name and birth-date digits…",
      "Deriving Life Path and Destiny numbers…",
      "Checking your personal year cycle…",
    ],
  },
  kundali: {
    hiEn: [
      "Exact birth coordinates pin kar rahi hoon…",
      "Sidereal degrees compute kar rahi hoon…",
      "Navamsa aur divisional charts verify kar rahi hoon…",
      "Yoga doshas scan kar rahi hoon…",
    ],
    en: [
      "Pinning your exact birth coordinates…",
      "Computing sidereal degrees…",
      "Verifying Navamsa and divisional charts…",
      "Scanning yogas and doshas…",
    ],
  },
  horoscope: {
    hiEn: [
      "Aajke transits load kar rahi hoon…",
      "Aapke Moon sign se map kar rahi hoon…",
      "Bhaagya-anusar notes bana rahi hoon…",
    ],
    en: [
      "Loading today's transits…",
      "Mapping them onto your Moon sign…",
      "Composing the day's guidance…",
    ],
  },
  panchang: {
    hiEn: [
      "Aajke tithi, nakshatra aur yoga nikaal rahi hoon…",
      "Rahu Kaal aur Shubh Muhurat check kar rahi hoon…",
    ],
    en: [
      "Computing today's tithi, nakshatra and yoga…",
      "Marking Rahu Kaal and Shubh Muhurat…",
    ],
  },
  milan: {
    hiEn: [
      "Dono kundali ke Ashtakoot nikaal rahi hoon…",
      "Mangal dosha match check kar rahi hoon…",
      "36-guna score assemble kar rahi hoon…",
    ],
    en: [
      "Extracting Ashtakoot from both kundalis…",
      "Cross-checking Mangal dosha match…",
      "Assembling the 36-guna score…",
    ],
  },
  dream: {
    hiEn: [
      "Sapne ke symbols decode kar rahi hoon…",
      "Subconscious themes se map kar rahi hoon…",
      "Vedic + Jungi lenses laga rahi hoon…",
    ],
    en: [
      "Decoding the symbols from your dream…",
      "Mapping them against subconscious themes…",
      "Applying Vedic and Jungian lenses…",
    ],
  },
  palmistry: {
    hiEn: [
      "Image quality check kar rahi hoon…",
      "Life line, head line, heart line trace kar rahi hoon…",
      "Mounts aur chhaniyan scan kar rahi hoon…",
    ],
    en: [
      "Checking image clarity…",
      "Tracing life, head and heart lines…",
      "Scanning mounts and markings…",
    ],
  },
  therapy: {
    hiEn: [
      "Aapke words ko dhyaan se padh rahi hoon…",
      "Emotional themes identify kar rahi hoon…",
      "Ek grounded response taiyaar kar rahi hoon…",
    ],
    en: [
      "Reading your words carefully…",
      "Identifying the emotional themes…",
      "Composing a grounded response…",
    ],
  },
  vastu: {
    hiEn: [
      "Direction aur layout ka map bana rahi hoon…",
      "Paanch tatva ke balance dekh rahi hoon…",
    ],
    en: [
      "Mapping the directions and layout…",
      "Checking the balance of the five elements…",
    ],
  },
};

function pickBucket(category: string | undefined): string {
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

export function pickStageLocale(text: string): StageLocale {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  // Detect romanised Hindi by common tokens.
  if (/\b(kya|kaise|kaisa|meri|mera|mujhe|aap|hai|nahi|karna|karo|kyu|kyon|kyunki|sath|bahut|zyada|thoda|kal|aaj)\b/i.test(text)) {
    return "hi-en";
  }
  return "en";
}

export function buildStageSequence(
  category: string | undefined,
  locale: StageLocale,
): StageEvent[] {
  const bucket = pickBucket(category);
  const script = SCRIPTS[bucket] ?? SCRIPTS.astrology;
  const labels = locale === "en" ? script.en : (locale === "hi" ? script.hiEn : script.hiEn);
  return labels.map((label, index) => ({
    index,
    key: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40),
    label,
    total: labels.length,
  }));
}
