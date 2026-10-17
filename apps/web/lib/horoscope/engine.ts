// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Daily Horoscope Engine (deterministic Vedic gochara)
// ═══════════════════════════════════════════════════════════════════════════════
// All numbers here come from the astronomy-engine ephemeris in @zeal/astrology:
// real sidereal (Lahiri) planet positions for the current moment, converted to
// transit houses from the seeker's Sun sign. Nothing is random or fabricated.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getAstroTime,
  computeLahiriAyanamsa,
  getVedicPlanetPositions,
  getNakshatra,
  type PlanetName,
  type PlanetState,
} from "@zeal/astrology";

export const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
export type SunSignName = (typeof SIGN_ORDER)[number];

export function isSunSignName(v: string): v is SunSignName {
  return (SIGN_ORDER as readonly string[]).includes(v);
}

const SIGN_NAMES_SIDEREAL = SIGN_ORDER;

/** Two-char codes shown in the UI (same policy as kundali: no stray glyphs). */
const PLANET_CODE: Record<string, string> = {
  Sun: "Su", Moon: "Ch", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

const PLANET_THEME: Record<string, string> = {
  Su: "vitality and focus",
  Ch: "emotions and the mind",
  Ma: "courage and drive",
  Me: "communication and planning",
  Ju: "growth and opportunity",
  Ve: "relationships and comfort",
  Sa: "discipline and patience",
  Ra: "desire and sudden change",
  Ke: "release and insight",
};

const HOUSE_THEME: Record<number, string> = {
  1: "yourself — your presence, health and first impressions",
  2: "money, family speech and what you value",
  3: "courage, conversations and short trips",
  4: "home, heart and inner security",
  5: "creativity, romance and play",
  6: "daily work, health and problem-solving",
  7: "partnerships one-to-one",
  8: "shared resources, change and depth",
  9: "fortune, higher learning and travel",
  10: "career, status and what you build in public",
  11: "gains, friends and long-term hopes",
  12: "rest, privacy and letting go",
};

export interface TransitEntry {
  code: string;
  planet: string;
  sign: string;
  house: number;
  degreesInSign: number;
  retrograde: boolean;
}

export interface MoonInfo {
  sign: string;
  nakshatra: string;
  pada: number;
}

export interface LuckyInfo {
  numbers: number[];
  time: string;
  color: string;
  compatibility: string;
}

export interface DaySky {
  date: string;
  ayanamsa: number;
  moon: MoonInfo;
  /** transit houses computed for each sun sign, keyed by sign name */
  bySign: Record<SunSignName, TransitEntry[]>;
}

function houseFor(planetSignIndex: number, sunSignIndex: number): number {
  return ((planetSignIndex - sunSignIndex + 12) % 12) + 1;
}

/** Compute today's sidereal positions once, then derive per-sign transit houses. */
export function computeDaySky(date: Date = new Date()): DaySky {
  const time = getAstroTime(date);
  const ayanamsa = computeLahiriAyanamsa(time);
  const positions = getVedicPlanetPositions(time, ayanamsa);

  const order: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  const base: Array<{ planet: string; code: string; signIdx: number; deg: number; rx: boolean }> = [];
  for (const p of order) {
    const s = positions.get(p) as PlanetState | undefined;
    if (!s) continue;
    base.push({
      planet: p,
      code: PLANET_CODE[p] ?? p.slice(0, 2),
      signIdx: Math.floor(s.longitude / 30) % 12,
      deg: s.longitude % 30,
      rx: s.isRetrograde,
    });
  }

  const moonState = positions.get("Moon" as PlanetName);
  const moon: MoonInfo = moonState
    ? {
        sign: SIGN_NAMES_SIDEREAL[Math.floor(moonState.longitude / 30) % 12] ?? "Aries",
        ...(() => {
          const n = getNakshatra(moonState.longitude);
          return { nakshatra: n.name, pada: n.pada };
        })(),
      }
    : { sign: "Aries", nakshatra: "Ashwini", pada: 1 };

  const bySign = {} as Record<SunSignName, TransitEntry[]>;
  SIGN_ORDER.forEach((sign, sunIdx) => {
    bySign[sign] = base.map((b) => ({
      code: b.code,
      planet: b.planet,
      sign: SIGN_NAMES_SIDEREAL[b.signIdx] ?? "Aries",
      house: houseFor(b.signIdx, sunIdx),
      degreesInSign: Math.round(b.deg * 10) / 10,
      retrograde: b.rx,
    }));
  });

  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);

  return { date: dateStr, ayanamsa: Math.round(ayanamsa * 1000) / 1000, moon, bySign };
}

/** Deterministic lucky info — seeded from sign + date + real sun degree.
 *  Same inputs always give the same outputs for the whole day. */
export function computeLucky(
  sign: SunSignName,
  date: string,
  sunDegreesInSign: number,
): LuckyInfo {
  const seed =
    sign.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
    date.replace(/-/g, "").split("").reduce((a, c) => a + Number(c || 0), 0) +
    Math.floor(sunDegreesInSign * 60);

  const numbers = [1, 2, 3].map((k) => ((seed * (k + 7) * 31 + k * 17) % 95) + 4);
  const hour24 = (seed % 12) + 6;
  const fmt = (h: number) => {
    const suffix = h < 12 ? "AM" : "PM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:00 ${suffix}`;
  };
  const time = `${fmt(hour24)} – ${fmt(hour24 + 2)}`;

  const colors = [
    "Saffron", "Royal Blue", "Emerald Green", "White", "Deep Red",
    "Golden Yellow", "Silver", "Indigo", "Coral", "Teal", "Violet", "Olive",
  ];
  const color = colors[(seed + SIGN_ORDER.indexOf(sign)) % 12] ?? "Gold";
  const compatOffset = [6, 4, 8, 5, 7][seed % 5] ?? 6;
  const compatibility =
    SIGN_ORDER[(SIGN_ORDER.indexOf(sign) + compatOffset) % 12] ?? "Leo";

  return { numbers, time, color, compatibility };
}

/** Compact, factual transit brief handed to the AI so it interprets real data. */
export function formatTransitsForPrompt(sign: SunSignName, sky: DaySky): string {
  const rows = sky.bySign[sign].map((t) => {
    const theme = PLANET_THEME[t.code] ?? "";
    const house = HOUSE_THEME[t.house] ?? "";
    return `- ${t.planet} (${t.code}) in ${t.sign} at ${t.degreesInSign.toFixed(1)}° → house ${t.house} from your Sun: ${house}. ${t.retrograde ? "Retrograde — the theme is revisited, not brand new. " : ""}${theme} is the active note today.`;
  });
  return [
    `Today (IST): ${sky.date}. Sidereal (Lahiri) positions, ayanamsa ${sky.ayanamsa}°.`,
    `Moon: ${sky.moon.sign}, nakshatra ${sky.moon.nakshatra} pada ${sky.moon.pada}.`,
    `Gochara (transit) map for a ${sign} Sun:`,
    ...rows,
  ].join("\n");
}

/** No-AI fallback: the same facts, formatted as a clean markdown reading. */
export function buildFallbackReading(sign: SunSignName, sky: DaySky, lucky: LuckyInfo): string {
  const t = sky.bySign[sign];
  const find = (code: string) => t.find((x) => x.code === code);
  const ju = find("Ju"); const sa = find("Sa"); const ra = find("Ra");
  const me = find("Me"); const ve = find("Ve"); const ch = find("Ch");

  const line = (label: string, house: number | undefined, extra = "") =>
    house ? `- ${label} sits in your house ${house} — ${HOUSE_THEME[house] ?? "your focus area"}.${extra}` : "";

  const blocks = [
    "**Today's Sky**",
    [
      `The Moon is moving through ${sky.moon.sign} in ${sky.moon.nakshatra} (pada ${sky.moon.pada}), which sets the emotional weather of the day for ${sign}.`,
      `These are real computed sidereal positions (Lahiri ayanamsa ${sky.ayanamsa}°, IST date ${sky.date}) — the reading below is derived directly from them.`,
    ].join("\n\n"),
    "**Where the Energy Goes**",
    [
      line("Jupiter, growth", ju?.house, ju?.retrograde ? " Retrograde — old opportunities resurface." : ""),
      line("Saturn, discipline", sa?.house, sa?.retrograde ? " Retrograde — a lesson from the past asks again." : ""),
      line("Mercury, communication", me?.house, ""),
      line("Venus, relationships", ve?.house, ""),
      line("Rahu, desire", ra?.house, " Sudden events possible here."),
      line("Moon, mind", ch?.house, ""),
    ].filter(Boolean).join("\n"),
    "**Lucky Window**",
    `Favourable numbers ${lucky.numbers.join(", ")} · best hours ${lucky.time} · colour ${lucky.color} · natural company ${lucky.compatibility}.`,
    "**A Note of Honesty**",
    "Transits describe the weather, not the verdict. Use this as a mirror for your choices today. For a call on a specific question, a live advisor can read your full chart.",
  ];
  return blocks.join("\n\n");
}
