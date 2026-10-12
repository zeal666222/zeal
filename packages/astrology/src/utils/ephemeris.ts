// ============================================================================
// Ephemeris Wrapper - Uses astronomy-engine for planetary position calculations
// ============================================================================
// astronomy-engine is a pure-JS, MIT-licensed ephemeris library that provides
// high-precision planetary positions. For sub-arcsecond precision in production,
// Swiss Ephemeris WASM (@fusionstrings/swiss-eph) can be swapped in.
// ============================================================================

import * as Astronomy from "astronomy-engine";
import type { PlanetName, WesternPlanet } from "../types";

/** Get the Astronomy.Time object from a Date */
export function getAstroTime(date: Date): Astronomy.AstroTime {
  return Astronomy.MakeTime(date);
}

export interface PlanetState {
  longitude: number; // ecliptic longitude, tropical degrees (0-360)
  latitude: number;
  distance: number;
  speed: number; // degrees per day (for retrograde detection)
  isRetrograde: boolean;
}

/**
 * Get geocentric ecliptic longitude for a planet body using GeoVector + Ecliptic.
 */
function getPlanetEclipticLon(body: Astronomy.Body, time: Astronomy.AstroTime): number {
  const geoVec = Astronomy.GeoVector(body, time, true);
  const ecl = Astronomy.Ecliptic(geoVec);
  return ((ecl.elon % 360) + 360) % 360;
}

/**
 * Get geocentric ecliptic longitude for the Moon.
 */
function getMoonEclipticLon(time: Astronomy.AstroTime): number {
  const moonVec = Astronomy.GeoMoon(time);
  const ecl = Astronomy.Ecliptic(moonVec);
  return ((ecl.elon % 360) + 360) % 360;
}

/**
 * Compute the full planet state (longitude, speed, retrograde).
 */
function computePlanetState(
  getLon: (t: Astronomy.AstroTime) => number,
  time: Astronomy.AstroTime,
  deltaDays: number = 1
): PlanetState {
  const longitude = getLon(time);

  // Compute speed for retrograde detection
  const timeBefore = time.AddDays(-deltaDays);
  const timeAfter = time.AddDays(deltaDays);
  const lonBefore = getLon(timeBefore);
  const lonAfter = getLon(timeAfter);

  let diff = lonAfter - lonBefore;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const speed = diff / (2 * deltaDays);

  return {
    longitude,
    latitude: 0,
    distance: 0,
    speed,
    isRetrograde: speed < 0,
  };
}

/**
 * Compute the Mean Lunar Node (Rahu) position.
 * Uses a simplified algorithm based on Meeus.
 */
export function getRahuLongitude(time: Astronomy.AstroTime): number {
  // Julian centuries from J2000
  const T = time.tt / 36525;
  // Mean longitude of the ascending lunar node
  const omega = 125.04452 - 1934.136261 * T;
  return ((omega % 360) + 360) % 360;
}

/**
 * Get all Vedic planet positions (sidereal, Lahiri ayanamsa applied).
 */
export function getVedicPlanetPositions(
  time: Astronomy.AstroTime,
  ayanamsa: number
): Map<PlanetName, PlanetState> {
  const result = new Map<PlanetName, PlanetState>();

  // Compute each planet's tropical longitude, then subtract ayanamsa for sidereal
  const planetBodies: Array<{ name: PlanetName; body: Astronomy.Body }> = [
    { name: "Sun", body: Astronomy.Body.Sun },
    { name: "Moon", body: Astronomy.Body.Moon },
    { name: "Mars", body: Astronomy.Body.Mars },
    { name: "Mercury", body: Astronomy.Body.Mercury },
    { name: "Jupiter", body: Astronomy.Body.Jupiter },
    { name: "Venus", body: Astronomy.Body.Venus },
    { name: "Saturn", body: Astronomy.Body.Saturn },
  ];

  for (const { name, body } of planetBodies) {
    const getLon = body === Astronomy.Body.Moon
      ? (t: Astronomy.AstroTime) => getMoonEclipticLon(t)
      : (t: Astronomy.AstroTime) => getPlanetEclipticLon(body, t);

    const state = computePlanetState(getLon, time);
    // Apply ayanamsa to convert tropical to sidereal
    state.longitude = ((state.longitude - ayanamsa) % 360 + 360) % 360;
    result.set(name, state);
  }

  // Rahu (Mean North Node) - sidereal
  const rahuLon = getRahuLongitude(time);
  const rahuSidereal = ((rahuLon - ayanamsa) % 360 + 360) % 360;

  // Compute Rahu speed
  const rahuBefore = getRahuLongitude(time.AddDays(-1));
  const rahuAfter = getRahuLongitude(time.AddDays(1));
  let rahuSpeed = ((rahuAfter - rahuBefore) % 360 + 540) % 360 - 180;
  rahuSpeed /= 2;

  result.set("Rahu", {
    longitude: rahuSidereal,
    latitude: 0,
    distance: 0,
    speed: rahuSpeed,
    isRetrograde: true, // Always considered retrograde in Vedic
  });

  // Ketu = Rahu + 180
  const ketuSidereal = (rahuSidereal + 180) % 360;
  result.set("Ketu", {
    longitude: ketuSidereal,
    latitude: 0,
    distance: 0,
    speed: rahuSpeed,
    isRetrograde: true,
  });

  return result;
}

/**
 * Get all Western planet positions (tropical zodiac, no ayanamsa correction).
 */
export function getWesternPlanetPositions(
  time: Astronomy.AstroTime
): Map<WesternPlanet, PlanetState> {
  const result = new Map<WesternPlanet, PlanetState>();

  const planetBodies: Array<{ name: WesternPlanet; body: Astronomy.Body }> = [
    { name: "Sun", body: Astronomy.Body.Sun },
    { name: "Moon", body: Astronomy.Body.Moon },
    { name: "Mercury", body: Astronomy.Body.Mercury },
    { name: "Venus", body: Astronomy.Body.Venus },
    { name: "Mars", body: Astronomy.Body.Mars },
    { name: "Jupiter", body: Astronomy.Body.Jupiter },
    { name: "Saturn", body: Astronomy.Body.Saturn },
    { name: "Uranus", body: Astronomy.Body.Uranus },
    { name: "Neptune", body: Astronomy.Body.Neptune },
    { name: "Pluto", body: Astronomy.Body.Pluto },
  ];

  for (const { name, body } of planetBodies) {
    const getLon = body === Astronomy.Body.Moon
      ? (t: Astronomy.AstroTime) => getMoonEclipticLon(t)
      : (t: Astronomy.AstroTime) => getPlanetEclipticLon(body, t);

    const state = computePlanetState(getLon, time);
    result.set(name, state);
  }

  // North Node (Mean)
  const rahuLon = getRahuLongitude(time);
  result.set("NorthNode", {
    longitude: rahuLon,
    latitude: 0,
    distance: 0,
    speed: -0.053,
    isRetrograde: true,
  });

  // South Node
  result.set("SouthNode", {
    longitude: (rahuLon + 180) % 360,
    latitude: 0,
    distance: 0,
    speed: -0.053,
    isRetrograde: true,
  });

  return result;
}
