// ============================================================================
// Chinese BaZi (Four Pillars of Destiny)
// ============================================================================
// Computes the Four Pillars: Year, Month, Day, Hour.
// Each pillar consists of a Heavenly Stem and an Earthly Branch.
// ============================================================================

import type {
  BirthData, FourPillars, Pillar, HeavenlyStem, EarthlyBranch,
  WuXing, TenGod, LuckPillar,
} from "../types";

/** The 10 Heavenly Stems in order */
const HEAVENLY_STEMS: HeavenlyStem[] = [
  "Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui",
];

/** The 12 Earthly Branches in order */
const EARTHLY_BRANCHES: EarthlyBranch[] = [
  "Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai",
];

/** WuXing (Five Elements) for Heavenly Stems */
const STEMS_ELEMENT: Record<HeavenlyStem, WuXing> = {
  Jia: "Wood", Yi: "Wood",
  Bing: "Fire", Ding: "Fire",
  Wu: "Earth", Ji: "Earth",
  Geng: "Metal", Xin: "Metal",
  Ren: "Water", Gui: "Water",
};

/** WuXing for Earthly Branches */
const BRANCHES_ELEMENT: Record<EarthlyBranch, WuXing> = {
  Zi: "Water", Chou: "Earth", Yin: "Wood", Mao: "Wood",
  Chen: "Earth", Si: "Fire", Wu: "Earth", Wei: "Earth",
  Shen: "Metal", You: "Metal", Xu: "Earth", Hai: "Water",
};

/** Hidden stems within each Earthly Branch */
const BRANCH_HIDDEN_STEMS: Record<EarthlyBranch, HeavenlyStem[]> = {
  Zi: ["Gui"],
  Chou: ["Ji", "Gui", "Xin"],
  Yin: ["Jia", "Bing", "Wu"],
  Mao: ["Yi"],
  Chen: ["Wu", "Yi", "Gui"],
  Si: ["Bing", "Wu", "Geng"],
  Wu: ["Ji", "Ding", "Yi"],
  Wei: ["Ji", "Ding", "Yi"],
  Shen: ["Geng", "Ren", "Wu"],
  You: ["Xin"],
  Xu: ["Wu", "Xin", "Ding"],
  Hai: ["Ren", "Jia"],
};

/** WuXing generation cycle (producing) */
const ELEMENT_GENERATES: Record<WuXing, WuXing> = {
  Wood: "Fire", Fire: "Earth", Earth: "Metal", Metal: "Water", Water: "Wood",
};

/** WuXing overcoming cycle */
const ELEMENT_OVERCOMES: Record<WuXing, WuXing> = {
  Wood: "Earth", Fire: "Metal", Earth: "Water", Metal: "Wood", Water: "Fire",
};

/**
 * Ten Gods relationship based on Day Master element and target stem element.
 */
function computeTenGod(dayMaster: HeavenlyStem, targetStem: HeavenlyStem): string {
  const dmElement = STEMS_ELEMENT[dayMaster];
  const targetElement = STEMS_ELEMENT[targetStem];

  const isSamePolarity = HEAVENLY_STEMS.indexOf(dayMaster) % 2 === HEAVENLY_STEMS.indexOf(targetStem) % 2;

  if (dmElement === targetElement) {
    return isSamePolarity ? "Friend" : "Rob Wealth";
  }
  if (ELEMENT_GENERATES[dmElement] === targetElement) {
    return isSamePolarity ? "Eating God" : "Hurting Officer";
  }
  if (ELEMENT_OVERCOMES[dmElement] === targetElement) {
    return isSamePolarity ? "Indirect Wealth" : "Direct Wealth";
  }
  if (ELEMENT_OVERCOMES[targetElement] === dmElement) {
    return isSamePolarity ? "Seven Killings" : "Direct Officer";
  }
  // target generates dm
  return isSamePolarity ? "Indirect Seal" : "Direct Seal";
}

/**
 * Compute the Year Pillar.
 * Uses the Chinese calendar year (based on the solar term Li Chun, ~Feb 4).
 */
function computeYearPillar(year: number, _month: number, _day: number): Pillar {
  // Chinese year starts at Li Chun (~Feb 4)
  // For simplicity, if month < 2, use previous year
  const chineseYear = _month < 2 ? year - 1 : year;

  // Heavenly Stem: (year - 4) % 10
  const stemIndex = ((chineseYear - 4) % 10 + 10) % 10;
  // Earthly Branch: (year - 4) % 12
  const branchIndex = ((chineseYear - 4) % 12 + 12) % 12;

  const stem = HEAVENLY_STEMS[stemIndex] ?? "Jia";
  const branch = EARTHLY_BRANCHES[branchIndex] ?? "Zi";

  return {
    heavenlyStem: stem,
    earthlyBranch: branch,
    stemElement: STEMS_ELEMENT[stem],
    branchElement: BRANCHES_ELEMENT[branch],
    hiddenStems: BRANCH_HIDDEN_STEMS[branch],
  };
}

/**
 * Compute the Month Pillar.
 * The month is determined by solar terms (Jie Qi), not lunar months.
 */
function computeMonthPillar(year: number, month: number, yearStem: HeavenlyStem): Pillar {
  // Month branch: month 1 = Yin (Tiger), month 2 = Mao, etc.
  const branchIndex = (month + 1) % 12;
  const branch = EARTHLY_BRANCHES[branchIndex] ?? "Yin";

  // Month stem is derived from the year stem
  // Using the "Five Tigers" formula
  const yearStemIndex = HEAVENLY_STEMS.indexOf(yearStem);
  const baseStemIndex = (yearStemIndex % 5) * 2;
  const stemIndex = (baseStemIndex + month - 1) % 10;
  const stem = HEAVENLY_STEMS[stemIndex] ?? "Jia";

  return {
    heavenlyStem: stem,
    earthlyBranch: branch,
    stemElement: STEMS_ELEMENT[stem],
    branchElement: BRANCHES_ELEMENT[branch],
    hiddenStems: BRANCH_HIDDEN_STEMS[branch],
  };
}

/**
 * Compute the Day Pillar.
 * Uses a formula based on the Julian calendar day number.
 */
function computeDayPillar(year: number, month: number, day: number): Pillar {
  // Compute Julian Day Number
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JDN = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;

  // Day stem: (JDN + 49) % 10 (offset calibrated to known dates)
  const stemIndex = Math.floor((JDN + 49) % 10);
  const branchIndex = Math.floor((JDN + 1) % 12);

  const stem = HEAVENLY_STEMS[((stemIndex % 10) + 10) % 10] ?? "Jia";
  const branch = EARTHLY_BRANCHES[((branchIndex % 12) + 12) % 12] ?? "Zi";

  return {
    heavenlyStem: stem,
    earthlyBranch: branch,
    stemElement: STEMS_ELEMENT[stem],
    branchElement: BRANCHES_ELEMENT[branch],
    hiddenStems: BRANCH_HIDDEN_STEMS[branch],
  };
}

/**
 * Compute the Hour Pillar.
 * The hour is divided into 12 two-hour periods (shi chen).
 */
function computeHourPillar(hour: number, dayStem: HeavenlyStem): Pillar {
  // Chinese hour: 23-01 = Zi, 01-03 = Chou, etc.
  let branchIndex: number;
  if (hour === 23 || hour === 0) branchIndex = 0;
  else branchIndex = Math.floor((hour + 1) / 2);

  const branch = EARTHLY_BRANCHES[branchIndex] ?? "Zi";

  // Hour stem derived from day stem ("Five Rats" formula)
  const dayStemIndex = HEAVENLY_STEMS.indexOf(dayStem);
  const baseStemIndex = (dayStemIndex % 5) * 2;
  const stemIndex = (baseStemIndex + branchIndex) % 10;
  const stem = HEAVENLY_STEMS[stemIndex] ?? "Jia";

  return {
    heavenlyStem: stem,
    earthlyBranch: branch,
    stemElement: STEMS_ELEMENT[stem],
    branchElement: BRANCHES_ELEMENT[branch],
    hiddenStems: BRANCH_HIDDEN_STEMS[branch],
  };
}

/**
 * Compute Luck Pillars (Da Yun /大运).
 * Luck Pillars are 10-year periods that progress through the person's life.
 */
function computeLuckPillars(
  monthPillar: Pillar,
  _gender: "male" | "female",
  startAge: number = 5
): LuckPillar[] {
  const luckPillars: LuckPillar[] = [];
  const monthStemIndex = HEAVENLY_STEMS.indexOf(monthPillar.heavenlyStem);
  const monthBranchIndex = EARTHLY_BRANCHES.indexOf(monthPillar.earthlyBranch);

  // Direction: forward or backward based on gender and year stem polarity
  // Simplified: always forward for now
  const direction = 1; // 1 = forward, -1 = backward

  for (let i = 1; i <= 8; i++) {
    const stemIndex = ((monthStemIndex + direction * i) % 10 + 10) % 10;
    const branchIndex = ((monthBranchIndex + direction * i) % 12 + 12) % 12;

    luckPillars.push({
      startAge: startAge + (i - 1) * 10,
      endAge: startAge + i * 10 - 1,
      heavenlyStem: HEAVENLY_STEMS[stemIndex] ?? "Jia",
      earthlyBranch: EARTHLY_BRANCHES[branchIndex] ?? "Zi",
    });
  }

  return luckPillars;
}

/**
 * Compute the complete Four Pillars (BaZi) chart.
 */
export function computeFourPillars(birthData: BirthData): FourPillars {
  const [year, month, day] = birthData.birthDate.split("-").map(Number);
  const [hours, minutes] = birthData.birthTime.split(":").map(Number);

  if (!year || !month || !day || hours === undefined || minutes === undefined) {
    throw new Error("Invalid birth date or time format");
  }

  const yearPillar = computeYearPillar(year, month, day);
  const monthPillar = computeMonthPillar(year, month, yearPillar.heavenlyStem);
  const dayPillar = computeDayPillar(year, month, day);
  const hourPillar = computeHourPillar(hours, dayPillar.heavenlyStem);

  // Compute Ten Gods for each pillar relative to the Day Master
  const dayMaster = dayPillar.heavenlyStem;
  const tenGods: TenGod[] = [
    {
      pillar: "year",
      stem: yearPillar.heavenlyStem,
      god: computeTenGod(dayMaster, yearPillar.heavenlyStem),
    },
    {
      pillar: "month",
      stem: monthPillar.heavenlyStem,
      god: computeTenGod(dayMaster, monthPillar.heavenlyStem),
    },
    {
      pillar: "hour",
      stem: hourPillar.heavenlyStem,
      god: computeTenGod(dayMaster, hourPillar.heavenlyStem),
    },
  ];

  // Compute Luck Pillars (simplified: assume male, start age ~5)
  const luckPillars = computeLuckPillars(monthPillar, "male");

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    dayMaster,
    dayMasterElement: STEMS_ELEMENT[dayMaster],
    tenGods,
    luckPillars,
  };
}
