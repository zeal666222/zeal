/**
 * Quick ayanamsa comparison: current formula vs Spica-based
 */
import * as Astronomy from "astronomy-engine";

const DEG = Math.PI / 180;

// Current code: Swiss Ephemeris polynomial
const LAHIRI_J2000 = 23 + 51 / 60 + 25.5324 / 3600;
function generalPrecessionInLongitude(T: number): number {
  return 5029.0966 * T + 1.11113 * T * T - 0.00001 * T * T * T;
}
function currentAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  return ((LAHIRI_J2000 + generalPrecessionInLongitude(T) / 3600) % 360 + 360) % 360;
}

// Fix: Spica-based calculation (Lahiri definition)
function spicaBasedAyanamsa(time: Astronomy.AstroTime): number {
  const T = time.tt / 36525;
  const p_planet = 0.1244 * T;
  const omega = 125.04452 - 1934.136261 * T;
  const nutation_corr = -0.00477 * Math.sin(omega * DEG);
  const spica_tropical = ((180.006667 + (50.3803 - p_planet) * T / 3600 + nutation_corr) % 360 + 360) % 360;
  return ((spica_tropical - 180.0) % 360 + 360) % 360;
}

function fmt(d: number): string {
  const deg = Math.floor(d);
  const m = Math.floor((d - deg) * 60);
  const s = Math.round(((d - deg) * 60 - m) * 60);
  return `${deg}°${String(m).padStart(2, "0")}'${String(Math.abs(s)).padStart(2, "0")}"`;
}

// Published Lahiri values (from Indian Astronomical Ephemeris / multiple sources)
const published: Record<string, number> = {
  "1900-01-01": 22.7681,  // 22°46'05"
  "1950-01-01": 23.1597,  // 23°09'35" (approximate)
  "2000-01-01": 23.8561,  // 23°51'22"
  "2024-01-01": 24.3000,  // 24°18'00" (approximate)
  "2025-01-01": 24.3083,  // 24°18'30" (approximate)
};

console.log("Date       | Published  | Current    | Spica-based | Curr Err | Spica Err");
console.log("-----------|------------|------------|-------------|----------|----------");

for (const [dateStr, pub] of Object.entries(published)) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const time = Astronomy.MakeTime(new Date(Date.UTC(y!, m! - 1, d!)));
  const curr = currentAyanamsa(time);
  const spica = spicaBasedAyanamsa(time);
  const currErr = (curr - pub) * 60; // arcminutes
  const spicaErr = (spica - pub) * 60;
  console.log(
    `${dateStr} | ${fmt(pub).padEnd(10)} | ${fmt(curr).padEnd(10)} | ${fmt(spica).padEnd(11)} | ${currErr.toFixed(1).padStart(6)}' | ${spicaErr.toFixed(1).padStart(6)}'`
  );
}

// Also test for Narendra Modi's birth date
console.log("\n--- Narendra Modi (1950-09-17) ---");
const modiTime = Astronomy.MakeTime(new Date(Date.UTC(1950, 8, 17)));
console.log(`Current:  ${fmt(currentAyanamsa(modiTime))}`);
console.log(`Spica:    ${fmt(spicaBasedAyanamsa(modiTime))}`);
console.log(`Expected: ~22°46' (published for 1950)`);
