import { computeRashiChart, computeWesternNatalChart, computeFourPillars, computeVimshottariDasha, getAyanamsa } from "../src/index";
import { getAstroTime } from "../src/utils/ephemeris";

const gandhi = {
  birthDate: "1869-10-02",
  birthTime: "19:00",
  birthPlace: { lat: 21.6417, lng: 69.6033 },
};

// Test ayanamsa
const time = getAstroTime(new Date("2000-01-01T00:00:00Z"));
const ayanamsa = getAyanamsa(time, "lahiri");
console.log("Ayanamsa at J2000:", ayanamsa.toFixed(4));

// Test Vedic chart
console.log("\n--- VEDIC RASHI CHART (Gandhi) ---");
const vedic = computeRashiChart(gandhi);
console.log("Chart type:", vedic.type);
console.log("Ayanamsa:", vedic.ayanamsa?.toFixed(4));
for (const p of vedic.planets) {
  console.log(`  ${p.planet.padEnd(8)} ${p.sign.padEnd(12)} ${p.degree}d${p.minute}m  House: ${p.house}  ${p.nakshatra}`);
}
console.log("Ascendant:", vedic.ascendant.sign, vedic.ascendant.degree.toFixed(2) + "d");

// Test Western chart
console.log("\n--- WESTERN NATAL CHART (Gandhi) ---");
const western = computeWesternNatalChart(gandhi, "placidus");
for (const p of western.planets) {
  console.log(`  ${p.planet.padEnd(10)} ${p.sign.padEnd(12)} ${p.degree}d${p.minute}m`);
}
console.log("Aspects:", western.aspects.length);

// Test BaZi
console.log("\n--- CHINESE BA ZI (Gandhi) ---");
const bazi = computeFourPillars(gandhi);
console.log("Year:", bazi.year.heavenlyStem, bazi.year.earthlyBranch);
console.log("Month:", bazi.month.heavenlyStem, bazi.month.earthlyBranch);
console.log("Day:", bazi.day.heavenlyStem, bazi.day.earthlyBranch, "(Day Master)");
console.log("Hour:", bazi.hour.heavenlyStem, bazi.hour.earthlyBranch);

// Test Dasha
console.log("\n--- VIMSHOTTARI DASHA (Gandhi) ---");
const dasha = computeVimshottariDasha(gandhi);
for (const md of dasha.allMahardashas) {
  console.log(`  ${md.planet.padEnd(8)} ${md.startDate} - ${md.endDate} (${md.durationYears.toFixed(1)} yrs)`);
}
console.log("Current:", dasha.currentDasha.mahadasha.planet, "/", dasha.currentDasha.antardasha.planet);

// Assertions
console.log("\n--- VALIDATION ---");
const sunVedic = vedic.planets.find(p => p.planet === "Sun");
console.log("Sun in Virgo (Vedic):", sunVedic?.sign === "Virgo" ? "PASS" : "FAIL (got " + sunVedic?.sign + ")");

const sunWestern = western.planets.find(p => p.planet === "Sun");
console.log("Sun in Libra (Western):", sunWestern?.sign === "Libra" ? "PASS" : "FAIL (got " + sunWestern?.sign + ")");

console.log("BaZi year = Ji Si:", bazi.year.heavenlyStem === "Ji" && bazi.year.earthlyBranch === "Si" ? "PASS" : "FAIL");
console.log("Dasha total ~120 yrs:", dasha.allMahardashas.reduce((s, m) => s + m.durationYears, 0).toFixed(1));
console.log("9 Mahardashas:", dasha.allMahardashas.length === 9 ? "PASS" : "FAIL");
