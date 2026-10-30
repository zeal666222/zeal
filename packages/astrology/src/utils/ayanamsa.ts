// ============================================================================
// Ayanamsa Calculations - Precession correction for the sidereal zodiac
// ============================================================================
// Lahiri (ICRC) is the default: it is the ayanamsa used by the Indian
// Astronomical Ephemeris and by virtually every Vedic software in India, so
// matching it is what makes our degrees agree with a published table.
//
// Model: ayanamsa(T) = ayanamsa(J2000) + p_A(T), where p_A is the general
// precession in longitude (Meeus, Mathematical Astronomy Ch. 22 / IAU 1976
// constant 5029.0966" per century) evaluated at T = Julian centuries TT from
// J2000. The J2000 anchor of 23°51'25.5324" is the Swiss-Ephemeris value for
// SE_SIDM_LAHIRI at JD 2451545.0 TT, which is what ties the polynomial to the
// published tables instead of a rounded approximation.
// ============================================================================

import * as Astronomy from "astronomy-engine";

export type AyanamsaType = "lahiri" | "raman" | "krishnamurti" | "yukteshwar";

/** Lahiri ayanamsa at J2000.0 (23°51'25.5324"), in degrees. */
const LAHIRI_J2000 = 23 + 51 / 60 + 25.5324 / 3600;

/** Julian centuries TT from J2000.0 (AstroTime.tt is already days from J2000). */
export function julianCenturiesFromJ2000(time: Astronomy.AstroTime): number {
  return time.tt / 36525;
}

/**
 * General precession in longitude, arcseconds, for T Julian centuries from
 * J2000. Quadratic term included so the rate tracks the tables across 1900-2100
 * instead of assuming a constant 50.29"/yr.
 */
export function generalPrecessionInLongitude(T: number): number {
  return 5029.0966 * T + 1.11113 * T * T - 0.00001 * T * T * T;
}

function ayanamsaAtJ2000(baseDegrees: number, T: number): number {
  return ((baseDegrees + generalPrecessionInLongitude(T) / 3600) % 360 + 360) % 360;
}

/** Lahiri / ICRC ayanamsa in degrees. */
export function computeLahiriAyanamsa(time: Astronomy.AstroTime): number {
  return ayanamsaAtJ2000(LAHIRI_J2000, julianCenturiesFromJ2000(time));
}

/**
 * B.V. Raman ayanamsa. Raman did not use a modern precession theory: his scheme
 * advances at a constant 50.3333"/yr from its own anchor, so the rate — not the
 * anchor — is what distinguishes it from Lahiri.
 */
export function computeRamanAyanamsa(time: Astronomy.AstroTime): number {
  const T = julianCenturiesFromJ2000(time);
  const constantRate = 5033.3333 * T; // arcsec, 50.3333"/yr
  return ((22.4605 + constantRate / 3600) % 360 + 360) % 360;
}

/** K.S. Krishnamurti ayanamsa (Lahiri-family, slightly smaller anchor). */
export function computeKrishnamurtiAyanamsa(time: Astronomy.AstroTime): number {
  return ayanamsaAtJ2000(23.84167, julianCenturiesFromJ2000(time));
}

/**
 * Get the ayanamsa for a given epoch and school.
 *
 * Yukteshwar is aliased to Lahiri: its published anchor is a fixed-year offset
 * we have not verified against a primary table, and silently inventing one would
 * shift every degree in the chart. Better a known Lahiri than an unknown guess.
 */
export function getAyanamsa(time: Astronomy.AstroTime, type: AyanamsaType = "lahiri"): number {
  switch (type) {
    case "lahiri":
      return computeLahiriAyanamsa(time);
    case "raman":
      return computeRamanAyanamsa(time);
    case "krishnamurti":
      return computeKrishnamurtiAyanamsa(time);
    case "yukteshwar":
      return computeLahiriAyanamsa(time);
  }
}
