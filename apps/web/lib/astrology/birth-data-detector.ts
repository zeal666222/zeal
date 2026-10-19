// ============================================================================
// Birth Data Detector — Parses natural language messages for birth data
// ============================================================================
// Detects patterns like:
//   "I was born on 2 October 1969 at 7pm in Porbandar, India"
//   "Birth: 1969-10-02, 19:00, Porbandar"
//   "1869-10-02 19:00 Porbandar India"
// ============================================================================

export interface DetectedBirthData {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM (24h)
  birthPlace: { lat: number; lng: number };
  placeName: string;
  timezone?: string;
  confidence: "high" | "medium" | "low";
}

// ─── Date patterns ────────────────────────────────────────────────────────────

const DATE_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => string }> = [
  // ISO: 1969-10-02 or 1969/10/02
  {
    regex: /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    extract: (m) => {
      const y = m[1] ?? "2000";
      const mo = (m[2] ?? "01").padStart(2, "0");
      const d = (m[3] ?? "01").padStart(2, "0");
      return `${y}-${mo}-${d}`;
    },
  },
  // DD-MM-YYYY or DD/MM/YYYY
  {
    regex: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/,
    extract: (m) => {
      const d = (m[1] ?? "01").padStart(2, "0");
      const mo = (m[2] ?? "01").padStart(2, "0");
      const y = m[3] ?? "2000";
      return `${y}-${mo}-${d}`;
    },
  },
  // "2 October 1969", "Oct 2, 1969", "2nd Oct 1969"
  {
    regex: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
    extract: (m) => {
      const months: Record<string, string> = {
        jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
        apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
        aug: "08", august: "08", sep: "09", september: "09", oct: "10", october: "10",
        nov: "11", november: "11", dec: "12", december: "12",
      };
      const d = (m[1] ?? "01").padStart(2, "0");
      const mo = months[m[2]?.toLowerCase() ?? "jan"] ?? "01";
      const y = m[3] ?? "2000";
      return `${y}-${mo}-${d}`;
    },
  },
  // "October 2, 1969"
  {
    regex: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i,
    extract: (m) => {
      const months: Record<string, string> = {
        jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
        apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
        aug: "08", august: "08", sep: "09", september: "09", oct: "10", october: "10",
        nov: "11", november: "11", dec: "12", december: "12",
      };
      const mo = months[m[1]?.toLowerCase() ?? "jan"] ?? "01";
      const d = (m[2] ?? "01").padStart(2, "0");
      const y = m[3] ?? "2000";
      return `${y}-${mo}-${d}`;
    },
  },
];

// ─── Time patterns ────────────────────────────────────────────────────────────

const TIME_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => string | null }> = [
  // 12h WITH marker FIRST — otherwise "7:00 pm" is matched by the bare 24h
  // pattern and silently becomes 07:00 (a PM birth read as AM).
  {
    regex: /\b(\d{1,2})(?::(\d{2}))?\s*(?:a\.?m\.?|p\.?m\.?)\b/i,
    extract: (m) => {
      const h12 = parseInt(m[1] ?? "0", 10);
      const min = m[2] ?? "00";
      if (h12 < 1 || h12 > 12) return null;
      const isPm = /p/i.test(m[0]);
      const h = isPm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
      const mm = parseInt(min, 10);
      if (mm < 0 || mm > 59) return null;
      return `${String(h).padStart(2, "0")}:${min}`;
    },
  },
  // 24h: 19:00 or 19:00:00
  {
    regex: /\b(\d{1,2}):(\d{2})(?::\d{2})?\b/,
    extract: (m) => {
      const h = parseInt(m[1] ?? "0", 10);
      const min = parseInt(m[2] ?? "0", 10);
      if (h > 23 || min > 59) return null;
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    },
  },
];

// ─── Known cities (lat/lng) ──────────────────────────────────────────────────

const KNOWN_CITIES: Record<string, { lat: number; lng: number; timezone: string }> = {
  // India
  "porbandar": { lat: 21.6417, lng: 69.6293, timezone: "Asia/Kolkata" },
  "mumbai": { lat: 19.076, lng: 72.8777, timezone: "Asia/Kolkata" },
  "bombay": { lat: 19.076, lng: 72.8777, timezone: "Asia/Kolkata" },
  "delhi": { lat: 28.6139, lng: 77.209, timezone: "Asia/Kolkata" },
  "new delhi": { lat: 28.6139, lng: 77.209, timezone: "Asia/Kolkata" },
  "kolkata": { lat: 22.5726, lng: 88.3639, timezone: "Asia/Kolkata" },
  "calcutta": { lat: 22.5726, lng: 88.3639, timezone: "Asia/Kolkata" },
  "chennai": { lat: 13.0827, lng: 80.2707, timezone: "Asia/Kolkata" },
  "madras": { lat: 13.0827, lng: 80.2707, timezone: "Asia/Kolkata" },
  "bangalore": { lat: 12.9716, lng: 77.5946, timezone: "Asia/Kolkata" },
  "bengaluru": { lat: 12.9716, lng: 77.5946, timezone: "Asia/Kolkata" },
  "hyderabad": { lat: 17.385, lng: 78.4867, timezone: "Asia/Kolkata" },
  "pune": { lat: 18.5204, lng: 73.8567, timezone: "Asia/Kolkata" },
  "jaipur": { lat: 26.9124, lng: 75.7873, timezone: "Asia/Kolkata" },
  "lucknow": { lat: 26.8467, lng: 80.9462, timezone: "Asia/Kolkata" },
  "varanasi": { lat: 25.3176, lng: 82.9739, timezone: "Asia/Kolkata" },
  "benares": { lat: 25.3176, lng: 82.9739, timezone: "Asia/Kolkata" },
  "ahmedabad": { lat: 23.0225, lng: 72.5714, timezone: "Asia/Kolkata" },
  "patna": { lat: 25.6093, lng: 85.1376, timezone: "Asia/Kolkata" },
  "kochi": { lat: 9.9312, lng: 76.2673, timezone: "Asia/Kolkata" },
  "cochin": { lat: 9.9312, lng: 76.2673, timezone: "Asia/Kolkata" },
  "thiruvananthapuram": { lat: 8.5241, lng: 76.9366, timezone: "Asia/Kolkata" },
  // International
  "london": { lat: 51.5074, lng: -0.1278, timezone: "Europe/London" },
  "new york": { lat: 40.7128, lng: -74.006, timezone: "America/New_York" },
  "los angeles": { lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles" },
  "chicago": { lat: 41.8781, lng: -87.6298, timezone: "America/Chicago" },
  "toronto": { lat: 43.6532, lng: -79.3832, timezone: "America/Toronto" },
  "sydney": { lat: -33.8688, lng: 151.2093, timezone: "Australia/Sydney" },
  "melbourne": { lat: -37.8136, lng: 144.9631, timezone: "Australia/Melbourne" },
  "tokyo": { lat: 35.6762, lng: 139.6503, timezone: "Asia/Tokyo" },
  "singapore": { lat: 1.3521, lng: 103.8198, timezone: "Asia/Singapore" },
  "dubai": { lat: 25.2048, lng: 55.2708, timezone: "Asia/Dubai" },
  "paris": { lat: 48.8566, lng: 2.3522, timezone: "Europe/Paris" },
  "berlin": { lat: 52.52, lng: 13.405, timezone: "Europe/Berlin" },
  "moscow": { lat: 55.7558, lng: 37.6173, timezone: "Europe/Moscow" },
  "kathmandu": { lat: 27.7172, lng: 85.324, timezone: "Asia/Kathmandu" },
  "colombo": { lat: 6.9271, lng: 79.8612, timezone: "Asia/Colombo" },
  "dhaka": { lat: 23.8103, lng: 90.4125, timezone: "Asia/Dhaka" },
  "karachi": { lat: 24.8607, lng: 67.0011, timezone: "Asia/Karachi" },
  "lahore": { lat: 31.5204, lng: 74.3587, timezone: "Asia/Karachi" },
};

// ─── Main detection function ──────────────────────────────────────────────────

export function detectBirthData(message: string): DetectedBirthData | null {
  const lower = message.toLowerCase();

  // Check if the message is likely about birth data / astrology
  const astrologyKeywords = [
    "born", "birth", "janam", "janma", "jatak",
    "ascendant", "rising sign", "moon sign", "sun sign",
    "horoscope", "kundli", "kundali", "chart",
    "rashi", "navamsa", "dasha", "mahadasha",
    "nakshatra", "lagna", "astrology", "vedic",
    "birth date", "birth time", "birth place",
    "date of birth", "time of birth", "place of birth",
    "i was born", "my birth",
  ];

  const hasAstrologyContext = astrologyKeywords.some((kw) => lower.includes(kw));

  // Extract date
  let birthDate: string | null = null;
  for (const pattern of DATE_PATTERNS) {
    const match = lower.match(pattern.regex);
    if (match) {
      birthDate = pattern.extract(match);
      break;
    }
  }

  // Extract time
  let birthTime: string | null = null;
  for (const pattern of TIME_PATTERNS) {
    const match = lower.match(pattern.regex);
    if (!match) continue;
    const extracted = pattern.extract(match);
    if (extracted) {
      birthTime = extracted;
      break;
    }
  }

  // Extract place
  let placeName: string | null = null;
  let placeCoords: { lat: number; lng: number } | null = null;
  let timezone: string | undefined;

  for (const [city, data] of Object.entries(KNOWN_CITIES)) {
    if (lower.includes(city)) {
      placeName = city;
      placeCoords = { lat: data.lat, lng: data.lng };
      timezone = data.timezone;
      break;
    }
  }

  // If no known city, try to extract a place name after "in" or "at"
  if (!placeName) {
    const placeMatch = lower.match(/\b(?:in|at|from)\s+([a-z][a-z\s]{2,25}?)(?:\s*,|\s*\.|\s*$|\s+on|\s+at)/i);
    if (placeMatch) {
      placeName = placeMatch[1]?.trim() ?? null;
      // We can't geocode without an API, so skip if not a known city
      placeName = null;
    }
  }

  // Determine confidence
  const hasDate = birthDate !== null;
  const hasTime = birthTime !== null;
  const hasPlace = placeName !== null && placeCoords !== null;

  if (!hasDate || !hasTime || !hasPlace) {
    // Need at least date + time, or date + place with astrology context
    if (!hasDate) return null;
    if (!hasTime && !hasPlace) return null;
    if (!hasTime && !hasAstrologyContext) return null;
  }

  // If we have date but no time, default to noon
  if (!birthTime) birthTime = "12:00";

  // If we have date + time but no place, we can't compute a chart
  if (!placeCoords) return null;

  // Validate date is reasonable (1900 .. current year)
  const year = parseInt((birthDate ?? "").slice(0, 4), 10);
  if (year < 1900 || year > new Date().getUTCFullYear()) return null;

  const confidence = hasDate && hasTime && hasPlace && hasAstrologyContext
    ? "high"
    : hasDate && hasTime && hasPlace
      ? "medium"
      : "low";

  return {
    birthDate: birthDate!,
    birthTime: birthTime!,
    birthPlace: placeCoords!,
    placeName: placeName!,
    timezone,
    confidence,
  };
}

// ─── Format birth data for prompt injection ───────────────────────────────────

export function formatBirthDataForPrompt(birth: DetectedBirthData): string {
  return `[ASTROLOGY CONTEXT] The user has provided their birth data:
- Date: ${birth.birthDate}
- Time: ${birth.birthTime}
- Place: ${birth.placeName} (${birth.birthPlace.lat.toFixed(4)}, ${birth.birthPlace.lng.toFixed(4)})
${birth.timezone ? `- Timezone: ${birth.timezone}` : ""}

Use this birth data to provide Vedic astrology insights when relevant to the conversation. Reference planetary positions, dashas, and classical interpretations as appropriate.`;
}
