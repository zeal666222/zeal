/**
 * Kundali Accuracy Verification Script
 * Tests the computation pipeline against known reference charts.
 *
 * Usage: npx tsx scripts/verify-kundali.ts
 */
import * as Astronomy from "astronomy-engine";

// ─── Copy the core functions from the astrology package ──────────────────────

function toJulianDate(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24
    + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  let yr = y;
  let mo = m;
  if (mo <= 2) { yr -= 1; mo += 12; }
  const A = Math.floor(yr / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (yr + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + B - 1524.5;
}

function meanObliquity(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return 23.439291111111
    - (46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 3600;
}

function nutation(jd: number): { dPsi: number; dEps: number } {
  const DEG = Math.PI / 180;
  const T = (jd - 2451545.0) / 36525;
  const omega = 125.04452 - 1934.136261 * T + 0.0020754 * T * T + (T * T * T) / 467441;
  const sunLong = 280.4661737 + 36000.7698278 * T;
  const moonLong = 218.316386254 + 481267.88175154 * T;
  return {
    dPsi: -17.20 * Math.sin(omega * DEG) - 1.32 * Math.sin(2 * sunLong * DEG)
      - 0.23 * Math.sin(2 * moonLong * DEG) + 0.21 * Math.sin(2 * omega * DEG),
    dEps: 9.20 * Math.cos(omega * DEG) + 0.57 * Math.cos(2 * sunLong * DEG)
      + 0.10 * Math.cos(2 * moonLong * DEG) - 0.09 * Math.cos(2 * omega * DEG),
  };
}

function apparentObliquity(jd: number): number {
  return meanObliquity(jd) + nutation(jd).dEps / 3600;
}

function gmstDegrees(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T - (T * T * T) / 38710000.0;
  return ((gmst % 360) + 360) % 360;
}

function computeLST(date: Date, longitude: number): number {
  const jd = toJulianDate(date);
  const ee = (nutation(jd).dPsi * Math.cos(meanObliquity(jd) * Math.PI / 180)) / 3600;
  const gast = gmstDegrees(jd) + ee;
  return (((gast + longitude) % 360) + 360) % 360;
}

function computeAscendant(ramc: number, latitude: number, obliquity: number): number {
  const ramcRad = ramc * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const oblRad = obliquity * Math.PI / 180;
  const y = -Math.cos(ramcRad);
  const x = Math.sin(oblRad) * Math.tan(latRad) + Math.cos(oblRad) * Math.sin(ramcRad);
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) return (((ramc + 90) % 360) + 360) % 360;
  const asc = (((Math.atan2(y, x) * 180 / Math.PI) % 360) + 360) % 360;
  const raOf = (lonDeg: number): number => {
    const l = lonDeg * Math.PI / 180;
    return (((Math.atan2(Math.cos(oblRad) * Math.sin(l), Math.cos(l)) * 180 / Math.PI) % 360) + 360) % 360;
  };
  const dist = (a: number, b: number): number => {
    const d = (((a - b) % 360) + 360) % 360;
    return d > 180 ? 360 - d : d;
  };
  const target = (((ramc + 90) % 360) + 360) % 360;
  const other = (asc + 180) % 360;
  if (dist(raOf(other), target) < dist(raOf(asc), target)) return other;
  return asc;
}

function computeMC(lst: number, obliquity: number): number {
  const DEG = Math.PI / 180;
  const lstRad = lst * DEG;
  const oblRad = obliquity * DEG;
  const mc = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(oblRad)) * 180 / Math.PI;
  return ((mc % 360) + 360) % 360;
}

// Ayanamsa
const LAHIRI_J2000 = 23 + 51 / 60 + 25.5324 / 3600;
function generalPrecessionInLongitude(T: number): number {
  return 5029.0966 * T + 1.11113 * T * T - 0.00001 * T * T * T;
}
function computeLahiriAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  return ((LAHIRI_J2000 + generalPrecessionInLongitude(T) / 3600) % 360 + 360) % 360;
}

// Planet positions
function getApparentEcliptic(body: Astronomy.Body, time: Astronomy.AstroTime) {
  const geoVec = Astronomy.GeoVector(body, time, true);
  const ecl = Astronomy.Ecliptic(geoVec);
  return {
    lon: ((ecl.elon % 360) + 360) % 360,
    lat: ecl.elat,
    dist: Math.hypot(geoVec.x, geoVec.y, geoVec.z),
  };
}

function getRahuLongitude(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  const omega = 125.04452 - 1934.136261 * T + 0.0020754 * T * T
    + (T * T * T) / 467441 - (T * T * T * T) / 60610000;
  return ((omega % 360) + 360) % 360;
}

// ─── Zodiac signs ────────────────────────────────────────────────────────────
const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

function lonToSign(lon: number): { sign: string; index: number; deg: number; min: number; sec: number } {
  const norm = ((lon % 360) + 360) % 360;
  const idx = Math.floor(norm / 30);
  const inSign = norm - idx * 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  const s = Math.round(((inSign - d) * 60 - m) * 60);
  return { sign: SIGNS[idx], index: idx, deg: d, min: m, sec: s };
}

function fmtDms(lon: number): string {
  const { sign, deg, min, sec } = lonToSign(lon);
  return `${sign} ${deg}°${String(min).padStart(2, "0")}'${String(sec).padStart(2, "0")}"`;
}

// ─── Test cases ──────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  birthDate: string;   // YYYY-MM-DD
  birthTime: string;   // HH:MM local
  timezone: string;
  lat: number;
  lng: number;
  /** Expected approximate values from published charts / multiple software */
  expected: {
    lagna?: string;       // e.g. "Leo" or "Leo 15°"
    sun?: string;
    moon?: string;
    mars?: string;
    jupiter?: string;
    saturn?: string;
    rahu?: string;
    ketu?: string;
  };
}

const TESTS: TestCase[] = [
  {
    name: "Narendra Modi",
    birthDate: "1950-09-17",
    birthTime: "06:25",
    timezone: "Asia/Kolkata",
    lat: 23.67,
    lng: 72.37,  // Vadnagar, Gujarat
    expected: {
      lagna: "Leo",       // Simha Lagna
      sun: "Virgo",       // Sidereal Sun in Virgo (Aug-Sep)
      moon: "Gemini",     // Mrigashira/Gemini
    },
  },
  {
    name: "Test: 2000-01-01 06:00 Delhi",
    birthDate: "2000-01-01",
    birthTime: "06:00",
    timezone: "Asia/Kolkata",
    lat: 28.6139,
    lng: 77.209,
    expected: {
      sun: "Sagittarius",  // Sidereal Sun ~Dec 31 = Sagittarius
    },
  },
];

// ─── Run tests ───────────────────────────────────────────────────────────────

function tzOffsetMinutes(wallUtcMs: number, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts: Record<string, number> = {};
    for (const p of dtf.formatToParts(new Date(wallUtcMs))) {
      if (p.type !== "literal") parts[p.type] = Number(p.value);
    }
    const hour = parts.hour === 24 ? 0 : parts.hour ?? 0;
    const asUtc = Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1,
      hour, parts.minute ?? 0, parts.second ?? 0);
    return Math.round((asUtc - wallUtcMs) / 60000);
  } catch { return 0; }
}

function parseBirth(dateStr: string, timeStr: string, tz: string, lat: number, lng: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const wallUtcMs = Date.UTC(year!, month! - 1, day!, hours!, minutes!);
  const isIndia = lat > 6 && lat < 36 && lng > 68 && lng < 98;
  const offset = tz ? tzOffsetMinutes(wallUtcMs, tz) : (isIndia ? 330 : 0);
  const date = new Date(wallUtcMs);
  date.setMinutes(date.getMinutes() - offset);
  return date;
}

function computeChart(tc: TestCase) {
  const utcDate = parseBirth(tc.birthDate, tc.birthTime, tc.timezone, tc.lat, tc.lng);
  const time = Astronomy.MakeTime(utcDate);
  const ayanamsa = computeLahiriAyanamsa(time);

  const lst = computeLST(utcDate, tc.lng);
  const eps = apparentObliquity(toJulianDate(utcDate));
  const mcTropical = computeMC(lst, eps);
  const mcSidereal = ((mcTropical - ayanamsa) % 360 + 360) % 360;
  const ascTropical = computeAscendant(lst, tc.lat, eps);
  const ascSidereal = ((ascTropical - ayanamsa) % 360 + 360) % 360;

  // Planet positions
  const planets: Record<string, number> = {};
  for (const [name, body] of [
    ["Sun", Astronomy.Body.Sun], ["Moon", Astronomy.Body.Moon],
    ["Mars", Astronomy.Body.Mars], ["Mercury", Astronomy.Body.Mercury],
    ["Jupiter", Astronomy.Body.Jupiter], ["Venus", Astronomy.Body.Venus],
    ["Saturn", Astronomy.Body.Saturn],
  ] as const) {
    const ecl = getApparentEcliptic(body, time);
    planets[name] = ((ecl.lon - ayanamsa) % 360 + 360) % 360;
  }

  const rahuTropical = getRahuLongitude(time);
  planets["Rahu"] = ((rahuTropical - ayanamsa) % 360 + 360) % 360;
  planets["Ketu"] = ((planets["Rahu"] + 180) % 360);

  return { utcDate, ayanamsa, ascSidereal, mcSidereal, planets };
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  KUNDALI ACCURACY VERIFICATION");
console.log("═══════════════════════════════════════════════════════════\n");

for (const tc of TESTS) {
  console.log(`━━━ ${tc.name} ━━━`);
  console.log(`Birth: ${tc.birthDate} ${tc.birthTime} ${tc.timezone}`);
  console.log(`Place: ${tc.lat}°N, ${tc.lng}°E\n`);

  const result = computeChart(tc);

  console.log(`UTC instant: ${result.utcDate.toISOString()}`);
  console.log(`Ayanamsa (Lahiri): ${result.ayanamsa.toFixed(4)}° = ${fmtDms(result.ayanamsa)}`);
  console.log(`Lagna (sidereal):  ${fmtDms(result.ascSidereal)}`);
  console.log(`MC (sidereal):     ${fmtDms(result.mcSidereal)}`);
  console.log();

  for (const [name, lon] of Object.entries(result.planets)) {
    const marker = tc.expected[name.toLowerCase() as keyof typeof tc.expected]
      ? "" : "";
    console.log(`  ${name.padEnd(10)} ${fmtDms(lon)}${marker}`);
  }

  console.log();

  // Compare with expected
  if (tc.expected.lagna) {
    const actual = lonToSign(result.ascSidereal);
    const match = actual.sign === tc.expected.lagna;
    console.log(`  Lagna check: expected ${tc.expected.lagna}, got ${actual.sign} → ${match ? "✓" : "✗ MISMATCH"}`);
  }
  for (const [key, expected] of Object.entries(tc.expected)) {
    if (key === "lagna") continue;
    const actual = lonToSign(result.planets[key.charAt(0).toUpperCase() + key.slice(1)] ?? -1);
    const match = actual.sign === expected;
    console.log(`  ${key} check: expected ${expected}, got ${actual.sign} → ${match ? "✓" : "✗ MISMATCH"}`);
  }
  console.log();
}

// ─── Cross-check: ayanamsa values at known epochs ────────────────────────────
console.log("━━━ Ayanamsa cross-check at known epochs ━━━");
const epochs = [
  { label: "J1900 (1900-01-01)", date: new Date(Date.UTC(1900, 0, 1)) },
  { label: "J1950 (1950-01-01)", date: new Date(Date.UTC(1950, 0, 1)) },
  { label: "B1950 (1950-01-0.923)", date: new Date(Date.UTC(1949, 11, 31, 17, 50)) },
  { label: "J2000 (2000-01-01)", date: new Date(Date.UTC(2000, 0, 1)) },
  { label: "J2024 (2024-01-01)", date: new Date(Date.UTC(2024, 0, 1)) },
  { label: "J2025 (2025-01-01)", date: new Date(Date.UTC(2025, 0, 1)) },
];
for (const { label, date } of epochs) {
  const time = Astronomy.MakeTime(date);
  const ayan = computeLahiriAyanamsa(time);
  console.log(`  ${label.padEnd(30)} ${ayan.toFixed(6)}° = ${fmtDms(ayan)}`);
}

console.log("\n━━━ Published Lahiri reference values ━━━");
console.log("  B1950: 22°46'04.8\" (Lahiri committee original)");
console.log("  J2000: ~23°51' (various published tables)");
console.log("  2024:  ~24°18' (online calculators)");
console.log("  2025:  ~24°19' (projected)");
