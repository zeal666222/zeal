// ============================================================================
// Kundali Brief — the one canonical chart block
// ============================================================================
// Both the web app and the Cloudflare chat worker hand an AI consultant the
// same deterministic chart. Duplicating the formatter meant the two drifted
// (the worker's block had no antardasha, no exact tithi end, no self-check),
// so the brief — computation *and* wording — lives here once.
//
// Nothing in this file is interpreted: it computes the D1, D9, Vimshottari
// dasha and birth Panchanga, verifies they agree with each other, and says so.
// The model is only ever asked to read the numbers, never to produce them.
// ============================================================================

import type { BirthData, DashaPeriod, PlanetName, PlanetPosition } from "../types";
import { VEDIC_PLANETS } from "../types";
import { computeRashiChart, degreesToSignDeg, getNakshatra, parseBirthDateTime } from "./rashi";
import { computeNavamsaChart } from "./navamsa";
import { computeVimshottariDasha } from "./dasha";
import { computePanchanga } from "./panchanga";
import { getAstroTime, getVedicPlanetPositions } from "../utils/ephemeris";
import { getAyanamsa } from "../utils/ayanamsa";
import { apparentObliquity, computeLST, computeMC, toJulianDate } from "../utils/houses";

export interface BriefVerification {
  label: string;
  passed: boolean;
  detail: string;
}

export interface BriefPlanet {
  /** Mirrors `PlanetPosition.planet`, which is a string in the shared types. */
  planet: string;
  sign: string;
  signIndex: number;
  /** Degrees within the sign, 0-30. */
  degreeInSign: number;
  house: number;
  nakshatra: string;
  pada: number;
  isRetrograde: boolean;
  /** Apparent motion in deg/day; negative means retrograde. */
  speedPerDay: number;
}

export interface KundaliBrief {
  input: {
    name: string;
    birthDate: string;
    birthTime: string;
    place: string;
    lat: number;
    lng: number;
    timezone: string;
    /** True when the seeker didn't give a time and we charted local noon. */
    timeApproximate: boolean;
  };
  lagna: { sign: string; degreeInSign: number };
  mc: { sign: string; degreeInSign: number };
  sunSign: string;
  moon: { sign: string; nakshatra: string; pada: number };
  navamsaLagna: string;
  ayanamsa: number;
  panchanga: {
    tithi: string;
    tithiEnds: string;
    nakshatra: string;
    nakshatraEnds: string;
    yoga: string;
    yogaEnds: string;
    karana: string;
    karanaEnds: string;
  };
  planets: BriefPlanet[];
  dasha: {
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    window: string;
    nextAntardasha: string;
    remainingYears: number;
    sequence: string[];
  };
  verification: BriefVerification[];
  /** Everything checked out. A false here means the AI must hedge. */
  consistent: boolean;
}

const PLANET_DEVANAGARI: Record<string, string> = {
  Sun: "Surya", Moon: "Chandra", Mars: "Mangal", Mercury: "Budh",
  Jupiter: "Guru", Venus: "Shukra", Saturn: "Shani", Rahu: "Rahu", Ketu: "Ketu",
};

/** Degrees as `12°34'`. */
function dms(deg: number): string {
  const d = Math.floor(deg);
  const m = Math.floor(Math.round((deg - d) * 60));
  return `${d}°${String(m === 60 ? 0 : m).padStart(2, "0")}'`;
}

/** Trim an ISO instant to `YYYY-MM-DD HH:MM`. */
function stamp(iso: string): string {
  if (!iso || iso.length < 16) return iso;
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * An ISO instant as the clock the seeker actually read at birth. Leaving these
 * in UTC made the AI quote "tithi runs till 15:42" against a 19:00 birth.
 */
function localStamp(iso: string, timeZone: string): string {
  if (!iso) return iso;
  try {
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(new Date(iso))) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
    const hour = parts.hour === "24" ? "00" : parts.hour ?? "00";
    return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
  } catch {
    return stamp(iso);
  }
}

function describePeriod(p: DashaPeriod): string {
  return `${p.planet} ${p.startDate} → ${p.endDate}`;
}

/**
 * The deterministic chart for a birth, as a single structure both the web and
 * the worker can format. Throws only when the engine itself cannot chart
 * (invalid date/time), never when a check fails — a failing check is data.
 */
export function computeKundaliBrief(
  birthData: BirthData,
  opts: { name?: string; place?: string } = {},
): KundaliBrief {
  const instant = parseBirthDateTime(birthData);
  const time = getAstroTime(instant);
  const ayanamsa = getAyanamsa(time, "lahiri");

  const chart = computeRashiChart(birthData);
  const navamsa = computeNavamsaChart(birthData);
  const dasha = computeVimshottariDasha(birthData);
  const panchanga = computePanchanga(birthData);

  const states = getVedicPlanetPositions(time, ayanamsa);
  const lst = computeLST(instant, birthData.birthPlace.lng);
  const eps = apparentObliquity(toJulianDate(instant));
  const mcLon = ((computeMC(lst, eps) - ayanamsa) % 360 + 360) % 360;
  const mcData = degreesToSignDeg(mcLon);

  const moon = chart.planets.find((p) => p.planet === "Moon");
  const sun = chart.planets.find((p) => p.planet === "Sun");

  const planets: BriefPlanet[] = chart.planets.map((p: PlanetPosition) => ({
    planet: p.planet,
    sign: p.sign,
    signIndex: p.signIndex,
    degreeInSign: p.degree + p.minute / 60,
    house: p.house,
    nakshatra: p.nakshatra ?? getNakshatra(p.absoluteDegree).name,
    pada: p.nakshatraPada ?? 1,
    isRetrograde: p.isRetrograde,
    speedPerDay: Math.round((states.get(p.planet as PlanetName)?.speed ?? 0) * 1000) / 1000,
  }));

  // ─── Self-consistency: the four engines must tell the same story ──────────
  const checks: BriefVerification[] = [];

  checks.push({
    label: "Graha Sthiti",
    passed: planets.length === VEDIC_PLANETS.length,
    detail: `${planets.length}/${VEDIC_PLANETS.length} grahas computed (7 visible + Rahu + Ketu).`,
  });

  const lagnaData = degreesToSignDeg(chart.ascendant.degree);
  const lagnaDeg = lagnaData.degree + lagnaData.minute / 60;
  const mcDeg = mcData.degree + mcData.minute / 60;
  checks.push({
    label: "Lagna",
    passed: Boolean(chart.ascendant.sign) && lagnaDeg >= 0 && lagnaDeg < 30,
    detail: `Lagna ${chart.ascendant.sign} ${dms(lagnaDeg)}, Bhava Madhya ${dms(mcDeg)}.`,
  });

  checks.push({
    label: "Chandra Nakshatra",
    passed: Boolean(moon?.nakshatra) && moon?.nakshatra === panchanga.nakshatra.name,
    detail: `D1 Moon ${moon?.nakshatra ?? "—"} · Panchanga ${panchanga.nakshatra.name}.`,
  });

  checks.push({
    label: "Dasha seeding",
    passed: Boolean(moon?.nakshatraLord) && dasha.allMahardashas[0]?.planet === moon?.nakshatraLord,
    detail: `First Mahadasha ${dasha.allMahardashas[0]?.planet ?? "—"}, seeded by ${moon?.nakshatraLord ?? "—"}.`,
  });

  checks.push({
    label: "Lahiri Ayanamsa",
    passed: ayanamsa > 20 && ayanamsa < 27,
    detail: `${ayanamsa.toFixed(3)}° (${dms(ayanamsa)}).`,
  });

  const rahu = chart.planets.find((p) => p.planet === "Rahu");
  const ketu = chart.planets.find((p) => p.planet === "Ketu");
  // Ketu is defined as Rahu + 180°, so the two are opposite by construction;
  // measure the deviation from opposition, not the raw separation.
  const nodeDiff = rahu && ketu
    ? (((rahu.absoluteDegree - ketu.absoluteDegree) % 360) + 360) % 360
    : NaN;
  const nodeGap = Number.isNaN(nodeDiff) ? 999 : Math.abs(nodeDiff - 180);
  checks.push({
    label: "Rahu-Ketu axis",
    passed: nodeGap < 0.001,
    detail: `Chhaya graha ${nodeGap < 0.001 ? "exactly opposite" : `${nodeGap.toFixed(2)}° off — chart is inconsistent`}.`,
  });

  checks.push({
    label: "Surya gati",
    passed: !sun?.isRetrograde && (states.get("Sun")?.speed ?? 0) > 0.5,
    detail: `Sun moves ${((states.get("Sun")?.speed ?? 0) * 60).toFixed(1)}'/day and can never be retrograde.`,
  });

  // Whole-sign bhava: a planet's house must follow from its sign alone.
  const lagnaSignIndex = chart.ascendant.signIndex;
  const houseOk = planets.every(
    (p) => p.house === ((p.signIndex - lagnaSignIndex + 12) % 12) + 1,
  );
  checks.push({
    label: "Bhava ganana",
    passed: houseOk,
    detail: `Whole-sign (Panchayatana) bhavas consistent with the Lagna sign.`,
  });

  // ─── Where the seeker stands in the dasha right now ───────────────────────
  const cd = dasha.currentDasha;
  const adList = cd.mahadasha.subPeriods ?? [];
  const adIndex = adList.findIndex((a) => a.startDate === cd.antardasha.startDate && a.planet === cd.antardasha.planet);
  const nextAd = adIndex >= 0 ? adList[adIndex + 1] : undefined;

  return {
    input: {
      name: opts.name?.trim() || "Seeker",
      birthDate: birthData.birthDate,
      birthTime: birthData.birthTime,
      place: opts.place?.trim() || `${birthData.birthPlace.lat.toFixed(4)}, ${birthData.birthPlace.lng.toFixed(4)}`,
      lat: birthData.birthPlace.lat,
      lng: birthData.birthPlace.lng,
      timezone: birthData.timezone ?? "UTC",
      timeApproximate: !birthData.birthTime || birthData.birthTime === "12:00",
    },
    lagna: { sign: chart.ascendant.sign, degreeInSign: lagnaDeg },
    mc: { sign: mcData.sign, degreeInSign: mcDeg },
    sunSign: sun?.sign ?? "—",
    moon: { sign: moon?.sign ?? "—", nakshatra: moon?.nakshatra ?? "—", pada: moon?.nakshatraPada ?? 1 },
    navamsaLagna: navamsa.ascendant.sign,
    ayanamsa,
    panchanga: {
      tithi: `${panchanga.tithi.name} (${panchanga.tithi.paksha} ${panchanga.tithi.number})`,
      tithiEnds: localStamp(panchanga.tithi.endTime, birthData.timezone ?? "UTC"),
      nakshatra: panchanga.nakshatra.name,
      nakshatraEnds: localStamp(panchanga.nakshatra.endTime, birthData.timezone ?? "UTC"),
      yoga: panchanga.yoga.name,
      yogaEnds: localStamp(panchanga.yoga.endTime, birthData.timezone ?? "UTC"),
      karana: panchanga.karana.name,
      karanaEnds: localStamp(panchanga.karana.endTime, birthData.timezone ?? "UTC"),
    },
    planets,
    dasha: {
      mahadasha: cd.mahadasha.planet,
      antardasha: cd.antardasha.planet,
      pratyantardasha: cd.pratyantardasha?.planet ?? cd.antardasha.planet,
      window: `${cd.antardasha.startDate} → ${cd.antardasha.endDate}` +
        (cd.pratyantardasha ? ` · PA ${cd.pratyantardasha.startDate} → ${cd.pratyantardasha.endDate}` : ""),
      nextAntardasha: nextAd ? describePeriod(nextAd) : "—",
      remainingYears: cd.remainingYears,
      sequence: adList.map(describePeriod),
    },
    verification: checks,
    consistent: checks.every((c) => c.passed),
  };
}

/**
 * The prompt block. Dense on purpose: every line is a fact the consultant may
 * quote, and the closing line forbids re-computation, which is where planetary
 * hallucination comes from.
 */
export function formatKundaliBrief(brief: KundaliBrief): string {
  const lines: string[] = [
    `VISHLESHIT JANAM KUNDALI — deterministic chart from open-source astronomy-engine ephemeris (VSOP87 + ELP2000, Lahiri/ICRC ayanamsa, whole-sign bhavas). These values are computed, not estimated:`,
    `Naam: ${brief.input.name}`,
    `Janam: ${brief.input.birthDate} ${brief.input.birthTime} (local), ${brief.input.place} [${brief.input.lat.toFixed(4)}, ${brief.input.lng.toFixed(4)}, ${brief.input.timezone}]`,
    `Lagna: ${brief.lagna.sign} ${dms(brief.lagna.degreeInSign)} · Bhava Madhya (MC): ${brief.mc.sign} ${dms(brief.mc.degreeInSign)}`,
    `Chandra Rashi: ${brief.moon.sign}, ${brief.moon.nakshatra} (pada ${brief.moon.pada}) · Surya Rashi: ${brief.sunSign}`,
    `Navamsa (D9) Lagna: ${brief.navamsaLagna} · Ayanamsa: ${dms(brief.ayanamsa)}`,
    ``,
    `JANAM PANCHANGA (with the exact moment each limb ends — a birth near a boundary is sensitive to the recorded time):`,
    `- Tithi: ${brief.panchanga.tithi}, runs till ${brief.panchanga.tithiEnds}`,
    `- Nakshatra: ${brief.panchanga.nakshatra}, runs till ${brief.panchanga.nakshatraEnds}`,
    `- Yoga: ${brief.panchanga.yoga}, runs till ${brief.panchanga.yogaEnds}`,
    `- Karana: ${brief.panchanga.karana}, runs till ${brief.panchanga.karanaEnds}`,
    ``,
    `GRAH STHITI (graha · rashi + degree within it · bhava · nakshatra/pada · gati):`,
    ...brief.planets.map(
      (p) =>
        `- ${p.planet} (${PLANET_DEVANAGARI[p.planet] ?? p.planet}): ${p.sign} ${dms(p.degreeInSign)}, Bhava ${p.house}, ${p.nakshatra} pada ${p.pada}${p.isRetrograde ? ", Vakri (retrograde)" : ""}, ${p.speedPerDay.toFixed(2)}°/day`,
    ),
    ``,
    `VIMSHOTTARI DASHA (Mahadasha → Antardasha → Pratyantardasha, all sub-periods of the running Mahadasha in order):`,
    ...brief.dasha.sequence.map((s) => `- ${s}`),
    `Abhi: ${brief.dasha.mahadasha} Mahadasha / ${brief.dasha.antardasha} Antardasha / ${brief.dasha.pratyantardasha} Pratyantardasha (${brief.dasha.window}); ${brief.dasha.nextAntardasha} is next; ${brief.dasha.remainingYears} years of the Mahadasha remain.`,
    ``,
    `SELF-CHECK: ${brief.consistent ? "all consistency checks passed" : "CHECKS FAILED — hedge, do not assert precise timings"}: ${brief.verification.map((v) => `${v.label} ${v.passed ? "OK" : "FAIL"} (${v.detail})`).join("; ")}`,
  ];
  if (brief.input.timeApproximate) {
    lines.push(
      `NOTE: no exact birth time was recorded, so the chart is anchored at local noon. The Lagna, bhavas and dasha balance are unreliable — say so if you use them, and prefer the Moon's rashi/nakshatra.`,
    );
  }
  lines.push(`Do NOT recompute, adjust or invent any degree, date or period above. Quote them as given.`);
  return lines.join("\n");
}
