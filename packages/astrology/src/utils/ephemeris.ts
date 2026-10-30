// ============================================================================
// Ephemeris Wrapper - planetary positions from astronomy-engine
// ============================================================================
// astronomy-engine is pure-JS, MIT-licensed and ships its own ephemeris
// (VSOP87 planetary theory + the Nautical Almanac Office's Improved Lunar
// Ephemeris). No API key, no network call, and it runs unmodified on
// Cloudflare Workers — which is why the chat worker can compute a chart
// in-process instead of trusting a value shipped in from the client.
//
// Positions are *apparent* geocentric: light-time and aberration corrected,
// then referred to the true ecliptic and equinox of date (ECT) — the same
// frame Indian ephemerides publish. Sidereal longitudes are that tropical
// longitude minus the ayanamsa.
// ============================================================================

import * as Astronomy from "astronomy-engine";
import type { PlanetName, WesternPlanet } from "../types";

/** Get the Astronomy.Time object from a Date */
export function getAstroTime(date: Date): Astronomy.AstroTime {
  return Astronomy.MakeTime(date);
}

export interface PlanetState {
  longitude: number; // ecliptic longitude, tropical degrees (0-360)
  latitude: number; // ecliptic latitude, degrees
  distance: number; // geocentric distance, AU
  speed: number; // degrees per day (negative = retrograde)
  isRetrograde: boolean;
}

/**
 * Apparent geocentric ecliptic longitude/latitude of a body, in the true
 * ecliptic of date.
 *
 * GeoVector already back-dates for light travel time; aberration=true adds the
 * annual-aberration shift, which is the difference between a astrometric and an
 * observed position (~20" for the outer planets, ~0.4' for the Moon). Charts are
 * built on observed positions, so both are applied — including for the Moon,
 * whose previous path through GeoMoon skipped them.
 */
function getApparentEcliptic(body: Astronomy.Body, time: Astronomy.AstroTime): { lon: number; lat: number; dist: number } {
  const geoVec = Astronomy.GeoVector(body, time, true);
  const ecl = Astronomy.Ecliptic(geoVec);
  return {
    lon: ((ecl.elon % 360) + 360) % 360,
    lat: ecl.elat,
    dist: Math.hypot(geoVec.x, geoVec.y, geoVec.z),
  };
}

/**
 * Central-difference step, in days, chosen per body.
 *
 * A wide step (the old fixed ±1 day) reports the *mean* motion over two days,
 * so a planet is flagged retrograde up to a day late near its station. A step
 * small enough for the slowest bodies still clears ephemeris noise: Saturn
 * moves ~0.008° in 0.4 days, an order of magnitude above the theory's error.
 */
const SPEED_STEP_DAYS: Partial<Record<Astronomy.Body, number>> = {
  [Astronomy.Body.Moon]: 0.02, // 13.2°/day — the fastest, needs the tightest step
  [Astronomy.Body.Mercury]: 0.08,
  [Astronomy.Body.Venus]: 0.08,
  [Astronomy.Body.Mars]: 0.2,
  [Astronomy.Body.Jupiter]: 0.4,
  [Astronomy.Body.Saturn]: 0.4,
};

/**
 * Compute the full planet state (longitude, latitude, distance, instantaneous
 * speed, retrograde flag).
 */
function computePlanetState(
  getLon: (t: Astronomy.AstroTime) => number,
  time: Astronomy.AstroTime,
  deltaDays: number = 0.2
): PlanetState {
  const lon = getLon(time);
  const lonBefore = getLon(time.AddDays(-deltaDays));
  const lonAfter = getLon(time.AddDays(deltaDays));

  let diff = lonAfter - lonBefore;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const speed = diff / (2 * deltaDays);

  return {
    longitude: lon,
    latitude: 0,
    distance: 0,
    speed,
    isRetrograde: speed < 0,
  };
}

/**
 * Mean longitude of the ascending lunar node (Rahu), sidereal-ready.
 *
 * Meeus Astronomical Algorithms ch. 44, full series through T⁴. Vedic
 * practice (and the Indian Astronomical Ephemeris) uses the *mean* node, so
 * that is what we publish; true-node tables differ by up to ~0.35°, which is
 * why mixing the two produces "wrong nakshatra" complaints.
 */
export function getRahuLongitude(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  const omega =
    125.04452 -
    1934.136261 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60610000;
  return ((omega % 360) + 360) % 360;
}

interface VedicBodySpec {
  name: PlanetName;
  body: Astronomy.Body;
}

const VEDIC_BODIES: VedicBodySpec[] = [
  { name: "Sun", body: Astronomy.Body.Sun },
  { name: "Moon", body: Astronomy.Body.Moon },
  { name: "Mars", body: Astronomy.Body.Mars },
  { name: "Mercury", body: Astronomy.Body.Mercury },
  { name: "Jupiter", body: Astronomy.Body.Jupiter },
  { name: "Venus", body: Astronomy.Body.Venus },
  { name: "Saturn", body: Astronomy.Body.Saturn },
];

/**
 * Get all Vedic planet positions (sidereal, ayanamsa already subtracted).
 */
export function getVedicPlanetPositions(
  time: Astronomy.AstroTime,
  ayanamsa: number
): Map<PlanetName, PlanetState> {
  const result = new Map<PlanetName, PlanetState>();

  for (const { name, body } of VEDIC_BODIES) {
    const step = SPEED_STEP_DAYS[body] ?? 0.2;
    const at = (t: Astronomy.AstroTime): number => getApparentEcliptic(body, t).lon;

    const state = computePlanetState(at, time, step);
    const full = getApparentEcliptic(body, time);

    result.set(name, {
      ...state,
      longitude: ((state.longitude - ayanamsa) % 360 + 360) % 360,
      latitude: full.lat,
      distance: full.dist,
    });
  }

  // Rahu — mean north node, retrograde by definition (it moves backwards
  // through the zodiac at ~0.053°/day).
  const rahuSpeed = (getRahuLongitude(time.AddDays(0.05)) - getRahuLongitude(time.AddDays(-0.05))) / 0.1;
  result.set("Rahu", {
    longitude: ((getRahuLongitude(time) - ayanamsa) % 360 + 360) % 360,
    latitude: 0,
    distance: 0,
    speed: rahuSpeed,
    isRetrograde: true,
  });

  // Ketu — the south node, exactly opposite.
  const ketuLon = (getRahuLongitude(time) - ayanamsa + 180) % 360;
  result.set("Ketu", {
    longitude: ((ketuLon % 360) + 360) % 360,
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
    const step = SPEED_STEP_DAYS[body] ?? 0.2;
    const at = (t: Astronomy.AstroTime): number => getApparentEcliptic(body, t).lon;
    const state = computePlanetState(at, time, step);
    const full = getApparentEcliptic(body, time);
    result.set(name, { ...state, latitude: full.lat, distance: full.dist });
  }

  // North / South Node (mean), tropical.
  const nodeLon = getRahuLongitude(time);
  const nodeSpeed = (getRahuLongitude(time.AddDays(0.05)) - getRahuLongitude(time.AddDays(-0.05))) / 0.1;
  result.set("NorthNode", {
    longitude: nodeLon,
    latitude: 0,
    distance: 0,
    speed: nodeSpeed,
    isRetrograde: true,
  });
  result.set("SouthNode", {
    longitude: (nodeLon + 180) % 360,
    latitude: 0,
    distance: 0,
    speed: nodeSpeed,
    isRetrograde: true,
  });

  return result;
}
