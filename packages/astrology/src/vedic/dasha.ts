// ============================================================================
// Vimshottari Dasha - Planetary Period System
// ============================================================================
// The Vimshottari Dasha system is a 120-year cycle based on the Moon's
// nakshatra position at birth. Each planet rules a period (Mahadasha)
// of a specific number of years.
// ============================================================================

import type { BirthData, DashaPeriod, VimshottariDasha, PlanetName } from "../types";
import { computeRashiChart, parseBirthDateTime } from "./rashi";
import { getNakshatra } from "./rashi";

/** Vimshottari Dasha planetary periods (in years) */
const DASHA_PERIODS: Array<{ planet: PlanetName; years: number }> = [
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

/** Total cycle length */
const TOTAL_CYCLE_YEARS = 120;

/**
 * Determine the starting Mahadasha lord based on the Moon's nakshatra at birth.
 * Each nakshatra is ruled by a planet, and that planet's Mahadasha begins at birth.
 */
function getStartingDashaLord(moonNakshatra: string): PlanetName {
  // Find the nakshatra lord
  for (const entry of DASHA_PERIODS) {
    // The nakshatra lords cycle through the dasha order
    if (isNakshatraLord(moonNakshatra, entry.planet)) {
      return entry.planet;
    }
  }
  return "Ketu"; // Default fallback
}

function isNakshatraLord(nakshatra: string, planet: PlanetName): boolean {
  const nakshatraLords: Record<string, PlanetName> = {
    "Ashwini": "Ketu", "Magha": "Ketu", "Mula": "Ketu",
    "Bharani": "Venus", "Purva Phalguni": "Venus", "Purva Ashadha": "Venus",
    "Krittika": "Sun", "Uttara Phalguni": "Sun", "Uttara Ashadha": "Sun",
    "Rohini": "Moon", "Hasta": "Moon", "Shravana": "Moon",
    "Mrigashira": "Mars", "Chitra": "Mars", "Dhanishta": "Mars",
    "Ardra": "Rahu", "Swati": "Rahu", "Shatabhisha": "Rahu",
    "Punarvasu": "Jupiter", "Vishakha": "Jupiter", "Purva Bhadrapada": "Jupiter",
    "Pushya": "Saturn", "Anuradha": "Saturn", "Uttara Bhadrapada": "Saturn",
    "Ashlesha": "Mercury", "Jyeshtha": "Mercury", "Revati": "Mercury",
  };
  return nakshatraLords[nakshatra] === planet;
}

/**
 * Compute the balance of the starting Mahadasha at birth.
 * The Moon's position within its nakshatra determines how much of the
 * first Mahadasha has already elapsed.
 */
function computeDashaBalance(moonLongitude: number, startingLord: PlanetName): number {
  const normalizedLon = ((moonLongitude % 360) + 360) % 360;
  const nakshatraIndex = Math.floor(normalizedLon / (360 / 27));
  const nakshatraStart = nakshatraIndex * (360 / 27);
  const degreesInNakshatra = normalizedLon - nakshatraStart;
  const fraction = degreesInNakshatra / (360 / 27); // 0 to 1

  // Find the period for the starting lord
  const period = DASHA_PERIODS.find(p => p.planet === startingLord);
  if (!period) return 0;

  // Remaining balance = total period * (1 - fraction elapsed)
  return period.years * (1 - fraction);
}

/**
 * Add years to a date and return ISO date string.
 */
function addYears(date: Date, years: number): string {
  const result = new Date(date);
  // Approximate: add years * 365.25 days
  result.setDate(result.getDate() + Math.round(years * 365.25));
  return result.toISOString().split("T")[0] ?? "";
}

/**
 * Compute the Antardasha (sub-period) within a Mahadasha.
 * Each Mahadasha is divided into 9 Antardashas proportional to each planet's period.
 */
function computeAntardashas(mahadasha: DashaPeriod): DashaPeriod[] {
  const antardashas: DashaPeriod[] = [];
  const totalYears = mahadasha.durationYears;
  let currentDate = mahadasha.startDate;

  for (const antardashaLord of DASHA_PERIODS) {
    // Antardasha duration = (Mahadasha lord years * Antardasha lord years) / 120
    const mahadashaLordPeriod = DASHA_PERIODS.find(p => p.planet === mahadasha.planet);
    if (!mahadashaLordPeriod) continue;

    const duration = (mahadashaLordPeriod.years * antardashaLord.years) / TOTAL_CYCLE_YEARS;
    const endDate = addYears(new Date(currentDate), duration);

    antardashas.push({
      planet: antardashaLord.planet,
      startDate: currentDate,
      endDate,
      durationYears: Math.round(duration * 1000) / 1000,
    });

    currentDate = endDate;
  }

  return antardashas;
}

/**
 * Compute the full Vimshottari Dasha sequence from birth.
 */
export function computeVimshottariDasha(birthData: BirthData): {
  allMahardashas: DashaPeriod[];
  currentDasha: VimshottariDasha;
} {
  // Compute the Rashi chart to get Moon's position
  const chart = computeRashiChart(birthData);
  const moonPlanet = chart.planets.find(p => p.planet === "Moon");
  if (!moonPlanet || !moonPlanet.nakshatra) {
    throw new Error("Could not determine Moon's nakshatra for Dasha calculation");
  }

  const startingLord = getStartingDashaLord(moonPlanet.nakshatra);
  const dashaBalance = computeDashaBalance(moonPlanet.absoluteDegree, startingLord);

  const birthDate = parseBirthDateTime(birthData);
  const allMahardashas: DashaPeriod[] = [];

  // Build the sequence starting from the starting lord
  const startIndex = DASHA_PERIODS.findIndex(p => p.planet === startingLord);
  let currentDate = birthDate.toISOString().split("T")[0] ?? "";

  for (let i = 0; i < 9; i++) {
    const idx = (startIndex + i) % 9;
    const period = DASHA_PERIODS[idx]!;

    let duration: number;
    if (i === 0) {
      // First Mahadasha uses the remaining balance
      duration = Math.round(dashaBalance * 1000) / 1000;
    } else {
      duration = period.years;
    }

    const endDate = addYears(new Date(currentDate), duration);

    const mahadasha: DashaPeriod = {
      planet: period.planet,
      startDate: currentDate,
      endDate,
      durationYears: duration,
    };

    // Compute Antardashas
    mahadasha.subPeriods = computeAntardashas(mahadasha);

    allMahardashas.push(mahadasha);
    currentDate = endDate;
  }

  // Determine current Dasha based on today's date
  const today = new Date().toISOString().split("T")[0] ?? "";
  let currentMahadasha = allMahardashas[0]!;
  let currentAntardasha = currentMahadasha.subPeriods?.[0] ?? currentMahadasha;

  for (const md of allMahardashas) {
    if (today >= md.startDate && today <= md.endDate) {
      currentMahadasha = md;
      // Find current Antardasha
      if (md.subPeriods) {
        for (const ad of md.subPeriods) {
          if (today >= ad.startDate && today <= ad.endDate) {
            currentAntardasha = ad;
            break;
          }
        }
      }
      break;
    }
  }

  // Calculate remaining years
  const remainingYears = Math.max(0,
    (new Date(currentMahadasha.endDate).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  return {
    allMahardashas,
    currentDasha: {
      mahadasha: currentMahadasha,
      antardasha: currentAntardasha,
      remainingYears: Math.round(remainingYears * 100) / 100,
    },
  };
}
