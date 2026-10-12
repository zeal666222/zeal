// ============================================================================
// Panchanga - Daily Astrological Calendar
// ============================================================================
// Computes Tithi, Nakshatra, Yoga, and Karana for a given date.
// These are the five limbs (anga) of the Hindu calendar.
// ============================================================================

import type { Panchanga, BirthData } from "../types";
import { getVedicPlanetPositions, getAstroTime, getRahuLongitude } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { NAKSHATRAS } from "./rashi";

/** Tithi names */
const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima/Amavasya",
];

/** Yoga names (27 yogas) */
const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
];

/** Karana names (11 karanas, 7 fixed + 4 movable) */
const KARANA_NAMES = [
  "Bava", "Balava", "Kaulava", "Taitila", "Garaja",
  "Vanija", "Vishti", "Shakuni", "Chatushpada", "Naga", "Kimstughna",
];

/**
 * Compute the Tithi for a given Sun-Moon longitude difference.
 * Tithi = (Moon longitude - Sun longitude) / 12 degrees
 */
function computeTithi(sunLon: number, moonLon: number): {
  name: string;
  number: number;
  paksha: "Shukla" | "Krishna";
} {
  let diff = ((moonLon - sunLon) % 360 + 360) % 360;
  const tithiNumber = Math.floor(diff / 12) + 1;
  const paksha: "Shukla" | "Krishna" = tithiNumber <= 15 ? "Shukla" : "Krishna";
  const tithiIndex = paksha === "Shukla" ? tithiNumber - 1 : tithiNumber - 16;
  const name = TITHI_NAMES[tithiIndex] ?? "Unknown";

  return { name, number: tithiNumber, paksha };
}

/**
 * Compute Yoga from Sun-Moon combined longitude.
 * Yoga = (Sun longitude + Moon longitude) / 13.333 degrees
 */
function computeYoga(sunLon: number, moonLon: number): {
  name: string;
  number: number;
} {
  const combined = (sunLon + moonLon) % 360;
  const yogaNumber = Math.floor(combined / (360 / 27)) + 1;
  const name = YOGA_NAMES[(yogaNumber - 1) % 27] ?? "Unknown";

  return { name, number: yogaNumber };
}

/**
 * Compute Karana from Sun-Moon longitude difference.
 * Karana = half a Tithi (6 degrees)
 */
function computeKarana(sunLon: number, moonLon: number): {
  name: string;
  number: number;
} {
  let diff = ((moonLon - sunLon) % 360 + 360) % 360;
  const karanaNumber = Math.floor(diff / 6);

  // First and last karanas are fixed (Kimstughna)
  if (karanaNumber === 0) {
    return { name: "Kimstughna", number: 57 };
  }

  // Karana 57-56 repeat in cycles of 7 (movable karanas)
  const adjustedKarana = ((karanaNumber - 1) % 56) + 1;
  if (adjustedKarana <= 7) {
    return { name: KARANA_NAMES[adjustedKarana - 1] ?? "Unknown", number: adjustedKarana };
  }

  const cycleIndex = (adjustedKarana - 1) % 7;
  return { name: KARANA_NAMES[cycleIndex] ?? "Unknown", number: adjustedKarana };
}

/**
 * Compute the Panchanga for a given date and location.
 */
export function computePanchanga(birthData: BirthData): Panchanga {
  const dateTime = new Date(`${birthData.birthDate}T${birthData.birthTime}:00Z`);
  const time = getAstroTime(dateTime);
  const ayanamsa = getAyanamsa(time, "lahiri");

  // Get Sun and Moon sidereal longitudes
  const planetStates = getVedicPlanetPositions(time, ayanamsa);
  const sunState = planetStates.get("Sun");
  const moonState = planetStates.get("Moon");

  if (!sunState || !moonState) {
    throw new Error("Could not compute Sun/Moon positions for Panchanga");
  }

  const sunLon = sunState.longitude;
  const moonLon = moonState.longitude;

  // Compute Tithi
  const tithi = computeTithi(sunLon, moonLon);

  // Compute Nakshatra (from Moon's position)
  const nakshatraIndex = Math.floor(moonLon / (360 / 27));
  const nakshatra = NAKSHATRAS[nakshatraIndex] ?? NAKSHATRAS[0]!;

  // Compute Yoga
  const yoga = computeYoga(sunLon, moonLon);

  // Compute Karana
  const karana = computeKarana(sunLon, moonLon);

  // Approximate sunrise/sunset (simplified)
  const dateStr = birthData.birthDate;

  return {
    date: dateStr,
    tithi: {
      name: tithi.name,
      number: tithi.number,
      paksha: tithi.paksha,
      endTime: dateStr, // TODO: compute exact end time
    },
    nakshatra: {
      name: nakshatra.name,
      number: nakshatraIndex + 1,
      lord: nakshatra.lord,
      endTime: dateStr, // TODO: compute exact end time
    },
    yoga: {
      name: yoga.name,
      number: yoga.number,
      endTime: dateStr,
    },
    karana: {
      name: karana.name,
      number: karana.number,
      endTime: dateStr,
    },
    sunrise: `${dateStr}T06:00:00Z`, // TODO: compute actual sunrise
    sunset: `${dateStr}T18:00:00Z`,  // TODO: compute actual sunset
  };
}
