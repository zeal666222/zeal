// ============================================================================
// Core Types for the Zeal Astrology Engine
// ============================================================================

/** Geographic coordinates for birth place */
export interface GeoLocation {
  lat: number;
  lng: number;
}

/** Birth data input */
export interface BirthData {
  birthDate: string; // ISO 8601 date (YYYY-MM-DD)
  birthTime: string; // ISO 8601 time (HH:MM) in 24h format
  birthPlace: GeoLocation;
  timezone?: string; // IANA timezone, e.g. "Asia/Kolkata"
}

// ============================================================================
// Zodiac & Planet Enums
// ============================================================================

export type ZodiacSign =
  | "Aries" | "Taurus" | "Gemini" | "Cancer"
  | "Leo" | "Virgo" | "Libra" | "Scorpio"
  | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

export const ZODIAC_SIGNS: ZodiacSign[] = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/** Vedic sign names (Sanskrit) */
export const RASHI_NAMES: string[] = [
  "Mesha", "Vrishabha", "Mithuna", "Karka",
  "Simha", "Kanya", "Tula", "Vrischika",
  "Dhanu", "Makara", "Kumbha", "Meena",
];

export type PlanetName =
  | "Sun" | "Moon" | "Mars" | "Mercury"
  | "Jupiter" | "Venus" | "Saturn"
  | "Rahu" | "Ketu";

export const VEDIC_PLANETS: PlanetName[] = [
  "Sun", "Moon", "Mars", "Mercury",
  "Jupiter", "Venus", "Saturn",
  "Rahu", "Ketu",
];

export type WesternPlanet =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  | "NorthNode" | "SouthNode";

export const WESTERN_PLANETS: WesternPlanet[] = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
  "NorthNode", "SouthNode",
];

export type HouseSystem = "placidus" | "whole-sign" | "koch" | "equal";

// ============================================================================
// Chart Position Types
// ============================================================================

/** A single planetary position in a chart */
export interface PlanetPosition {
  planet: string;
  sign: ZodiacSign;
  signIndex: number; // 0-11
  degree: number; // 0-30 within sign
  minute: number;
  second: number;
  absoluteDegree: number; // 0-360
  house: number; // 1-12
  isRetrograde: boolean;
  nakshatra?: string; // Vedic: 27 nakshatras
  nakshatraPada?: number; // 1-4
  nakshatraLord?: string;
}

/** House cusp data */
export interface HouseCusp {
  house: number; // 1-12
  sign: ZodiacSign;
  signIndex: number;
  degree: number; // absolute degree 0-360
}

/** A complete natal chart */
export interface NatalChart {
  type: "vedic" | "western";
  chartName: string; // e.g. "Rashi", "Navamsa", "Natal"
  birthData: BirthData;
  planets: PlanetPosition[];
  houses: HouseCusp[];
  ascendant: HouseCusp;
  ayanamsa?: number; // degrees, for Vedic
  computedAt: string; // ISO timestamp
}

// ============================================================================
// Divisional Chart Types
// ============================================================================

export interface DivisionalChart extends NatalChart {
  divisionalNumber: number; // 1, 9, 2, 3, ... 60
  divisionalName: string; // e.g. "Navamsa", "Dwadashamsa"
}

// ============================================================================
// Dasha Types
// ============================================================================

export interface DashaPeriod {
  planet: PlanetName;
  startDate: string; // ISO date
  endDate: string; // ISO date
  durationYears: number;
  subPeriods?: DashaPeriod[]; // Antardasha
}

export interface VimshottariDasha {
  mahadasha: DashaPeriod;
  antardasha: DashaPeriod;
  pratyantardasha?: DashaPeriod;
  remainingYears: number;
}

// ============================================================================
// Panchanga Types
// ============================================================================

export interface Panchanga {
  date: string;
  tithi: { name: string; number: number; paksha: "Shukla" | "Krishna"; endTime: string };
  nakshatra: { name: string; number: number; lord: string; endTime: string };
  yoga: { name: string; number: number; endTime: string };
  karana: { name: string; number: number; endTime: string };
  sunrise: string;
  sunset: string;
}

// ============================================================================
// Shadbala Types (Six-fold strength)
// ============================================================================

export interface ShadbalaComponent {
  name: string; // Sthana, Dig, Kala, Chesta, Naisargika, Drig
  value: number; // in rupas
}

export interface PlanetShadbala {
  planet: PlanetName;
  total: number;
  components: ShadbalaComponent[];
  ratio: number; // total / required
}

export type ShadbalaResult = PlanetShadbala[];

// ============================================================================
// Ashtakavarga Types
// ============================================================================

export interface AshtakavargaRow {
  planet: string;
  signs: number[]; // 12 values, one per sign (bindus)
  total: number;
}

export type AshtakavargaResult = {
  individual: AshtakavargaRow[];
  sarvashtakavarga: number[]; // 12 total bindus per sign
};

// ============================================================================
// Transit Types
// ============================================================================

export interface TransitData {
  transitDate: string;
  transitPlanets: PlanetPosition[];
  aspects: TransitAspect[];
}

export interface TransitAspect {
  transitPlanet: string;
  natalPlanet: string;
  aspectType: AspectType;
  orb: number;
  exact: boolean;
}

// ============================================================================
// Western Astrology Types
// ============================================================================

export type AspectType = "conjunction" | "opposition" | "trine" | "square" | "sextile"
  | "quincunx" | "semisextile";

export interface Aspect {
  planet1: string;
  planet2: string;
  type: AspectType;
  orb: number;
  exact: boolean;
}

export interface WesternNatalChart extends NatalChart {
  type: "western";
  aspects: Aspect[];
  houseSystem: HouseSystem;
}

export interface ProgressionData {
  date: string;
  progressedPlanets: PlanetPosition[];
  progressedAscendant: HouseCusp;
  progressedHouses: HouseCusp[];
}

export interface SynastryAspect extends Aspect {
  chart1Planet: string;
  chart2Planet: string;
}

export interface SynastryResult {
  chart1: WesternNatalChart;
  chart2: WesternNatalChart;
  aspects: SynastryAspect[];
  compositeChart?: WesternNatalChart;
}

// ============================================================================
// Chinese BaZi Types
// ============================================================================

export type HeavenlyStem = "Jia" | "Yi" | "Bing" | "Ding" | "Wu" | "Ji" | "Geng" | "Xin" | "Ren" | "Gui";
export type EarthlyBranch = "Zi" | "Chou" | "Yin" | "Mao" | "Chen" | "Si" | "Wu" | "Wei" | "Shen" | "You" | "Xu" | "Hai";
export type WuXing = "Wood" | "Fire" | "Earth" | "Metal" | "Water";

export interface Pillar {
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  stemElement: WuXing;
  branchElement: WuXing;
  hiddenStems?: HeavenlyStem[];
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  dayMaster: HeavenlyStem;
  dayMasterElement: WuXing;
  tenGods?: TenGod[];
  luckPillars?: LuckPillar[];
}

export interface TenGod {
  pillar: "year" | "month" | "day" | "hour";
  stem: HeavenlyStem;
  god: string; // e.g. "Direct Wealth", "Seven Killings"
}

export interface LuckPillar {
  startAge: number;
  endAge: number;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface VedicChartRequest {
  birthDate: string;
  birthTime: string;
  birthPlace: GeoLocation;
  chartType: "rashi" | "navamsa" | "divisional";
  divisionalNumber?: number;
}

export interface WesternChartRequest {
  birthDate: string;
  birthTime: string;
  birthPlace: GeoLocation;
  houseSystem: HouseSystem;
}

export interface ChineseChartRequest {
  birthDate: string;
  birthTime: string;
}

export interface DashaRequest {
  birthDate: string;
  birthTime: string;
  birthPlace: GeoLocation;
}

export interface TransitRequest {
  birthDate: string;
  birthTime: string;
  birthPlace: GeoLocation;
  transitDate: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
