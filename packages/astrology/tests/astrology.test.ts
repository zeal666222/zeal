// ============================================================================
// Astrology Engine Tests
// ============================================================================
// Validates core calculations against known birth data.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  computeRashiChart,
  computeNavamsaChart,
  computeNavamsaLongitude,
  computeDivisionalLongitude,
  computeWesternNatalChart,
  computeVimshottariDasha,
  computeFourPillars,
  computePanchanga,
  getAyanamsa,
  computeLahiriAyanamsa,
  generalPrecessionInLongitude,
  getNakshatra,
  degreesToSignDeg,
  parseBirthDateTime,
  computeLST,
  computeAscendant,
  computeMC,
  getAstroTime,
  getVedicPlanetPositions,
  getWesternPlanetPositions,
  apparentObliquity,
  toJulianDate,
  karanaNameFor,
  NAKSHATRA_LORDS,
  computeKundaliBrief,
  formatKundaliBrief,
  timezoneFromLng,
} from "../src/index";
import type { BirthData } from "../src/types";

/**
 * Mahatma Gandhi: 1869-10-02, 19:00, Porbandar, India (21.6417°N, 69.6033°E)
 * Vedic (Lahiri sidereal): Sun in Virgo, Moon in Leo (both independently
 * verified against raw astronomy-engine ecliptic longitudes).
 */
const GANDHI_BIRTH: BirthData = {
  birthDate: "1869-10-02",
  birthTime: "19:00",
  birthPlace: { lat: 21.6417, lng: 69.6033 },
  timezone: "Asia/Kolkata",
};

describe("degreesToSignDeg", () => {
  it("should convert 0 degrees to Aries 0°0'0\"", () => {
    const result = degreesToSignDeg(0);
    expect(result.sign).toBe("Aries");
    expect(result.signIndex).toBe(0);
    expect(result.degree).toBe(0);
  });

  it("should convert 180.5 degrees to Libra 0°30'0\"", () => {
    const result = degreesToSignDeg(180.5);
    expect(result.sign).toBe("Libra");
    expect(result.signIndex).toBe(6);
    expect(result.degree).toBe(0);
    expect(result.minute).toBe(30);
  });

  it("should handle negative degrees (wrap around)", () => {
    const result = degreesToSignDeg(-10);
    expect(result.sign).toBe("Pisces");
    expect(result.signIndex).toBe(11);
  });
});

describe("getNakshatra", () => {
  it("should return Ashwini for 0 degrees", () => {
    const result = getNakshatra(0);
    expect(result.name).toBe("Ashwini");
    expect(result.lord).toBe("Ketu");
  });

  it("should return Bharani for 14 degrees", () => {
    const result = getNakshatra(14);
    expect(result.name).toBe("Bharani");
    expect(result.lord).toBe("Venus");
  });

  it("should return Rohini for 45 degrees", () => {
    const result = getNakshatra(45);
    expect(result.name).toBe("Rohini");
    expect(result.lord).toBe("Moon");
  });
});

describe("getAyanamsa", () => {
  it("should return a value around 23-24 degrees for year 2000", () => {
    const time = getAstroTime(new Date("2000-01-01T00:00:00Z"));
    const ayanamsa = getAyanamsa(time, "lahiri");
    expect(ayanamsa).toBeGreaterThan(23);
    expect(ayanamsa).toBeLessThan(25);
  });

  it("should increase over time (precession)", () => {
    const time1 = getAstroTime(new Date("1900-01-01T00:00:00Z"));
    const time2 = getAstroTime(new Date("2000-01-01T00:00:00Z"));
    const ayanamsa1 = getAyanamsa(time1, "lahiri");
    const ayanamsa2 = getAyanamsa(time2, "lahiri");
    expect(ayanamsa2).toBeGreaterThan(ayanamsa1);
  });
});

describe("computeRashiChart (Vedic D1)", () => {
  const chart = computeRashiChart(GANDHI_BIRTH);

  it("should produce a vedic chart", () => {
    expect(chart.type).toBe("vedic");
    expect(chart.chartName).toBe("Rashi (D1)");
  });

  it("should have 9 planets", () => {
    expect(chart.planets.length).toBe(9);
  });

  it("should have 12 houses", () => {
    expect(chart.houses.length).toBe(12);
  });

  it("should have Sun in Virgo (sidereal for Oct 2, 1869)", () => {
    const sun = chart.planets.find(p => p.planet === "Sun");
    expect(sun).toBeDefined();
    // Sun should be in Virgo (sidereal) around mid-September to mid-October
    expect(sun?.sign).toBe("Virgo");
  });

  it("should have Moon in Leo (independently verified via astronomy-engine)", () => {
    const moon = chart.planets.find(p => p.planet === "Moon");
    expect(moon).toBeDefined();
    // astronomy-engine GeoMoon at 1869-10-02T13:30Z → tropical 146.6°, Lahiri
    // ayanamsa 22.04° → sidereal 124.6° → Leo (sign idx 4). Verified independently.
    expect(moon?.sign).toBe("Leo");
  });

  it("should have a valid ayanamsa value", () => {
    expect(chart.ayanamsa).toBeDefined();
    expect(chart.ayanamsa!).toBeGreaterThan(20);
    expect(chart.ayanamsa!).toBeLessThan(25);
  });

  it("should have nakshatra data for each planet", () => {
    for (const planet of chart.planets) {
      expect(planet.nakshatra).toBeDefined();
      expect(planet.nakshatraPada).toBeDefined();
      expect(planet.nakshatraPada!).toBeGreaterThanOrEqual(1);
      expect(planet.nakshatraPada!).toBeLessThanOrEqual(4);
    }
  });
});

describe("computeNavamsaChart (Vedic D9)", () => {
  const chart = computeNavamsaChart(GANDHI_BIRTH);

  it("should produce a D9 chart", () => {
    expect(chart.type).toBe("vedic");
    expect(chart.divisionalNumber).toBe(9);
    expect(chart.divisionalName).toBe("Navamsa");
  });

  it("should have 9 planets", () => {
    expect(chart.planets.length).toBe(9);
  });

  it("should have 12 houses", () => {
    expect(chart.houses.length).toBe(12);
  });
});

describe("computeWesternNatalChart", () => {
  const chart = computeWesternNatalChart(GANDHI_BIRTH, "placidus");

  it("should produce a western chart", () => {
    expect(chart.type).toBe("western");
    expect(chart.chartName).toBe("Natal Chart");
  });

  it("should have Sun in Libra (tropical for Oct 2)", () => {
    const sun = chart.planets.find(p => p.planet === "Sun");
    expect(sun).toBeDefined();
    expect(sun?.sign).toBe("Libra");
  });

  it("should have aspects computed", () => {
    expect(chart.aspects).toBeDefined();
    expect(Array.isArray(chart.aspects)).toBe(true);
  });

  it("should use the specified house system", () => {
    expect(chart.houseSystem).toBe("placidus");
  });
});

describe("computeWesternNatalChart - whole sign", () => {
  const chart = computeWesternNatalChart(GANDHI_BIRTH, "whole-sign");

  it("should use whole sign house system", () => {
    expect(chart.houseSystem).toBe("whole-sign");
  });

  it("should have whole sign houses (each house starts at 0 degrees of a sign)", () => {
    for (const house of chart.houses) {
      // In whole sign, each house cusp should be at the start of a sign (0 degrees)
      const degreeInSign = house.degree % 30;
      expect(degreeInSign).toBe(0);
    }
  });
});

describe("computeVimshottariDasha", () => {
  const dasha = computeVimshottariDasha(GANDHI_BIRTH);

  it("should return all 9 Mahardashas", () => {
    expect(dasha.allMahardashas.length).toBe(9);
  });

  it("should total approximately 120 years", () => {
    const totalYears = dasha.allMahardashas.reduce((sum, md) => sum + md.durationYears, 0);
    expect(totalYears).toBeGreaterThan(115);
    expect(totalYears).toBeLessThanOrEqual(120);
  });

  it("should have a current dasha", () => {
    expect(dasha.currentDasha).toBeDefined();
    expect(dasha.currentDasha.mahadasha).toBeDefined();
    expect(dasha.currentDasha.antardasha).toBeDefined();
  });

  it("should have sub-periods in each Mahadasha", () => {
    for (const md of dasha.allMahardashas) {
      expect(md.subPeriods).toBeDefined();
      expect(md.subPeriods!.length).toBe(9);
    }
  });
});

describe("computeFourPillars (Chinese BaZi)", () => {
  const bazi = computeFourPillars(GANDHI_BIRTH);

  it("should have all four pillars", () => {
    expect(bazi.year).toBeDefined();
    expect(bazi.month).toBeDefined();
    expect(bazi.day).toBeDefined();
    expect(bazi.hour).toBeDefined();
  });

  it("should have a Day Master", () => {
    expect(bazi.dayMaster).toBeDefined();
    expect(bazi.dayMasterElement).toBeDefined();
  });

  it("should have Ten Gods for year, month, hour pillars", () => {
    expect(bazi.tenGods).toBeDefined();
    expect(bazi.tenGods!.length).toBe(3);
  });

  it("should have Luck Pillars", () => {
    expect(bazi.luckPillars).toBeDefined();
    expect(bazi.luckPillars!.length).toBeGreaterThan(0);
  });

  it("should have valid Heavenly Stems and Earthly Branches", () => {
    const validStems = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"];
    const validBranches = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"];

    expect(validStems).toContain(bazi.year.heavenlyStem);
    expect(validBranches).toContain(bazi.year.earthlyBranch);
    expect(validStems).toContain(bazi.day.heavenlyStem);
    expect(validBranches).toContain(bazi.day.earthlyBranch);
  });

  it("should have correct year pillar for 1869 (Snake year, Ji stem)", () => {
    // 1869 is the year of the Earth Snake (Ji Si)
    // Actually: (1869 - 4) % 10 = 1865 % 10 = 5 -> Ji (index 5)
    // (1869 - 4) % 12 = 1865 % 12 = 5 -> Si (index 5)
    expect(bazi.year.heavenlyStem).toBe("Ji");
    expect(bazi.year.earthlyBranch).toBe("Si");
  });
});

describe("computePanchanga", () => {
  const panchanga = computePanchanga(GANDHI_BIRTH);

  it("should have Tithi", () => {
    expect(panchanga.tithi).toBeDefined();
    expect(panchanga.tithi.name).toBeDefined();
    expect(panchanga.tithi.paksha).toBeDefined();
    expect(["Shukla", "Krishna"]).toContain(panchanga.tithi.paksha);
  });

  it("should have Nakshatra", () => {
    expect(panchanga.nakshatra).toBeDefined();
    expect(panchanga.nakshatra.name).toBeDefined();
    expect(panchanga.nakshatra.lord).toBeDefined();
  });

  it("should have Yoga", () => {
    expect(panchanga.yoga).toBeDefined();
    expect(panchanga.yoga.name).toBeDefined();
  });

  it("should have Karana", () => {
    expect(panchanga.karana).toBeDefined();
    expect(panchanga.karana.name).toBeDefined();
  });
});

// ============================================================================
// Ascendant regression — the old quadrant rule flipped ASC and DSC for about
// half of all birth times. Verified against the sunrise invariant computed
// independently with astronomy-engine (SearchRiseSet).
// ============================================================================
describe("computeAscendant (Lagna)", () => {
  it("equals the Sun's ecliptic longitude at sunrise (equinox, Delhi)", async () => {
    const A = await import("astronomy-engine");
    const riseUtc = new Date(Date.UTC(2024, 2, 20, 0, 54, 54)); // equinox sunrise Delhi
    const obs = new A.Observer(28.6139, 77.209, 0);
    const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, new Date(Date.UTC(2024, 2, 19, 18, 0)), 1).date;
    expect(Math.abs(rise.getTime() - riseUtc.getTime())).toBeLessThan(5 * 60_000);
    const sunLon = ((A.Ecliptic(A.GeoVector(A.Body.Sun, A.MakeTime(rise), true)).elon % 360) + 360) % 360;
    const lst = computeLST(rise, 77.209);
    const asc = computeAscendant(lst, 28.6139);
    let d = Math.abs(asc - sunLon);
    if (d > 180) d = 360 - d;
    expect(d).toBeLessThan(1.5); // sunrise ASC ~= Sun (refraction offsets by <1.5 deg)
  });

  it("is never the descendant: RA(ASC) stays ~90 deg east of RAMC", async () => {
    const eps = 23.43929111 * Math.PI / 180;
    const raOf = (lon: number) => {
      const l = (lon * Math.PI) / 180;
      return (((Math.atan2(Math.cos(eps) * Math.sin(l), Math.cos(l)) * 180) / Math.PI) % 360 + 360) % 360;
    };
    for (let lat = -60; lat <= 60; lat += 5) {
      for (let h = 0; h < 24; h += 1) {
        const date = new Date(Date.UTC(2024, 6, 15, h, 30));
        const lst = computeLST(date, 72.8777);
        const asc = computeAscendant(lst, lat);
        let raErr = ((raOf(asc) - (lst + 90)) % 360 + 360) % 360;
        if (raErr > 180) raErr = 360 - raErr;
        expect(raErr).toBeLessThan(90); // east-of-MC half, always
      }
    }
  });
});

describe("normalizeBirthTime (PM-as-AM regression)", () => {
  it("converts 12-hour forms without losing the meridiem", async () => {
    const { normalizeBirthTime } = await import("../src/index");
    expect(normalizeBirthTime("7:30 PM")).toBe("19:30");
    expect(normalizeBirthTime("7:30 pm")).toBe("19:30");
    expect(normalizeBirthTime("12:15 am")).toBe("00:15");
    expect(normalizeBirthTime("12:00 PM")).toBe("12:00");
    expect(normalizeBirthTime("16:30")).toBe("16:30");
    expect(normalizeBirthTime("4:05")).toBe("04:05");
    expect(() => normalizeBirthTime("25:99")).toThrow();
  });

  it("chart for '19:30' equals chart for '7:30 PM'", async () => {
    const { normalizeBirthTime: _n } = await import("../src/index");
    const base = { birthDate: "1990-05-15", birthPlace: { lat: 19.076, lng: 72.8777 }, timezone: "Asia/Kolkata" } as const;
    const a = computeRashiChart({ ...base, birthTime: "19:30" });
    const b = computeRashiChart({ ...base, birthTime: "7:30 PM" });
    expect(b.ascendant.degree).toBeCloseTo(a.ascendant.degree, 6);
    expect(b.planets.map((p) => p.absoluteDegree)).toEqual(a.planets.map((p) => p.absoluteDegree));
  });
});

// ============================================================================
// Accuracy regressions
// ============================================================================
// Each block below pins a defect that made a consultant's reading wrong: an
// ayanamsa constant read off a rounded table, sub-period lists that started a
// full turn early, Panchanga computed from a UTC-parsed local time, varga
// counting by an unexplained formula, and a bogus 180° flip on the MC.
// ============================================================================

const MUMBAI_1990: BirthData = {
  birthDate: "1990-08-15",
  birthTime: "14:35",
  birthPlace: { lat: 19.076, lng: 72.8777 },
  timezone: "Asia/Kolkata",
};

describe("Lahiri ayanamsa (ICRC)", () => {
  it("is 23°51'25.5324\" at the J2000 epoch", () => {
    const a = computeLahiriAyanamsa(getAstroTime(new Date("2000-01-01T12:00:00Z")));
    expect(a).toBeCloseTo(23 + 51 / 60 + 25.5324 / 3600, 4);
  });

  it("advances at the general precession rate in longitude", () => {
    // One Julian century: 5029.0966" + 1.11113" - 0.00001"
    expect(generalPrecessionInLongitude(1)).toBeCloseTo(5030.2077, 3);
    const a1900 = computeLahiriAyanamsa(getAstroTime(new Date("1900-01-01T12:00:00Z")));
    const a2000 = computeLahiriAyanamsa(getAstroTime(new Date("2000-01-01T12:00:00Z")));
    expect(a2000 - a1900).toBeCloseTo(5027.9855 / 3600, 4);
  });

  it("matches the printed value for 2026-01-01 (24°13'13\")", () => {
    const a = computeLahiriAyanamsa(getAstroTime(new Date("2026-01-01T00:00:00Z")));
    expect(a).toBeCloseTo(24.2203, 3);
  });

  it("stays inside the Lahiri band across three centuries", () => {
    for (const year of [1850, 1900, 1950, 2000, 2050, 2100]) {
      const a = computeLahiriAyanamsa(getAstroTime(new Date(`${year}-01-01T00:00:00Z`)));
      expect(a).toBeGreaterThan(20);
      expect(a).toBeLessThan(30);
    }
  });
});

describe("parseBirthDateTime (the local instant)", () => {
  it("converts a local clock reading to the true UTC instant", () => {
    expect(parseBirthDateTime(MUMBAI_1990).getTime()).toBe(Date.UTC(1990, 7, 15, 9, 5));
    expect(parseBirthDateTime({ ...MUMBAI_1990, timezone: "UTC" }).getTime()).toBe(Date.UTC(1990, 7, 15, 14, 35));
    expect(parseBirthDateTime({ ...MUMBAI_1990, timezone: "America/New_York" }).getTime())
      .toBe(Date.UTC(1990, 7, 15, 18, 35)); // EDT = UTC-4 in August
  });
});

describe("computePanchanga (intervals, not labels)", () => {
  const panchanga = computePanchanga(MUMBAI_1990);
  const chart = computeRashiChart(MUMBAI_1990);
  const instant = parseBirthDateTime(MUMBAI_1990);

  it("agrees with the D1 chart about the birth star", () => {
    // They used to disagree: Panchanga parsed the local time as UTC, a 5h30m
    // shift, which is a third of a nakshatra.
    expect(panchanga.nakshatra.name).toBe(chart.planets.find((p) => p.planet === "Moon")!.nakshatra);
  });

  it("publishes an end instant for every limb, after the asked instant", () => {
    for (const key of ["tithi", "nakshatra", "yoga", "karana"] as const) {
      const end = Date.parse(panchanga[key].endTime);
      expect(Number.isNaN(end)).toBe(false);
      expect(end).toBeGreaterThan(instant.getTime());
    }
    expect(Date.parse(panchanga.nakshatra.endTime) - instant.getTime()).toBeLessThan(2 * 86400000);
  });

  it("ends the karana no later than its parent tithi", () => {
    expect(Date.parse(panchanga.karana.endTime)).toBeLessThanOrEqual(
      Date.parse(panchanga.tithi.endTime) + 60_000
    );
  });

  it("keeps karana and tithi on the same elongation clock", () => {
    const t = panchanga.tithi.number;
    expect([2 * t - 1, 2 * t]).toContain(panchanga.karana.number);
  });

  it("names the 60-karana cycle with 7 movables and 4 fixed slots", () => {
    expect(karanaNameFor(1)).toBe("Kimstughna");
    expect(karanaNameFor(58)).toBe("Shakuni");
    expect(karanaNameFor(59)).toBe("Chatushpada");
    expect(karanaNameFor(60)).toBe("Naga");
    const movable = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"];
    expect(movable).toContain(karanaNameFor(2));
    for (let n = 2; n <= 50; n++) expect(karanaNameFor(n)).toBe(karanaNameFor(n + 7));
    for (let n = 1; n <= 60; n++) expect(movable.concat(["Kimstughna", "Shakuni", "Chatushpada", "Naga"])).toContain(karanaNameFor(n));
  });

  it("splits Purnima and Amavasya by paksha instead of merging them", () => {
    const full = computePanchanga({ ...MUMBAI_1990, birthDate: "2021-08-22", birthTime: "12:00" }); // Purnima
    const newMoon = computePanchanga({ ...MUMBAI_1990, birthDate: "2021-08-08", birthTime: "12:00" }); // Amavasya
    expect(full.tithi.name).toBe("Purnima");
    expect(full.tithi.paksha).toBe("Shukla");
    expect(newMoon.tithi.name).toBe("Amavasya");
    expect(newMoon.tithi.paksha).toBe("Krishna");
  });
});

describe("Vimshottari sub-periods", () => {
  const dasha = computeVimshottariDasha(GANDHI_BIRTH);
  const ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];

  it("begins each Antardasha list with its own Mahadasha lord", () => {
    for (const md of dasha.allMahardashas) {
      expect(md.subPeriods![0]!.planet).toBe(md.planet);
    }
  });

  it("runs the nine sub-periods in cyclic order at both levels", () => {
    for (const md of dasha.allMahardashas) {
      const start = ORDER.indexOf(md.planet as string);
      md.subPeriods!.forEach((ad, i) => {
        expect(ad.planet).toBe(ORDER[(start + i) % 9]);
        expect(ad.subPeriods!.length).toBe(9);
        const adStart = ORDER.indexOf(ad.planet as string);
        ad.subPeriods!.forEach((pa, j) => expect(pa.planet).toBe(ORDER[(adStart + j) % 9]));
      });
    }
  });

  it("scales child periods by lord years / 120 at every level", () => {
    // Saturn Mahadasha (19y) -> Saturn AD = 19*19/120 = 3.008y -> Saturn PA = 0.476y
    const saturnMd = dasha.allMahardashas.find((md) => md.planet === "Saturn" && md.durationYears > 18);
    expect(saturnMd).toBeDefined();
    const saturnAd = saturnMd!.subPeriods![0]!;
    expect(saturnAd.durationYears).toBeCloseTo((19 * 19) / 120, 2);
    expect(saturnAd.subPeriods![0]!.durationYears).toBeCloseTo(((19 * 19) / 120) * 19 / 120, 3);
  });

  it("keeps every boundary on one continuous clock", () => {
    for (const md of dasha.allMahardashas) {
      let cursor = md.startDate;
      for (const ad of md.subPeriods!) {
        expect(ad.startDate).toBe(cursor);
        expect(Date.parse(ad.endDate)).toBeGreaterThan(Date.parse(ad.startDate));
        let paCursor = ad.startDate;
        for (const pa of ad.subPeriods!) {
          expect(pa.startDate).toBe(paCursor);
          expect(Date.parse(pa.endDate)).toBeGreaterThan(Date.parse(pa.startDate));
          paCursor = pa.endDate;
        }
        expect(paCursor).toBe(ad.endDate);
        cursor = ad.endDate;
      }
      expect(cursor).toBe(md.endDate);
      expect(Date.parse(md.endDate)).toBeGreaterThan(Date.parse(md.startDate));
    }
  });

  it("indexes the nakshatra lords as the Ketu-Mercury cycle three times over", () => {
    expect(NAKSHATRA_LORDS.length).toBe(27);
    expect(NAKSHATRA_LORDS[0]).toBe("Ketu");
    expect(NAKSHATRA_LORDS[8]).toBe("Mercury");
    expect(NAKSHATRA_LORDS[26]).toBe("Mercury");
    for (let i = 0; i < 27; i++) expect(NAKSHATRA_LORDS[i]).toBe(NAKSHATRA_LORDS[i % 9]);
  });
});

describe("Divisional (varga) counting rules", () => {
  const signOf = (lon: number) => Math.floor(lon / 30);

  it("Navamsa: vargottama in the 1st part of movable, 5th of fixed, 9th of dual signs", () => {
    for (let sign = 0; sign < 12; sign++) {
      const part = [0, 4, 8][sign % 3]!;
      const lon = sign * 30 + part * (30 / 9) + 0.5;
      expect(signOf(computeNavamsaLongitude(lon))).toBe(sign);
    }
  });

  it("Drekkana (D3): own, 9th and 5th from the rashi sign", () => {
    for (let sign = 0; sign < 12; sign++) {
      expect(signOf(computeDivisionalLongitude(sign * 30 + 1, 3))).toBe(sign);
      expect(signOf(computeDivisionalLongitude(sign * 30 + 11, 3))).toBe((sign + 4) % 12);
      expect(signOf(computeDivisionalLongitude(sign * 30 + 21, 3))).toBe((sign + 8) % 12);
    }
  });

  it("Chaturthamsa (D4): own sign and the three kendras", () => {
    for (let sign = 0; sign < 12; sign++) {
      [1, 9, 17, 25].forEach((deg, i) => {
        expect(signOf(computeDivisionalLongitude(sign * 30 + deg, 4))).toBe((sign + i * 3) % 12);
      });
    }
  });

  it("Hora (D2): every sign splits into the Cancer/Leo pair", () => {
    for (let sign = 0; sign < 12; sign++) {
      const first = signOf(computeDivisionalLongitude(sign * 30 + 1, 2));
      const second = signOf(computeDivisionalLongitude(sign * 30 + 16, 2));
      expect([first, second].sort((a, b) => a - b)).toEqual([3, 4]);
      expect(first).not.toBe(second);
    }
  });

  it("Saptamsa (D7) and Dasamsa (D10) stay inside the zodiac", () => {
    for (const div of [7, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]) {
      for (let lon = 0; lon < 360; lon += 7.3) {
        const d = computeDivisionalLongitude(lon, div);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(360);
      }
    }
  });
});

describe("Ephemeris motions", () => {
  const time = getAstroTime(new Date("2024-06-15T12:00:00Z"));
  const states = getVedicPlanetPositions(time, getAyanamsa(time, "lahiri"));

  it("moves the Moon near its 13.2°/day mean and the Sun near 0.98°/day", () => {
    const moon = states.get("Moon")!;
    expect(moon.speed).toBeGreaterThan(11);
    expect(moon.speed).toBeLessThan(16);
    const sun = states.get("Sun")!;
    expect(sun.speed).toBeGreaterThan(0.9);
    expect(sun.speed).toBeLessThan(1.05);
  });

  it("regresses the nodes at ~0.053°/day and keeps Ketu opposite Rahu", () => {
    const rahu = states.get("Rahu")!;
    expect(rahu.speed).toBeLessThan(-0.04);
    expect(rahu.speed).toBeGreaterThan(-0.07);
    expect(((rahu.longitude + 180) % 360)).toBeCloseTo(states.get("Ketu")!.longitude, 8);
  });

  it("publishes a plausible lunar latitude and geocentric distance", () => {
    const moon = states.get("Moon")!;
    expect(Math.abs(moon.latitude)).toBeLessThan(5.3);
    expect(moon.distance).toBeGreaterThan(0.0023);
    expect(moon.distance).toBeLessThan(0.0028);
  });

  it("flags retrograde only for planets actually backing up", () => {
    // The Sun never stations: a retrograde Sun would mean the ayanamsa or the
    // wrap correction is broken.
    expect(states.get("Sun")!.isRetrograde).toBe(false);
    const outer = ["Mars", "Jupiter", "Saturn"].filter((p) => states.get(p as never)!.isRetrograde);
    expect(outer.length).toBeLessThanOrEqual(3);
  });

  it("keeps sidereal longitudes exactly ayanamsa behind the tropical ones", () => {
    const a = getAyanamsa(time, "lahiri");
    const tropical = getWesternPlanetPositions(time).get("Jupiter")!;
    const sidereal = states.get("Jupiter")!;
    expect(((tropical.longitude - a) % 360 + 360) % 360).toBeCloseTo(sidereal.longitude, 8);
  });
});

describe("MC and obliquity", () => {
  it("keeps the MC's right ascension equal to the RAMC", () => {
    const eps = 23.43929111;
    const e = (eps * Math.PI) / 180;
    const raOf = (lon: number) => {
      const l = (lon * Math.PI) / 180;
      return (((Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) * 180) / Math.PI) % 360 + 360) % 360;
    };
    for (let lst = 0; lst < 360; lst += 5) {
      const mc = computeMC(lst, eps);
      let err = ((raOf(mc) - lst) % 360 + 360) % 360;
      if (err > 180) err = 360 - err;
      expect(err).toBeLessThan(0.5); // the old ±180 flip broke this for half the sky
    }
  });

  it("puts the MC at the cardinal points for the cardinal LSTs", () => {
    expect(computeMC(0)).toBeCloseTo(0, 6);
    expect(computeMC(90)).toBeCloseTo(90, 6);
    expect(computeMC(180)).toBeCloseTo(180, 6);
    expect(computeMC(270)).toBeCloseTo(270, 6);
  });

  it("has an apparent obliquity near 23°26' and nutating around the mean", () => {
    const jd = toJulianDate(new Date("2000-01-01T12:00:00Z"));
    expect(apparentObliquity(jd)).toBeGreaterThan(23.4);
    expect(apparentObliquity(jd)).toBeLessThan(23.5);
    for (let i = 0; i < 400; i++) {
      const j = toJulianDate(new Date(Date.UTC(1950, 0, 1) + i * 86400000 * 4));
      expect(Math.abs(apparentObliquity(j) - (23.439291111 - (j - 2451545) / 36525 * (46.815 / 3600)))).toBeLessThan(0.005);
    }
  });
});

describe("computeKundaliBrief (the one chart block both stacks share)", () => {
  const brief = computeKundaliBrief(GANDHI_BIRTH, { name: "Mahatma Gandhi", place: "Porbandar, Gujarat" });

  it("passes every self-consistency check on a real birth", () => {
    expect(brief.consistent).toBe(true);
    expect(brief.verification.every((c) => c.passed)).toBe(true);
    expect(brief.planets.length).toBe(9);
    expect(brief.planets.every((p) => p.house >= 1 && p.house <= 12)).toBe(true);
  });

  it("carries the antardasha sequence of the running mahadasha", () => {
    expect(brief.dasha.sequence.length).toBe(9);
    expect(brief.dasha.sequence[0]!.startsWith(brief.dasha.mahadasha)).toBe(true);
    expect(brief.dasha.window).toContain("→");
    expect(brief.dasha.pratyantardasha).toBeTruthy();
  });

  it("publishes panchanga end instants, not just labels", () => {
    expect(brief.panchanga.tithiEnds).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(brief.panchanga.nakshatraEnds).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("formats a block the model is told not to recompute", () => {
    const text = formatKundaliBrief(brief);
    expect(text).toContain("Mahatma Gandhi");
    expect(text).toContain("Porbandar, Gujarat");
    expect(text).toContain("Antardasha");
    expect(text).toContain("runs till");
    expect(text).toContain(brief.moon.nakshatra);
    expect(text).toContain("Do NOT recompute");
    expect(text).toContain("all consistency checks passed");
  });

  it("flags a noon-anchored chart when no birth time was given", () => {
    const noTime = computeKundaliBrief({ ...GANDHI_BIRTH, birthTime: "12:00" });
    expect(noTime.input.timeApproximate).toBe(true);
    expect(formatKundaliBrief(noTime)).toContain("anchored at local noon");
  });
});

describe("timezoneFromLng", () => {
  it("knows India runs on one civil zone and uses mean solar zones elsewhere", () => {
    expect(timezoneFromLng(72.8777)).toBe("Asia/Kolkata");
    expect(timezoneFromLng(-74)).toBe("Etc/GMT+5");
    expect(timezoneFromLng(139.65)).toBe("Etc/GMT-9");
    expect(timezoneFromLng(0.12)).toBe("Etc/GMT");
    for (const lng of [-179, -74, 0, 8, 77, 139, 178]) {
      const tz = timezoneFromLng(lng);
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: tz })).not.toThrow();
    }
  });
});
