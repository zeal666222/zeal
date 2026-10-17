// ============================================================================
// Kundali Engine — deterministic, error-free Vedic birth-chart computation.
// ----------------------------------------------------------------------------
// Accuracy principles:
//  1. Compute everything with the astronomy-engine backed @zeal/astrology
//     engine (Lahiri ayanamsa, correct IANA-timezone → UTC conversion).
//  2. The AI NEVER computes planetary degrees — it only interprets the
//     deterministic chart we hand it. This eliminates numeric hallucination.
//  3. Self-consistency verification + honest confidence scoring, and
//     data-driven "past event" anchors (already-elapsed dasha periods) so the
//     user can verify before trusting predictions.
// ============================================================================

import {
  computeRashiChart,
  computeNavamsaChart,
  computeVimshottariDasha,
  computePanchanga,
} from "@zeal/astrology";
import type { BirthData, NatalChart, PlanetPosition } from "@zeal/astrology";
import { resolvePlace, type ResolvedPlace } from "./geocoder";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class KundaliInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KundaliInputError";
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PlanetInHouse {
  planet: string;
  sign: string;
  signIndex: number;
  degree: number; // within sign 0-30
  house: number; // 1-12
  nakshatra: string;
  nakshatraPada: number;
  isRetrograde: boolean;
}

export interface DashaAnchor {
  planet: string;
  startDate: string;
  endDate: string;
  durationYears: number;
  elapsed: boolean; // past event the user can verify
  isCurrent: boolean;
}

export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface KundaliConfidence {
  score: number; // 0-100
  factors: string[];
}

export interface KundaliResult {
  input: {
    name: string;
    birthDate: string;
    birthTime: string;
    place: string;
    resolvedPlace: ResolvedPlace;
  };
  chart: {
    ascendantSign: string;
    ascendantDegree: number;
    ayanamsa: number;
    moonSign: string;
    moonNakshatra: string;
    sunSign: string;
    planets: PlanetInHouse[];
    houses: Array<{ house: number; sign: string }>;
    navamsaAscendant: string;
  };
  panchanga: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    karana: string;
  };
  dasha: {
    currentMahadasha: string;
    currentAntardasha: string;
    remainingYears: number;
    anchors: DashaAnchor[];
  };
  verification: VerificationCheck[];
  confidence: KundaliConfidence;
  computedAt: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const NAME_RE = /^[\p{L}\p{M}'’ .,°-]{1,60}$/u;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

export function validateName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (!name) throw new KundaliInputError("Please enter a name — it's needed for the Kundali.");
  if (!NAME_RE.test(name)) {
    throw new KundaliInputError("Name can only contain letters (max 60 characters).");
  }
  return name;
}

export function validateBirthDate(raw: unknown): string {
  const dob = String(raw ?? "").trim();
  const m = DATE_RE.exec(dob);
  if (!m) throw new KundaliInputError("Invalid date of birth format. Use YYYY-MM-DD.");
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const today = new Date();
  const maxYear = today.getUTCFullYear();

  if (year < 1900 || year > maxYear) {
    throw new KundaliInputError(`Birth year must be between 1900 and ${maxYear}.`);
  }
  if (month < 1 || month > 12) throw new KundaliInputError("Birth month must be between 1 and 12.");
  if (day < 1 || day > 31) throw new KundaliInputError("Birth day must be between 1 and 31.");

  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new KundaliInputError("This date is not valid (leap-year/month check failed).");
  }
  if (d.getTime() > today.getTime()) {
    throw new KundaliInputError("Birth date cannot be in the future.");
  }
  return dob;
}

export function validateBirthTime(raw: unknown): string {
  const tob = String(raw ?? "").trim();
  if (!tob) {
    throw new KundaliInputError(
      "Birth time is required — the Lagna depends on it. An approximation is fine, but the exact minute is better."
    );
  }
  const m = TIME_RE.exec(tob);
  if (!m) throw new KundaliInputError("Please enter birth time in HH:MM (24-hour) format.");
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23) throw new KundaliInputError("Birth time hours must be between 0 and 23.");
  if (minute < 0 || minute > 59) throw new KundaliInputError("Birth time minutes must be between 0 and 59.");
  return tob;
}

// ─── Place resolution ───────────────────────────────────────────────────────────

export async function validatePlace(
  raw: unknown,
  opts: { allowNetwork?: boolean } = {}
): Promise<{ place: string; resolved: ResolvedPlace }> {
  const place = String(raw ?? "").trim();
  if (!place) throw new KundaliInputError("Please enter the place of birth.");
  if (place.length > 120) throw new KundaliInputError("Place is too long — keep it to city, state.");

  const resolved = await resolvePlace(place, { allowNetwork: opts.allowNetwork !== false, timeoutMs: 3500 });
  if (!resolved) {
    throw new KundaliInputError(
      `We couldn't locate "${place}". Try the full name (e.g. "Pune, Maharashtra").`
    );
  }
  return { place, resolved };
}

// ─── Core computation ────────────────────────────────────────────────────────────

function toPlanetInHouse(p: PlanetPosition): PlanetInHouse {
  return {
    planet: p.planet,
    sign: p.sign,
    signIndex: p.signIndex,
    degree: Math.round((p.degree + p.minute / 60) * 100) / 100,
    house: p.house,
    nakshatra: p.nakshatra ?? "—",
    nakshatraPada: p.nakshatraPada ?? 1,
    isRetrograde: p.isRetrograde,
  };
}

export function computeKundali(
  name: string,
  birthDate: string,
  birthTime: string,
  place: string,
  resolved: ResolvedPlace
): KundaliResult {
  const birthData: BirthData = {
    birthDate,
    birthTime,
    birthPlace: { lat: resolved.lat, lng: resolved.lng },
    timezone: resolved.timezone,
  };

  const chart: NatalChart = computeRashiChart(birthData);
  const navamsa = computeNavamsaChart(birthData);
  const dasha = computeVimshottariDasha(birthData);
  const panchanga = computePanchanga(birthData);

  const planets = chart.planets.map(toPlanetInHouse);
  const moon = chart.planets.find((p) => p.planet === "Moon");
  const sun = chart.planets.find((p) => p.planet === "Sun");

  // ─── Dasha anchors (past + current) ─────────────────────────────────────────
  const todayIso = new Date().toISOString().split("T")[0] ?? "";
  const anchors: DashaAnchor[] = dasha.allMahardashas.map((md) => ({
    planet: md.planet,
    startDate: md.startDate,
    endDate: md.endDate,
    durationYears: md.durationYears,
    elapsed: md.endDate < todayIso,
    isCurrent: todayIso >= md.startDate && todayIso <= md.endDate,
  }));

  // ─── Verification: self-consistency of the deterministic chart ──────────────
  const verification: VerificationCheck[] = [];

  verification.push({
    label: "Graha Sthiti (planet positions)",
    passed: planets.length === 9,
    detail: `${planets.length}/9 Grahas computed (7 + Rahu + Ketu).`,
  });

  verification.push({
    label: "Lagna (Ascendant)",
    passed: Boolean(chart.ascendant?.sign),
    detail: `Lagna = ${chart.ascendant?.sign ?? "N/A"}`,
  });

  // Moon nakshatra must match the Panchanga's birth nakshatra.
  verification.push({
    label: "Chandra Nakshatra consistency",
    passed: Boolean(moon) && moon?.nakshatra === panchanga.nakshatra.name,
    detail: `Birth nakshatra ${panchanga.nakshatra.name} · Moon ${moon?.nakshatra ?? "N/A"}.`,
  });

  // Dasha must be seeded from the Moon's nakshatra lord.
  const expectedSeed = moon?.nakshatraLord ?? "";
  const actualSeed = dasha.allMahardashas[0]?.planet ?? "";
  verification.push({
    label: "Dasha seeding",
    passed: Boolean(expectedSeed) && expectedSeed === actualSeed,
    detail: `First Mahadasha is ${actualSeed} (Moon nakshatra lord ${expectedSeed}).`,
  });

  // Ayanamsa sanity (Lahiri ~ 23-25° in modern era).
  verification.push({
    label: "Lahiri Ayanamsa",
    passed: chart.ayanamsa != null && chart.ayanamsa > 0 && chart.ayanamsa < 30,
    detail: `Ayanamsa = ${(chart.ayanamsa ?? 0).toFixed(3)}°.`,
  });

  // ─── Confidence ──────────────────────────────────────────────────────────────
  const factors: string[] = [];
  let score = 100;

  if (resolved.source === "nominatim") {
    score -= 5;
    factors.push("Location came from an approximate geocode — please verify the coordinates.");
  } else {
    factors.push("Location matched exactly in the gazetteer (high-quality coordinates).");
  }

  // Moon near a sign boundary → small birth-time error could flip Rashi.
  const moonDeg = moon ? moon.degree : 15;
  if (moonDeg < 0.5 || moonDeg > 29.5) {
    score -= 25;
    factors.push(
      "The Moon is very close to a Rashi boundary — a 1-2 minute birth-time error could change the Rashi. Please confirm the exact minute."
    );
  } else if (moonDeg < 1.0 || moonDeg > 29.0) {
    score -= 12;
    factors.push("The Moon is near a Rashi boundary — the accuracy of the birth time matters.");
  } else {
    factors.push("The Moon is comfortably inside its Rashi — the Rashi is stable.");
  }

  // Whole-hour birth time (e.g. :00) is often rounded → lower precision.
  if (/:00$/.test(birthTime)) {
    score -= 8;
    factors.push("Birth time is on the exact hour — it looks approximate. The real minute will sharpen the Lagna.");
  }

  score = Math.max(35, Math.min(100, score));

  return {
    input: { name, birthDate, birthTime, place, resolvedPlace: resolved },
    chart: {
      ascendantSign: chart.ascendant.sign,
      ascendantDegree: Math.round(chart.ascendant.degree * 1000) / 1000,
      ayanamsa: Math.round((chart.ayanamsa ?? 0) * 1000) / 1000,
      moonSign: moon?.sign ?? "—",
      moonNakshatra: moon?.nakshatra ?? "—",
      sunSign: sun?.sign ?? "—",
      planets,
      houses: chart.houses.map((h) => ({ house: h.house, sign: h.sign })),
      navamsaAscendant: navamsa.ascendant?.sign ?? "—",
    },
    panchanga: {
      tithi: panchanga.tithi.name,
      nakshatra: panchanga.nakshatra.name,
      yoga: panchanga.yoga.name,
      karana: panchanga.karana.name,
    },
    dasha: {
      currentMahadasha: dasha.currentDasha.mahadasha.planet,
      currentAntardasha: dasha.currentDasha.antardasha.planet,
      remainingYears: dasha.currentDasha.remainingYears,
      anchors,
    },
    verification,
    confidence: { score, factors },
    computedAt: new Date().toISOString(),
  };
}

// ─── Prompt builder: hand the AI the COMPUTED chart, not raw birth data ─────────

export function formatKundaliForPrompt(k: KundaliResult): string {
  const lines = [
    `VISHLESHIT JANAM KUNDALI (deterministic, astronomy-engine computed — DO NOT recompute or alter these values):`,
    `Naam: ${k.input.name}`,
    `Janam: ${k.input.birthDate} ${k.input.birthTime}, ${k.input.place} (${k.input.resolvedPlace.lat}, ${k.input.resolvedPlace.lng}, ${k.input.resolvedPlace.timezone})`,
    `Lagna (Ascendant): ${k.chart.ascendantSign}`,
    `Chandra Rashi (Moon sign): ${k.chart.moonSign} · Nakshatra: ${k.chart.moonNakshatra}`,
    `Surya Rashi (Sun sign): ${k.chart.sunSign}`,
    `Navamsa Lagna: ${k.chart.navamsaAscendant}`,
    `Janam Panchanga: Tithi ${k.panchanga.tithi} · Nakshatra ${k.panchanga.nakshatra} · Yoga ${k.panchanga.yoga} · Karana ${k.panchanga.karana}`,
    ``,
    `GRAH STHITI (planet · sign · house · nakshatra):`,
    ...k.chart.planets.map(
      (p) =>
        `- ${p.planet}: ${p.sign} ${p.degree}°${p.isRetrograde ? " (R)" : ""}, Bhava ${p.house}, ${p.nakshatra} (pada ${p.nakshatraPada})`
    ),
    ``,
    `DASHA (Vimshottari):`,
    ...k.dasha.anchors.map(
      (a) =>
        `- ${a.planet} Mahadasha: ${a.startDate} → ${a.endDate} (${a.durationYears}y)${a.isCurrent ? " ← RUNNING" : a.elapsed ? " [past]" : " [future]"}`
    ),
    `Abhi chal raha: ${k.dasha.currentMahadasha} Mahadasha / ${k.dasha.currentAntardasha} Antardasha (${k.dasha.remainingYears}y shesh).`,
    ``,
    `CONFIDENCE: ${k.confidence.score}/100. Notes: ${k.confidence.factors.join(" ")}`,
  ];
  return lines.join("\n");
}
