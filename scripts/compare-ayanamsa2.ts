/**
 * Ayanamsa comparison: current polynomial vs Spica-based (corrected)
 */
import * as Astronomy from "astronomy-engine";

const DEG = Math.PI / 180;

// Current code: Swiss Ephemeris polynomial
const LAHIRI_J2000 = 23 + 51 / 60 + 25.5324 / 3600; // 23.85709°
function currentAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  const prec = 5029.0966 * T + 1.11113 * T * T - 0.00001 * T * T * T;
  return ((LAHIRI_J2000 + prec / 3600) % 360 + 360) % 360;
}

// Fix: Spica-based ayanamsa (true Lahiri definition)
// Spica (α Virginis) J2000 tropical position: ~180°00'22" (Libra 0°00'22")
// The Lahiri ayanamsa = Spica_tropical(T) - 180°
// Spica_tropical(T) = Spica_J2000 + accumulated_precession_of_equinox
function spicaAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525; // Julian centuries TT from J2000
  // Precession of equinox in longitude (Meeus/IAU), arcseconds
  const p = 5038.481507 * T; // ~50.38"/yr (precession of equinox, not general prec-in-long)
  // Spica's tropical longitude at time T
  const spicaTropical = 180.0 + (22.0 + p / 3600) / 3600 * 3600 / 3600;
  // Actually: Spica_J2000 = 180°00'22" = 180 + 22/3600
  const spicaJ2000 = 180 + 22 / 3600; // degrees
  const spicaLon = spicaJ2000 + p / 3600; // precess forward
  const ayanamsa = spicaLon - 180.0;
  return ((ayanamsa % 360) + 360) % 360;
}

function fmt(d: number): string {
  const deg = Math.floor(d);
  const minFull = (d - deg) * 60;
  const m = Math.floor(minFull);
  const s = Math.round((minFull - m) * 60);
  return `${deg}°${String(m).padStart(2, "0")}'${String(Math.abs(s)).padStart(2, "0")}"`;
}

// Test at key epochs
const epochs = [
  { label: "J1900", date: new Date(Date.UTC(1900, 0, 1)) },
  { label: "J1950", date: new Date(Date.UTC(1950, 0, 1)) },
  { label: "J2000", date: new Date(Date.UTC(2000, 0, 1)) },
  { label: "J2024", date: new Date(Date.UTC(2024, 0, 1)) },
  { label: "J2025", date: new Date(Date.UTC(2025, 0, 1)) },
  { label: "Modi 1950-09-17", date: new Date(Date.UTC(1950, 8, 17)) },
];

console.log("Epoch           | Current (SE poly) | Spica-based   | Difference");
console.log("----------------|-------------------|---------------|----------");
for (const { label, date } of epochs) {
  const time = Astronomy.MakeTime(date);
  const curr = currentAyanamsa(time);
  const spica = spicaAyanamsa(time);
  const diff = (spica - curr) * 60; // arcminutes
  console.log(`${label.padEnd(15)} | ${fmt(curr).padEnd(17)} | ${fmt(spica).padEnd(13)} | ${diff.toFixed(2)}'`);
}

// Also compute Moon position for Modi to check
console.log("\n--- Moon position check (Modi 1950-09-17 00:55 UTC) ---");
const modiTime = Astronomy.MakeTime(new Date(Date.UTC(1950, 8, 17, 0, 55, 0)));
const moonVec = Astronomy.GeoVector(Astronomy.Body.Moon, modiTime, true);
const moonEcl = Astronomy.Ecliptic(moonVec);
const moonTropical = ((moonEcl.elon % 360) + 360) % 360;
const ayanCurr = currentAyanamsa(modiTime);
const ayanSpica = spicaAyanamsa(modiTime);
const moonSiderealCurr = ((moonTropical - ayanCurr) % 360 + 360) % 360;
const moonSiderealSpica = ((moonTropical - ayanSpica) % 360 + 360) % 360;

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
function toSign(lon: number) {
  const idx = Math.floor(lon / 30);
  const deg = lon - idx * 30;
  return `${SIGNS[idx]} ${deg.toFixed(2)}°`;
}

console.log(`Moon tropical:  ${fmt(moonTropical)} (${moonTropical.toFixed(4)}°)`);
console.log(`Ayanamsa (curr): ${fmt(ayanCurr)}`);
console.log(`Ayanamsa (spica): ${fmt(ayanSpica)}`);
console.log(`Moon sidereal (current): ${toSign(moonSiderealCurr)}`);
console.log(`Moon sidereal (spica):   ${toSign(moonSiderealSpica)}`);
