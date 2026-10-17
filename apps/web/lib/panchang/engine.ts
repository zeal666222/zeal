// ============================================================================
// ZEAL — Daily Panchang Engine (pure, deterministic, unit-testable)
// ----------------------------------------------------------------------------
// Computes the five limbs (Tithi, Nakshatra, Yoga, Karana, Vara) plus Rahu
// Kaal / Yamagandam / Gulika / Abhijit Muhurat / Brahma Muhurat windows for a
// civil date + location (lat/lng + IANA timezone).
//
// Accuracy principles (matches the kundali engine's verification-first ethos):
//  1. Solar/lunar longitudes come from the SAME primitives the repo's
//     @zeal/astrology engine is built on (astronomy-engine GeoVector/GeoMoon +
//     Ecliptic), converted to sidereal with the Lahiri ayanamsa exported by
//     @zeal/astrology. No re-implementation, no drift from the chart engine.
//  2. Sunrise/sunset use the standard NOAA solar equations: mean obliquity →
//     declination + hour angle with h0 = −0.833° (solar disc + refraction),
//     with one refinement pass of δ/EoT at the event instants.
//  3. All instants are computed in UTC (epoch ms) and only formatted to
//     wall-clock strings via timeZone-aware Intl — no hand-rolled offsets.
//  4. Anga (tithi etc.) boundaries are solved by bisection on MONOTONIC
//     unwrapped elongation/longitude series — the relative rate is always
//     positive (Moon +13°/day vs Sun +1°/day), so brackets are guaranteed.
//  5. No Math.random(), no Date.now(): given the same inputs the output is
//     byte-identical (SSR == client). Every float is emitted with .toFixed().
//  6. Polar/degenerate inputs never NaN: hour-angle is clamped and synthetic
//     noon ± 6h windows are emitted with a `polar` flag.
// ============================================================================

import * as Astronomy from "astronomy-engine";
import { getAyanamsa, NAKSHATRAS } from "@zeal/astrology";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PanchangInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanchangInputError";
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PanchangTime {
  /** "HH:mm" in the target IANA timezone (24-hour). */
  time: string;
  /** UTC ISO instant, second-precision. */
  iso: string;
}

export interface PanchangWindow extends PanchangTime {
  end: string;
  endISO: string;
  /** 1-based eighth-of-day index (Rahu/Yama/Gulika only). */
  part?: number;
}

export interface PanchangAnga extends PanchangTime {
  end: string;
  endISO: string;
  /** Civil date (in tz) on which the HH:mm time above falls — set when a
   *  boundary crossed midnight, so the UI can show "(14 Oct)" style hints. */
  startOn: string;
  endOn: string;
  nextEndOn: string;
  /** 0-based index in the cycle (tithi 0-29, nakshatra 0-26, yoga 0-26, karana 0-59). */
  index: number;
  name: string;
  /** 1-based display number where meaningful (tithi = 1-15 within paksha). */
  number: number;
  nextName: string;
  nextEnd: string;
  nextEndISO: string;
}

export interface PanchangNakshatra extends PanchangAnga {
  pada: number; // 1-4
  lord: string;
}

export interface PanchangDayResult {
  date: string; // YYYY-MM-DD (civil date in target tz)
  placeLabel: string;
  lat: number;
  lng: number;
  timezone: string;
  sunrise: PanchangTime;
  sunset: PanchangTime;
  solarNoon: PanchangTime;
  dayLengthMinutes: number;
  /** "none" | "no-sunrise" (polar night) | "no-sunset" (midnight sun). */
  polar: "none" | "no-sunrise" | "no-sunset";
  tithi: PanchangAnga;
  nakshatra: PanchangNakshatra;
  yoga: PanchangAnga;
  karana: PanchangAnga;
  vara: { index: number; english: string; hinglish: string; lord: string };
  paksha: "Shukla" | "Krishna";
  masa: { name: string; note: string };
  rahukaal: PanchangWindow;
  yamagandam: PanchangWindow;
  gulika: PanchangWindow;
  abhijitMuhurat: PanchangWindow;
  brahmaMuhurat: PanchangWindow;
  /** Sidereal longitudes at the panchang anchor (local sunrise), trust readout. */
  sunSiderealDeg: number;
  moonSiderealDeg: number;
  ayanamsaDeg: number;
}

// ─── Static name tables (rule sources noted in comments) ─────────────────────

// 30 tithis: 15 Shukla + 15 Krishna (waxing starts at elongation 0° = new moon).
const TITHI_BASE_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
]; // index 14 of each paksha = Purnima / Amavasya

// 27 yogas — standard Vriddhi name list (solar + lunar combined longitude / 13°20′).
const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
  "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
  "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
  "Indra", "Vaidhriti",
];

// 11 karanas: 7 chara (movable) + 4 sthira (fixed). Rule used by Drik Panchang:
// half-tithi #0 (Shukla Pratipada first half) = Kimstughna; #57/58/59 =
// Shakuni/Chatushpada/Naga; all others cycle Bava→Vishti in sevens.
const CHARA_KARANA_NAMES = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"];
const STHIRA_KARANA_NAMES = ["Shakuni", "Chatushpada", "Naga"]; // slots 57,58,59 (Kimstughna = slot 0)

const VARA = [
  { english: "Sunday", hinglish: "Ravi Vara", lord: "Sun" },
  { english: "Monday", hinglish: "Som Vara", lord: "Moon" },
  { english: "Tuesday", hinglish: "Mangal Vara", lord: "Mars" },
  { english: "Wednesday", hinglish: "Budh Vara", lord: "Mercury" },
  { english: "Thursday", hinglish: "Guru Vara", lord: "Jupiter" },
  { english: "Friday", hinglish: "Shukra Vara", lord: "Venus" },
  { english: "Saturday", hinglish: "Shani Vara", lord: "Saturn" },
];

// Solar-sign → masa (amanta, approximate). Sankranti-based; the chandra-masa
// actually printed in calendars can shift by one when an adhika-masa occurs.
const MASA_BY_SUN_SIGN = [
  "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashwina",
  "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna", "Chaitra",
];

// ─── Weekday eighth-part mapping (widely published South-Indian convention,
//     e.g. Lakshmanan's "Pancharatna Hoda" / Drik Panchangam tables; indexed
//     with Sunday = 0). These are the standard Ganita/panchanga windows:
//   Rahu Kaal     : Sun 2, Mon 7, Tue 5, Wed 4, Thu 3, Fri 1, Sat 6
//   Yamagandam    : Sun 4, Mon 3, Tue 7, Wed 1, Thu 6, Fri 2, Sat 5
//     (a.k.a. Ambreyal / Amrita-ghna in Telugu panchangams)
//   Gulika Kaalam : Sun 7, Mon 5, Tue 3, Wed 6, Thu 2, Fri 4, Sat 1
const RAHU_PART_BY_WEEKDAY = [2, 7, 5, 4, 3, 1, 6];
const YAMAGANDAM_PART_BY_WEEKDAY = [4, 3, 7, 1, 6, 2, 5];
const GULIKA_PART_BY_WEEKDAY = [7, 5, 3, 6, 2, 4, 1];

// ─── Small math helpers (all deterministic, no locale) ────────────────────────

const DEG = Math.PI / 180;

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Wrap a difference into (−180, +180]. */
function wrapSigned180(x: number): number {
  const m = norm360(x);
  return m > 180 ? m - 360 : m;
}

function finiteOr(x: number, fallback: number): number {
  return Number.isFinite(x) ? x : fallback;
}

function round3(x: number): number {
  return Number(x.toFixed(3));
}

function floorSecond(ms: number): number {
  return Math.floor(ms / 1000) * 1000;
}

// ─── Astronomy primitives (mirrors packages/astrology/src/utils/ephemeris.ts) ─

function astro(ms: number): Astronomy.AstroTime {
  return Astronomy.MakeTime(new Date(ms));
}

/** Geocentric TRUE tropical ecliptic longitude of the Sun (deg). */
function sunTropicalLon(ms: number): number {
  const geoVec = Astronomy.GeoVector(Astronomy.Body.Sun, astro(ms), true);
  const ecl = Astronomy.Ecliptic(geoVec);
  return norm360(finiteOr(ecl.elon, 0));
}

/** Geocentric tropical ecliptic longitude of the Moon (deg). */
function moonTropicalLon(ms: number): number {
  const moonVec = Astronomy.GeoMoon(astro(ms));
  const ecl = Astronomy.Ecliptic(moonVec);
  return norm360(finiteOr(ecl.elon, 0));
}

/** Lahiri (Chitrapaksha) ayanamsa in degrees — reused from @zeal/astrology. */
function lahiriAyanamsa(ms: number): number {
  return finiteOr(getAyanamsa(astro(ms), "lahiri"), 23.85);
}

function sunSiderealLon(ms: number): number {
  return norm360(sunTropicalLon(ms) - lahiriAyanamsa(ms));
}

function moonSiderealLon(ms: number): number {
  return norm360(moonTropicalLon(ms) - lahiriAyanamsa(ms));
}

/**
 * lunisolar elongation (Moon − Sun). Ayanamsa cancels in the difference, so
 * tropical longitudes are exact and cheaper — sidereal tithi == tropical
 * elongation by definition.
 */
function elongation(ms: number): number {
  return norm360(moonTropicalLon(ms) - sunTropicalLon(ms));
}

/** Yoga sum in sidereal longitudes (both reduced by ayanamsa). */
function yogaSum(ms: number): number {
  return norm360(sunTropicalLon(ms) + moonTropicalLon(ms) - 2 * lahiriAyanamsa(ms));
}

// ─── NOAA sunrise/sunset (declination + hour angle, h0 = −0.833°) ─────────────

/**
 * Mean obliquity of the ecliptic (IAU 1976 value with linear/secular terms),
 * degrees. T = Julian centuries (TT) from J2000.
 */
function meanObliquityDeg(tt: number): number {
  const T = tt / 36525;
  return 23.4392911 - 0.0130042 * T - 0.000000164 * T * T + 0.000000504 * T * T * T;
}

/** Apparent geocentric declination of the Sun (deg) from ecliptic coords. */
function sunDeclinationDeg(ms: number): number {
  const geoVec = Astronomy.GeoVector(Astronomy.Body.Sun, astro(ms), true);
  const ecl = Astronomy.Ecliptic(geoVec);
  const lam = finiteOr(ecl.elon, 0) * DEG;
  const beta = finiteOr(ecl.elat, 0) * DEG;
  const eps = meanObliquityDeg(astro(ms).tt) * DEG;
  const sinDec = Math.sin(eps) * Math.sin(lam) * Math.cos(beta) + Math.cos(eps) * Math.sin(beta);
  return Math.asin(Math.max(-1, Math.min(1, sinDec))) / DEG;
}

/** Right ascension of the Sun (deg, 0-360) in the ecliptic-of-date frame. */
function sunRightAscensionDeg(ms: number): number {
  const geoVec = Astronomy.GeoVector(Astronomy.Body.Sun, astro(ms), true);
  const ecl = Astronomy.Ecliptic(geoVec);
  const lam = finiteOr(ecl.elon, 0) * DEG;
  const beta = finiteOr(ecl.elat, 0) * DEG;
  const eps = meanObliquityDeg(astro(ms).tt) * DEG;
  const y = Math.sin(lam) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps);
  const x = Math.cos(lam);
  return norm360(Math.atan2(y, x) / DEG);
}

/**
 * Equation of time (minutes), NOAA formula:
 *   EoT = 4 · ( L0 − 0.005° − α )   with L0 = geometric mean solar longitude.
 * α is the apparent right ascension; the result is wrapped to ±180° → ±720 min.
 */
function equationOfTimeMin(ms: number): number {
  const t = astro(ms);
  const T = t.ut / 36525; // Julian centuries UT (NOAA uses UT)
  const L0 = norm360(280.466456 + 36000.76983 * T + 0.0003032 * T * T);
  const ra = sunRightAscensionDeg(ms);
  return 4 * wrapSigned180(L0 - 0.005 - ra);
}

interface SolarEvents {
  transitMs: number;
  sunriseMs: number;
  sunsetMs: number;
  polar: "none" | "no-sunrise" | "no-sunset";
}

/**
 * Compute local-apparent solar transit, sunrise and sunset (UTC epoch ms) for
 * a civil date at (lat, lng). Iterates EoT/declination twice (NOAA spreadsheet
 * approach). hour angle h0 = −0.833° accounts for refraction + solar semidiam.
 */
export function computeSolarEvents(dateStr: string, lat: number, lng: number): SolarEvents {
  const { y, m, d } = splitDate(dateStr);
  const dayStartUtc = Date.UTC(y, m - 1, d);
  const phi = Math.max(-89.9, Math.min(89.9, finiteOr(lat, 20))) * DEG;

  // Apparent solar transit (local mean noon corrected by EoT + longitude):
  // minutes-of-UTC-day = 720 − 4·lngEast − EoT. Iterate for stability.
  let transitMs = dayStartUtc + 720 * 60000 - lng * 4 * 60000;
  for (let i = 0; i < 3; i++) {
    transitMs = dayStartUtc + (720 - 4 * lng - equationOfTimeMin(transitMs)) * 60000;
  }
  transitMs = floorSecond(finiteOr(transitMs, dayStartUtc + 720 * 60000));

  // Hour angle at the −0.833° altitude crossing, refined once at the events.
  let polar: SolarEvents["polar"] = "none";
  const hourAngleDeg = (decMs: number): number | null => {
    const dec = sunDeclinationDeg(decMs) * DEG;
    const cosH = (Math.sin(-0.833 * DEG) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosH >= 1) return null; // sun never reaches h0 → polar night
    if (cosH <= -1) return 180; // sun never below h0 → midnight sun
    return Math.acos(Math.max(-1, Math.min(1, cosH))) / DEG;
  };

  let ha = hourAngleDeg(transitMs);
  if (ha === null) {
    polar = "no-sunrise";
    ha = 0;
  } else if (ha >= 180) {
    polar = "no-sunset";
  }
  // One refinement pass at the raw event instants (NOAA practice).
  let riseMs = transitMs - ha * 4 * 60000;
  let setMs = transitMs + ha * 4 * 60000;
  if (polar === "none") {
    const haRise = hourAngleDeg(riseMs);
    const haSet = hourAngleDeg(setMs);
    if (haRise !== null && haRise < 180) riseMs = transitMs - haRise * 4 * 60000;
    if (haSet !== null && haSet < 180) setMs = transitMs + haSet * 4 * 60000;
  }

  // Polar safety: synthesize noon ± 6h so every downstream window stays finite.
  if (polar === "no-sunrise" || polar === "no-sunset") {
    riseMs = transitMs - 6 * 3600000;
    setMs = transitMs + 6 * 3600000;
  }

  return {
    transitMs,
    sunriseMs: floorSecond(finiteOr(riseMs, transitMs - 6 * 3600000)),
    sunsetMs: floorSecond(finiteOr(setMs, transitMs + 6 * 3600000)),
    polar,
  };
}

// ─── Date / timezone validation (exported for the API route) ──────────────────

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function splitDate(dateStr: string): { y: number; m: number; d: number } {
  const mt = DATE_RE.exec(dateStr);
  if (!mt) throw new PanchangInputError("Invalid date format — use YYYY-MM-DD.");
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new PanchangInputError("This date is not valid (leap-year/month check failed).");
  }
  return { y, m, d };
}

/** Validate a panchang date: 1900 .. currentYear + 20 (pass `nowMs` for purity). */
export function validatePanchangDate(raw: unknown, nowMs: number): string {
  const s = String(raw ?? "").trim();
  if (!s) throw new PanchangInputError("Please choose a date (YYYY-MM-DD).");
  splitDate(s); // throws on format/calendar errors
  const year = Number(s.slice(0, 4));
  const maxYear = new Date(nowMs).getUTCFullYear() + 20;
  if (year < 1900 || year > maxYear) {
    throw new PanchangInputError(`Panchang is available for dates from 1900 to ${maxYear}.`);
  }
  return s;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateTimezone(tz: unknown): string {
  const s = String(tz ?? "").trim();
  if (!s || !isValidTimezone(s)) {
    throw new PanchangInputError("Timezone must be a valid IANA name (e.g. Asia/Kolkata).");
  }
  return s;
}

export function validateLat(raw: unknown, label = "Latitude"): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -90 || n > 90) {
    throw new PanchangInputError(`${label} must be between −90 and +90.`);
  }
  return n;
}

export function validateLng(raw: unknown, label = "Longitude"): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -180 || n > 180) {
    throw new PanchangInputError(`${label} must be between −180 and +180.`);
  }
  return n;
}

// ─── Intl formatting (instants computed UTC, rendered in target tz) ───────────

const fmtCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Wall-clock "HH:mm" for a UTC instant in the target IANA tz.
 * The instants are pure UTC math; only rendering is tz-aware (Intl with
 * hourCycle h23 — a fixed 24-hour time schedule — so output never flips AM/PM
 * or locale formats between server and browser).
 */
export function formatTimeInTz(tz: string, ms: number): string {
  let fmt = fmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    fmtCache.set(tz, fmt);
  }
  const parts = fmt.formatToParts(new Date(ms));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.length === 1 ? `0${hour}` : hour}:${minute}`;
}

function toTime(tz: string, ms: number): PanchangTime {
  return { time: formatTimeInTz(tz, ms), iso: new Date(ms).toISOString() };
}

const dayFmtCache = new Map<string, Intl.DateTimeFormat>();

/** Civil date "YYYY-MM-DD" for a UTC instant rendered in the target tz. */
function dayInTz(tz: string, ms: number): string {
  let fmt = dayFmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFmtCache.set(tz, fmt);
  }
  return fmt.format(new Date(ms)); // en-CA yields YYYY-MM-DD
}

function toWindow(tz: string, startMs: number, endMs: number, part?: number): PanchangWindow {
  const t = toTime(tz, startMs);
  return {
    ...t,
    end: formatTimeInTz(tz, endMs),
    endISO: new Date(endMs).toISOString(),
    part,
  };
}

// ─── Anga boundary solver (bisection on monotonic unwrapped series) ───────────

/** Build an unwrapped (monotonic non-decreasing) version of a cyclic series. */
function makeUnwrapped(baseFn: (ms: number) => number, anchorMs: number): (ms: number) => number {
  const a = baseFn(anchorMs);
  return (ms: number) => a + wrapSigned180(baseFn(ms) - a);
}

/**
 * Find the instant where the monotonic unwrapped series crosses `target`.
 * Requires u(lo) <= target <= u(hi); bisection is deterministic (fixed 45
 * iterations → sub-ms resolution, engine==server regardless of float eps).
 */
function findCross(u: (ms: number) => number, target: number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  if (u(a) > target) b = a; // degenerate — return bracket edge (never NaN)
  if (u(b) < target) a = b;
  for (let i = 0; i < 45; i++) {
    const mid = (a + b) / 2;
    if (u(mid) < target) a = mid;
    else b = mid;
  }
  return floorSecond((a + b) / 2);
}

interface AngaSpec {
  baseFn: (ms: number) => number; // cyclic 0-360 value
  periodDeg: number; // segment width
  nameAt: (index0: number) => string; // index0 = floor(value/period), 0-based
}

function computeAnga(spec: AngaSpec, anchorMs: number, tz: string): PanchangAnga {
  const u = makeUnwrapped(spec.baseFn, anchorMs);
  const v = u(anchorMs);
  const k = Math.max(0, Math.min(Math.floor(360 / spec.periodDeg) - 1, Math.floor(v / spec.periodDeg)));
  const DAY = 86400000;
  // 2.6-day brackets are provably sufficient: relative rates are ≥10.8°/day
  // for elongation/karana (6-12° targets) and ≥12.7°/day for nakshatra/yoga.
  const startMs = findCross(u, k * spec.periodDeg, anchorMs - 2.6 * DAY, anchorMs);
  const endMs = findCross(u, (k + 1) * spec.periodDeg, anchorMs, anchorMs + 2.6 * DAY);
  const nextEndMs = findCross(u, (k + 2) * spec.periodDeg, anchorMs, anchorMs + 3.4 * DAY);
  const t = toTime(tz, startMs);
  return {
    ...t,
    end: formatTimeInTz(tz, endMs),
    endISO: new Date(endMs).toISOString(),
    startOn: dayInTz(tz, startMs),
    endOn: dayInTz(tz, endMs),
    nextEndOn: dayInTz(tz, nextEndMs),
    index: k,
    number: k + 1,
    name: spec.nameAt(k),
    nextName: spec.nameAt(k + 1),
    nextEnd: formatTimeInTz(tz, nextEndMs),
    nextEndISO: new Date(nextEndMs).toISOString(),
  };
}

// ─── Name resolvers ───────────────────────────────────────────────────────────

function tithiName(index0: number): string {
  const i = ((index0 % 30) + 30) % 30;
  const withinPaksha = i % 15;
  if (withinPaksha === 14) return i < 15 ? "Purnima" : "Amavasya";
  return TITHI_BASE_NAMES[withinPaksha] ?? "Pratipada";
}

function karanaName(halfIndex0: number): string {
  const h = ((halfIndex0 % 60) + 60) % 60;
  if (h === 0) return "Kimstughna"; // first half-tithi of the lunar month (sthira)
  if (h >= 57) return STHIRA_KARANA_NAMES[h - 57] ?? "Shakuni";
  return CHARA_KARANA_NAMES[(h - 1) % 7] ?? "Bava";
}

function nakshatraAt(index0: number): { name: string; lord: string } {
  const i = ((index0 % 27) + 27) % 27;
  const n = NAKSHATRAS[i] ?? NAKSHATRAS[0]!;
  return { name: n.name, lord: n.lord };
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export interface PanchangRequest {
  /** Civil date YYYY-MM-DD (interpreted in `timezone`). */
  date: string;
  lat: number;
  lng: number;
  timezone: string; // IANA
  placeLabel?: string;
}

/**
 * Deterministic daily panchang. Pure function of (date, lat, lng, timezone):
 * same inputs → byte-identical JSON on server, client, and any machine.
 */
export function computeDayPanchang(req: PanchangRequest): PanchangDayResult {
  splitDate(req.date); // validates format + calendar legality
  const date = req.date;
  const lat = Math.max(-90, Math.min(90, finiteOr(req.lat, 20)));
  const lng = Math.max(-180, Math.min(180, finiteOr(req.lng, 77)));
  const tz = validateTimezone(req.timezone);

  const solar = computeSolarEvents(date, lat, lng);
  // Traditional day-start for panchanga elements is local sunrise; polar
  // fallbacks already synthesize noon ± 6h so this is always finite.
  const anchorMs = solar.sunriseMs;

  // Anga values at anchor (sidereal; trust readout).
  const sunSid = round3(sunSiderealLon(anchorMs));
  const moonSid = round3(moonSiderealLon(anchorMs));
  const ayan = round3(lahiriAyanamsa(anchorMs));

  // Tithi — period 12° of elongation, 30-name table with paksha split.
  const elongU = makeUnwrapped(elongation, anchorMs);
  const elongV = elongU(anchorMs);
  const tithiIdx = Math.max(0, Math.min(29, Math.floor(elongV / 12)));
  const tithi = computeAnga(
    { baseFn: elongation, periodDeg: 12, nameAt: (i) => tithiName(i) },
    anchorMs,
    tz
  );
  tithi.index = tithiIdx;
  const paksha: "Shukla" | "Krishna" = tithiIdx < 15 ? "Shukla" : "Krishna";
  const within = tithiIdx % 15;
  tithi.number = within + 1;

  // Nakshatra — period 360/27° of sidereal Moon; pada = quarter of segment.
  const nak = computeAnga(
    { baseFn: moonSiderealLon, periodDeg: 360 / 27, nameAt: (i) => nakshatraAt(i).name },
    anchorMs,
    tz
  );
  const nakIdx = ((nak.index % 27) + 27) % 27;
  const moonAtAnchor = finiteOr(moonSiderealLon(anchorMs), nakIdx * (360 / 27));
  const degInNak = moonAtAnchor - nakIdx * (360 / 27);
  const nakshatra: PanchangNakshatra = {
    ...nak,
    pada: Math.max(1, Math.min(4, Math.floor(degInNak / (360 / 27 / 4)) + 1)),
    lord: nakshatraAt(nakIdx).lord,
  };

  // Yoga — period 360/27° of (sidereal Sun + sidereal Moon).
  const yoga = computeAnga(
    {
      baseFn: yogaSum,
      periodDeg: 360 / 27,
      nameAt: (i) => YOGA_NAMES[((i % 27) + 27) % 27] ?? "Vishkambha",
    },
    anchorMs,
    tz
  );

  // Karana — half-tithi (6° of elongation), 11 names with sthira specials.
  const karana = computeAnga(
    { baseFn: elongation, periodDeg: 6, nameAt: (i) => karanaName(i) },
    anchorMs,
    tz
  );

  // Vara — weekday of the civil date (date string is already the local day).
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0=Sun
  const varaRow = VARA[weekday] ?? VARA[0]!;
  const vara = { index: weekday, ...varaRow };

  // Masa (approximate, solar-sign based — see MASA_BY_SUN_SIGN comment).
  const sunSign = Math.floor(sunSid / 30) % 12;
  const masa = {
    name: MASA_BY_SUN_SIGN[sunSign] ?? "Chaitra",
    note: "Saura (sankranti-based) approximation — the chandra-masa printed in calendars may differ by one in adhika-masa years.",
  };

  // Eighth-of-day windows (sunrise → sunset divided in 8 equal parts).
  const dayMs = Math.max(60000, solar.sunsetMs - solar.sunriseMs);
  const partMs = dayMs / 8;
  const windowOf = (part: number): PanchangWindow =>
    toWindow(tz, solar.sunriseMs + (part - 1) * partMs, solar.sunriseMs + part * partMs, part);

  const rahukaal = windowOf(RAHU_PART_BY_WEEKDAY[weekday] ?? 2);
  const yamagandam = windowOf(YAMAGANDAM_PART_BY_WEEKDAY[weekday] ?? 4);
  const gulika = windowOf(GULIKA_PART_BY_WEEKDAY[weekday] ?? 7);

  // Abhijit Muhurat — ±24 min around local apparent noon (standard rule).
  const abhijitMuhurat = toWindow(tz, solar.transitMs - 24 * 60000, solar.transitMs + 24 * 60000);
  // Brahma Muhurta — 96 → 48 minutes before sunrise (standard 48-min window).
  const brahmaMuhurat = toWindow(tz, solar.sunriseMs - 96 * 60000, solar.sunriseMs - 48 * 60000);

  return {
    date,
    placeLabel: String(req.placeLabel ?? "").trim() || `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    lat: round3(lat),
    lng: round3(lng),
    timezone: tz,
    sunrise: toTime(tz, solar.sunriseMs),
    sunset: toTime(tz, solar.sunsetMs),
    solarNoon: toTime(tz, solar.transitMs),
    dayLengthMinutes: Math.round(dayMs / 60000),
    polar: solar.polar,
    tithi,
    nakshatra,
    yoga,
    karana,
    vara,
    paksha,
    masa,
    rahukaal,
    yamagandam,
    gulika,
    abhijitMuhurat,
    brahmaMuhurat,
    sunSiderealDeg: sunSid,
    moonSiderealDeg: moonSid,
    ayanamsaDeg: ayan,
  };
}

/** Karana paksha note helper for the UI (moon-strength half-day split). */
export function karanaDisplayNumber(halfIndex0: number): number {
  const h = ((halfIndex0 % 60) + 60) % 60;
  return h + 1; // human 1-based within the 60 half-tithis of the lunar month
}
