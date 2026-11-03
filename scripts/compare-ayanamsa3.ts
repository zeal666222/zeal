/**
 * Correct Spica-based ayanamsa: accumulated precession from zero-epoch (~285 CE)
 */
import * as Astronomy from "astronomy-engine";

// Current code: Swiss Ephemeris polynomial
const LAHIRI_J2000 = 23 + 51 / 60 + 25.5324 / 3600;
function currentAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  const prec = 5029.0966 * T + 1.11113 * T * T - 0.00001 * T * T * T;
  return ((LAHIRI_J2000 + prec / 3600) % 360 + 360) % 360;
}

// Correct Spica-based: ayanamsa = accumulated precession from zero epoch
// The Lahiri ayanamsa is zero when the tropical equinox coincides with
// Spica at 180° (year ~285 CE). At any time T, ayanamsa = p_rate * (T - T_zero).
//
// Calibrated: at J2000, ayanamsa must equal 23.856° (= LAHIRI_J2000).
// T_zero = J2000 - 23.856° / (50.38"/yr) = J2000 - 1710.4 years ≈ 289.6 CE
// This is consistent with the traditional zero-epoch of ~285 CE.
function spicaAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  // Rate: precession of equinox relative to Spica, arcsec/Julian century
  // 50.38"/year × 100 = 5038"/century (slightly more than general-prec-in-long 5029"/cy)
  const RATE = 5038.0 / 3600; // degrees per Julian century
  // Anchor: at J2000 (T=0), ayanamsa = LAHIRI_J2000
  return ((LAHIRI_J2000 + RATE * T) % 360 + 360) % 360;
}

function fmt(d: number): string {
  const deg = Math.floor(d);
  const minFull = (d - deg) * 60;
  const m = Math.floor(minFull);
  const s = Math.round((minFull - m) * 60);
  return `${deg}°${String(m).padStart(2, "0")}'${String(Math.abs(s)).padStart(2, "0")}"`;
}

const epochs = [
  { label: "J1900", date: new Date(Date.UTC(1900, 0, 1)) },
  { label: "J1950", date: new Date(Date.UTC(1950, 0, 1)) },
  { label: "Modi 1950-09-17", date: new Date(Date.UTC(1950, 8, 17)) },
  { label: "J2000", date: new Date(Date.UTC(2000, 0, 1)) },
  { label: "J2024", date: new Date(Date.UTC(2024, 0, 1)) },
  { label: "J2025", date: new Date(Date.UTC(2025, 0, 1)) },
];

console.log("Epoch              | SE Polynomial | Spica-based  | Δ (arcsec)");
console.log("-------------------|---------------|--------------|----------");
for (const { label, date } of epochs) {
  const time = Astronomy.MakeTime(date);
  const curr = currentAyanamsa(time);
  const spica = spicaAyanamsa(time);
  const diffSec = (spica - curr) * 3600;
  console.log(`${label.padEnd(18)} | ${fmt(curr).padEnd(13)} | ${fmt(spica).padEnd(12)} | ${diffSec.toFixed(1)}"`);
}

// Verify Moon position for Modi
console.log("\n--- Full chart: Modi (1950-09-17 06:25 IST, Vadnagar) ---");
const utcDate = new Date(Date.UTC(1950, 8, 17, 0, 55, 0)); // 06:25 IST = 00:55 UTC
const time = Astronomy.MakeTime(utcDate);
const ayan = spicaAyanamsa(time);
console.log(`Ayanamsa: ${fmt(ayan)} (${ayan.toFixed(6)}°)`);

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
function toSign(lon: number) {
  const norm = ((lon % 360) + 360) % 360;
  const idx = Math.floor(norm / 30);
  const deg = norm - idx * 30;
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return `${SIGNS[idx]} ${d}°${String(m).padStart(2, "0")}'`;
}

for (const [name, body] of [
  ["Sun", Astronomy.Body.Sun], ["Moon", Astronomy.Body.Moon],
  ["Mars", Astronomy.Body.Mars], ["Mercury", Astronomy.Body.Mercury],
  ["Jupiter", Astronomy.Body.Jupiter], ["Venus", Astronomy.Body.Venus],
  ["Saturn", Astronomy.Body.Saturn],
] as const) {
  const gv = Astronomy.GeoVector(body, time, true);
  const ecl = Astronomy.Ecliptic(gv);
  const tropical = ((ecl.elon % 360) + 360) % 360;
  const sidereal = ((tropical - ayan) % 360 + 360) % 360;
  console.log(`  ${name.padEnd(10)} tropical: ${fmt(tropical).padEnd(14)} sidereal: ${toSign(sidereal)}`);
}
