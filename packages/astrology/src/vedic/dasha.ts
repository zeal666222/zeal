// ============================================================================
// Vimshottari Dasha - the 120-year planetary period system
// ============================================================================
// Birth nakshatra lord sets the starting Mahadasha; the Moon's position inside
// the nakshatra sets how much of it is left. Mahadasha (MD) splits into 9
// Antardasha (AD), and each AD into 9 Pratyantardasha (PA).
//
// Two rules that are easy to get wrong and that every consultant's "you are in
// X's period" line depends on:
//   1. Sub-periods begin with the *lord of the parent period* and then run the
//      fixed Vimshottari order (K-V-Su-M-Ma-Ra-J-Sa-Me). Starting every AD list
//      at Ketu puts every sub-period of a Saturn Mahadasha a full turn early.
//   2. Boundaries come from one continuous clock anchored at the birth instant.
//      Re-parsing the printed date at each step rounds every boundary to whole
//      days and the error walks forward through the sequence.
// ============================================================================

import type { BirthData, DashaPeriod, VimshottariDasha, PlanetName } from "../types";
import { computeRashiChart, parseBirthDateTime } from "./rashi";

/** Vimshottari Mahadasha periods, in the classical order. */
const DASHA_ORDER: Array<{ planet: PlanetName; years: number }> = [
  { planet: "Ketu", years: 7 },
  { planet: "Venus", years: 20 },
  { planet: "Sun", years: 6 },
  { planet: "Moon", years: 10 },
  { planet: "Mars", years: 7 },
  { planet: "Rahu", years: 18 },
  { planet: "Jupiter", years: 16 },
  { planet: "Saturn", years: 19 },
  { planet: "Mercury", years: 17 },
];

const TOTAL_CYCLE_YEARS = 120;
const DAY_MS = 86400000;
/** Mean (Julian) year, the convention Indian dasha tables are printed in. */
const YEAR_DAYS = 365.25;

const YEARS_BY_PLANET: Record<PlanetName, number> = DASHA_ORDER.reduce(
  (acc, p) => ({ ...acc, [p.planet]: p.years }),
  {} as Record<PlanetName, number>,
);

/**
 * The 27 nakshatra lords, indexed by nakshatra number - 1 (Ashwini first).
 * Used both to pick the starting Mahadasha and to verify the seeding.
 */
export const NAKSHATRA_LORDS: PlanetName[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

/** Cycle position of a dasha lord, for "start the sub-periods here" maths. */
function orderIndexOf(planet: PlanetName): number {
  const i = DASHA_ORDER.findIndex((p) => p.planet === planet);
  return i < 0 ? 0 : i;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Split a parent period into its 9 child periods, starting from the parent
 * lord and running the fixed Vimshottari order.
 *
 * Child duration = parent duration x (child lord's years / 120) — the same
 * ratio at both levels, so an Antardasha of Saturn-Saturn is 19x19/120 = 3.008
 * years and its Pratyantardasha is 3.008x19/120 = 0.476 years.
 */
function buildSubPeriods(
  parentLord: PlanetName,
  startMs: number,
  parentDurationYears: number,
  withGrandChildren: boolean,
): DashaPeriod[] {
  const startIndex = orderIndexOf(parentLord);
  const out: DashaPeriod[] = [];
  let cursor = startMs;

  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIndex + i) % 9]!;
    const years = (parentDurationYears * lord.years) / TOTAL_CYCLE_YEARS;
    const endMs = cursor + years * YEAR_DAYS * DAY_MS;

    const period: DashaPeriod = {
      planet: lord.planet,
      startDate: isoDay(cursor),
      endDate: isoDay(endMs),
      durationYears: Math.round(years * 1000) / 1000,
    };

    if (withGrandChildren) {
      period.subPeriods = buildSubPeriods(lord.planet, cursor, years, false);
    }

    out.push(period);
    cursor = endMs;
  }

  return out;
}

/**
 * Compute the full Vimshottari Dasha sequence from birth, and where the seeker
 * stands in it right now (Mahadasha / Antardasha / Pratyantardasha).
 */
export function computeVimshottariDasha(birthData: BirthData): {
  allMahardashas: DashaPeriod[];
  currentDasha: VimshottariDasha;
} {
  const chart = computeRashiChart(birthData);
  const moon = chart.planets.find((p) => p.planet === "Moon");
  if (!moon || !moon.nakshatra) {
    throw new Error("Could not determine the Moon's nakshatra for the Dasha calculation");
  }

  const nakIndex = Math.floor((((moon.absoluteDegree % 360) + 360) % 360) / (360 / 27));
  const startingLord = NAKSHATRA_LORDS[nakIndex] ?? "Ketu";

  // How much of the starting lord's period is still to be lived.
  const degreesIntoNakshatra = (((moon.absoluteDegree % 360) + 360) % 360) - nakIndex * (360 / 27);
  const elapsedFraction = degreesIntoNakshatra / (360 / 27);
  const fullYearsOfStart = YEARS_BY_PLANET[startingLord] ?? 7;
  const balanceYears = fullYearsOfStart * (1 - elapsedFraction);

  const birthMs = parseBirthDateTime(birthData).getTime();
  const startIndex = orderIndexOf(startingLord);
  const allMahardashas: DashaPeriod[] = [];
  let cursor = birthMs;

  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIndex + i) % 9]!;
    const years = i === 0 ? balanceYears : lord.years;
    const endMs = cursor + years * YEAR_DAYS * DAY_MS;

    const mahadasha: DashaPeriod = {
      planet: lord.planet,
      startDate: isoDay(cursor),
      endDate: isoDay(endMs),
      durationYears: Math.round(years * 1000) / 1000,
    };
    mahadasha.subPeriods = buildSubPeriods(lord.planet, cursor, years, true);
    allMahardashas.push(mahadasha);
    cursor = endMs;
  }

  // Where is "now"? (A seeker past 120 stays in the last charted stretch.)
  const todayMs = Date.now();
  const today = isoDay(todayMs);
  const currentMd =
    allMahardashas.find((md) => today >= md.startDate && today <= md.endDate) ??
    allMahardashas[allMahardashas.length - 1]!;

  const currentAd =
    currentMd.subPeriods?.find((ad) => today >= ad.startDate && today <= ad.endDate) ??
    currentMd.subPeriods?.[0] ??
    currentMd;

  const currentPa =
    currentAd.subPeriods?.find((pa) => today >= pa.startDate && today <= pa.endDate) ??
    currentAd.subPeriods?.[0] ??
    currentAd;

  const mdEndMs = Date.parse(`${currentMd.endDate}T00:00:00Z`);
  const remainingYears = Math.max(0, (mdEndMs - todayMs) / (YEAR_DAYS * DAY_MS));

  return {
    allMahardashas,
    currentDasha: {
      mahadasha: currentMd,
      antardasha: currentAd,
      pratyantardasha: currentPa,
      remainingYears: Math.round(remainingYears * 100) / 100,
    },
  };
}
