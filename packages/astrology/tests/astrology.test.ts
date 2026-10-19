// ============================================================================
// Astrology Engine Tests
// ============================================================================
// Validates core calculations against known birth data.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  computeRashiChart,
  computeNavamsaChart,
  computeWesternNatalChart,
  computeVimshottariDasha,
  computeFourPillars,
  computePanchanga,
  getAyanamsa,
  getNakshatra,
  degreesToSignDeg,
  computeLST,
  computeAscendant,
} from "../src/index";
import { getAstroTime } from "../src/utils/ephemeris";
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
