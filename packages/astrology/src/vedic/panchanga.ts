// ============================================================================
// Panchanga - The five limbs of the Hindu calendar
// ============================================================================
// Tithi, Nakshatra, Yoga and Karana are *intervals*, not labels: a tithi ends
// when the Moon-Sun elongation crosses the next multiple of 12°, a nakshatra
// when the Moon crosses the next 13°20'. So along with the value in effect at
// the instant asked about, we publish the instant each one runs out — that is
// what makes "is this birth in Chitra?" answerable instead of guessable.
//
// The instant must be the true local instant: reading "1990-08-15T14:35" as if
// it were UTC shifts the whole computation by the place's offset (5h30m for
// India), which is a third of a nakshatra and enough to rename the birth star.
// ============================================================================

import type { Panchanga, BirthData } from "../types";
import { getVedicPlanetPositions, getAstroTime } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { NAKSHATRAS, parseBirthDateTime } from "./rashi";

/** Tithi names, by index within a paksha (0-14). */
const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
];

/** The 15th of the bright half and the dark half have their own names. */
const FULL_MOON = "Purnima";
const NEW_MOON = "Amavasya";

/** Yoga names (27 yogas). */
const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
];

/** The 7 movable karanas, repeated 7 times through the dark+bright half. */
const MOVABLE_KARANA = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"];
/** The 4 fixed karanas, in their canonical slots (1, 58, 59, 60). */
const FIXED_KARANA = ["Kimstughna", "Shakuni", "Chatushpada", "Naga"];

const NAKSHATRA_SPAN = 360 / 27;

/**
 * Name the karana from its number in the 60-karana cycle.
 * Slot 1 is Kimstughna, slots 58-60 are the other three fixed karanas, and the
 * 49 slots between them cycle the 7 movable ones.
 */
export function karanaNameFor(number: number): string {
  if (number === 1) return FIXED_KARANA[0]!;
  if (number >= 58) return FIXED_KARANA[number - 57]!;
  return MOVABLE_KARANA[(number - 2) % 7]!;
}

/**
 * Compute the Tithi from the Moon-Sun elongation.
 */
function computeTithi(sunLon: number, moonLon: number): {
  name: string;
  number: number;
  paksha: "Shukla" | "Krishna";
} {
  const diff = ((moonLon - sunLon) % 360 + 360) % 360;
  const number = Math.floor(diff / 12) + 1; // 1-30
  const paksha: "Shukla" | "Krishna" = number <= 15 ? "Shukla" : "Krishna";
  const indexInPaksha = ((number - 1) % 15) + 1; // 1-15
  const name = indexInPaksha === 15 ? (paksha === "Shukla" ? FULL_MOON : NEW_MOON) : TITHI_NAMES[indexInPaksha - 1]!;

  return { name, number, paksha };
}

/**
 * Compute Karana (half a tithi) from the elongation.
 */
function computeKarana(sunLon: number, moonLon: number): { name: string; number: number } {
  const diff = ((moonLon - sunLon) % 360 + 360) % 360;
  const number = Math.floor(diff / 6) + 1; // 1-60
  return { name: karanaNameFor(number), number };
}

/**
 * Compute Yoga from the combined (sidereal) Sun+Moon longitude.
 */
function computeYoga(sunLon: number, moonLon: number): { name: string; number: number } {
  const combined = (sunLon + moonLon) % 360;
  const number = Math.floor(combined / NAKSHATRA_SPAN) + 1; // 1-27
  return { name: YOGA_NAMES[(number - 1) % 27]!, number };
}

/**
 * Find the instant a monotonically-increasing angular value next crosses a
 * multiple of `step`, by bisection inside `windowDays`.
 *
 * Values are unwrapped relative to the start so a crossing at the 360° seam is
 * still found; the 12-13°/day drift of these quantities never approaches the
 * wraparound inside the window used.
 */
function nextCrossing(
  valueAt: (date: Date) => number,
  from: Date,
  step: number,
  windowDays: number,
): string | null {
  const start = valueAt(from);
  const goal = (Math.floor(start / step) + 1) * step - start; // > 0, <= step
  const spanMs = windowDays * 86400000;

  const drift = (ms: number): number => {
    let d = valueAt(new Date(from.getTime() + ms)) - start;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  if (drift(spanMs) < goal) return null; // no crossing inside the window

  let lo = 0;
  let hi = spanMs;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (drift(mid) < goal) lo = mid;
    else hi = mid;
  }
  return new Date(from.getTime() + (lo + hi) / 2).toISOString();
}

/** Sidereal Sun/Moon longitudes at an instant. */
function sunMoonAt(date: Date): { sun: number; moon: number; nak: number } {
  const time = getAstroTime(date);
  const ayanamsa = getAyanamsa(time, "lahiri");
  const states = getVedicPlanetPositions(time, ayanamsa);
  const sun = states.get("Sun")?.longitude ?? 0;
  const moon = states.get("Moon")?.longitude ?? 0;
  return { sun, moon, nak: moon };
}

/**
 * Compute the Panchanga for a birth (or any) instant, in the place's own
 * timezone — tithi/nakshatra/yoga/karana in effect, plus when each one ends.
 */
export function computePanchanga(birthData: BirthData): Panchanga {
  const instant = parseBirthDateTime(birthData);
  const at = sunMoonAt(instant);

  const tithi = computeTithi(at.sun, at.moon);
  const karana = computeKarana(at.sun, at.moon);
  const yoga = computeYoga(at.sun, at.moon);

  const nakshatraIndex = Math.floor(at.moon / NAKSHATRA_SPAN);
  const nakshatra = NAKSHATRAS[nakshatraIndex] ?? NAKSHATRAS[0]!;

  // End instants: elongation for tithi (12°) and karana (6°), combined longitude
  // for yoga (13°20'), Moon's own longitude for the nakshatra (13°20').
  const elongation = (d: Date): number => {
    const p = sunMoonAt(d);
    return ((p.moon - p.sun) % 360 + 360) % 360;
  };
  const combined = (d: Date): number => {
    const p = sunMoonAt(d);
    return (p.sun + p.moon) % 360;
  };
  const moonLon = (d: Date): number => sunMoonAt(d).moon;

  return {
    date: birthData.birthDate,
    tithi: {
      name: tithi.name,
      number: tithi.number,
      paksha: tithi.paksha,
      endTime: nextCrossing(elongation, instant, 12, 2) ?? birthData.birthDate,
    },
    nakshatra: {
      name: nakshatra.name,
      number: nakshatraIndex + 1,
      lord: nakshatra.lord,
      endTime: nextCrossing(moonLon, instant, NAKSHATRA_SPAN, 2) ?? birthData.birthDate,
    },
    yoga: {
      name: yoga.name,
      number: yoga.number,
      endTime: nextCrossing(combined, instant, NAKSHATRA_SPAN, 3) ?? birthData.birthDate,
    },
    karana: {
      name: karana.name,
      number: karana.number,
      endTime: nextCrossing(elongation, instant, 6, 1) ?? birthData.birthDate,
    },
    // The consumer pages (Panchang service) compute sunrise/sunset for the
    // seeker's city with the NOAA solar equations; the ephemeris has no horizon,
    // so these stay the date-only placeholders rather than a fabricated time.
    sunrise: `${birthData.birthDate}T06:00:00Z`,
    sunset: `${birthData.birthDate}T18:00:00Z`,
  };
}
