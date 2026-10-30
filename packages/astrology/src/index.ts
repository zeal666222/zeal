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
  computeNavamsaLongitude,
  computeDivisionalChart,
  computeDivisionalLongitude,
  computeVimshottariDasha,
  computePanchanga,
  computeShadbala,
  computeAshtakavarga,
  computeTransit,
  getNakshatra,
  degreesToSignDeg,
  normalizeBirthTime,
  parseBirthDateTime,
  NAKSHATRAS,
  NAKSHATRA_LORDS,
  karanaNameFor,
  computeKundaliBrief,
  formatKundaliBrief,
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
export {
  getAyanamsa,
  computeLahiriAyanamsa,
  computeRamanAyanamsa,
  computeKrishnamurtiAyanamsa,
  generalPrecessionInLongitude,
  julianCenturiesFromJ2000,
} from "./utils/ayanamsa";
export {
  getAstroTime,
  getVedicPlanetPositions,
  getWesternPlanetPositions,
  getRahuLongitude,
  type PlanetState,
} from "./utils/ephemeris";
export {
  computeHouses,
  getHouseForPlanet,
  computeAscendant,
  computeMC,
  computeLST,
  toJulianDate,
  meanObliquity,
  apparentObliquity,
  nutation,
} from "./utils/houses";
export { computeAllAspects, checkAspect, angularDistance, ASPECT_DEFINITIONS } from "./utils/aspects";
export { timezoneFromLng } from "./utils/timezone";
export {
  GAZETTEER,
  lookupGazetteerPlace,
  suggestGazetteerPlaces,
  normalizePlace,
  type GazetteerEntry,
  type GazetteerPlace,
  type GazetteerSuggestion,
} from "./utils/gazetteer";
export type { KundaliBrief, BriefPlanet, BriefVerification } from "./vedic/brief";
