// ============================================================================
// @zeal/astrology - Main Entry Point
// ============================================================================
// Barrel exports for the entire astrology calculation engine.
// ============================================================================

// Types
export type {
  GeoLocation,
  BirthData,
  ZodiacSign,
  PlanetName,
  WesternPlanet,
  HouseSystem,
  PlanetPosition,
  HouseCusp,
  NatalChart,
  DivisionalChart,
  DashaPeriod,
  VimshottariDasha,
  Panchanga,
  ShadbalaResult,
  PlanetShadbala,
  ShadbalaComponent,
  AshtakavargaResult,
  AshtakavargaRow,
  TransitData,
  TransitAspect,
  AspectType,
  Aspect,
  WesternNatalChart,
  ProgressionData,
  SynastryResult,
  SynastryAspect,
  HeavenlyStem,
  EarthlyBranch,
  WuXing,
  Pillar,
  FourPillars,
  TenGod,
  LuckPillar,
  VedicChartRequest,
  WesternChartRequest,
  ChineseChartRequest,
  DashaRequest,
  TransitRequest,
  ApiResponse,
} from "./types";

export { ZODIAC_SIGNS, RASHI_NAMES, VEDIC_PLANETS, WESTERN_PLANETS } from "./types";

// Vedic
export {
  computeRashiChart,
  computeNavamsaChart,
  computeDivisionalChart,
  computeVimshottariDasha,
  computePanchanga,
  computeShadbala,
  computeAshtakavarga,
  computeTransit,
  getNakshatra,
  degreesToSignDeg,
  normalizeBirthTime,
  NAKSHATRAS,
  DIVISIONAL_CHARTS,
} from "./vedic/index";

// Western
export {
  computeWesternNatalChart,
  computeWesternTransit,
  computeProgressions,
  computeSynastry,
} from "./western/index";

// Chinese
export { computeFourPillars } from "./chinese/index";

// Utils
export { getAyanamsa, computeLahiriAyanamsa } from "./utils/ayanamsa";
export {
  getAstroTime,
  getVedicPlanetPositions,
  getWesternPlanetPositions,
  getRahuLongitude,
  type PlanetState,
} from "./utils/ephemeris";
export { computeHouses, getHouseForPlanet, computeAscendant, computeMC, computeLST } from "./utils/houses";
export { computeAllAspects, checkAspect, angularDistance, ASPECT_DEFINITIONS } from "./utils/aspects";
