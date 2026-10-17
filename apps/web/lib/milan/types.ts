// ============================================================================
// Guna Milan (Ashtakoot) — shared types
// ----------------------------------------------------------------------------
// Everything here is DATA ONLY (no React, no Next.js, no I/O) so the scoring
// engine stays pure, deterministic and unit-testable.
// ============================================================================

/** Which side of the match a partner sits on (traditional Vara/Vadhoo labels). */
export type MilanRole = "groom" | "bride";

/**
 * The ONLY two astronomical facts Ashtakoot needs from a chart:
 * Moon rashi (0 = Mesha/Aries … 11 = Meena/Pisces) and Janma nakshatra (0 = Ashwini … 26 = Revati).
 */
export interface MoonData {
  /** Moon sign index 0-11 (sidereal / Lahiri). */
  signIndex: number;
  /** Janma nakshatra index 0-26. */
  nakshatraIndex: number;
  /** Nakshatra name as computed by the engine (for display). */
  nakshatraName: string;
  /** Moon sign name as computed by the engine (for display). */
  signName: string;
}

export type KootKey =
  | "varna"
  | "vashya"
  | "tara"
  | "yoni"
  | "grahaMaitri"
  | "gana"
  | "bhakoot"
  | "nadi";

/** One of the eight koots with its earned/max points and display meaning. */
export interface KootScore {
  key: KootKey;
  /** Sanskrit/English label shown in the UI. */
  name: string;
  /** What it measures, in one display-copy line. */
  nameHi: string;
  max: number;
  earned: number;
  /** Display one-liner meaning of THIS koot (static, rule-derived). */
  meaning: string;
  /** Verdict line for the actual pair (deterministic, no AI). */
  verdict: string;
  /** Extra technical detail (indices, distances) — helps verification. */
  detail: string;
}

export type MilanBandKey = "shreshth" | "uttam" | "madhyam" | "chetaavni";

export interface MilanBand {
  key: MilanBandKey;
  /** e.g. "Shreshth" */
  label: string;
  /** Display range caption, e.g. "32-36" */
  range: string;
  /** Verdict headline. */
  headline: string;
  /** Verdict body copy. */
  note: string;
}

/** Mangal (Kuja) Dosha assessment for one partner. */
export interface MangalStatus {
  /** True when Mars occupies 1/2/4/7/8/12 from Lagna or Moon. */
  hasDosha: boolean;
  /** True when the classical cancellation applies (own/exalted/Jupiter-ruled sign). */
  cancelled: boolean;
  /** Houses (from Lagna) where Mars sits — usually 1 value, Rahu-koputra edge cases aside. */
  marsHouseFromLagna: number;
  /** Houses (from Moon) where Mars sits. */
  marsHouseFromMoon: number;
  marsSign: string;
  /** Explanation of the outcome in display copy. */
  note: string;
}

export interface MangalReport {
  groom: MangalStatus;
  bride: MangalStatus;
  /** Both have Kuja dosha → classical "dosha nullifies itself" observation. */
  santhulan: boolean;
  note: string;
}

/** Full deterministic Milan result (safe to serialise into JSON / share links). */
export interface MilanMatch {
  version: "ashtakoot-v1";
  groom: MoonData;
  bride: MoonData;
  koots: KootScore[];
  total: number;
  maxTotal: 36;
  /** 0-100, rounded to 3 dp by the UI. */
  percentage: number;
  band: MilanBand;
  mangal: MangalReport;
  /** Long summary in display copy, assembled from the deterministic verdicts (no AI). */
  summary: string[];
  /** True when both partners' birth data is identical — allowed, but flagged. */
  sameDataFlag: boolean;
  /** Warnings worth surfacing (e.g. Moon near a sign boundary). */
  advisories: string[];
}

/** Compact payload used by the ?m= deep-link (never contains coordinates we cannot re-resolve). */
export interface MilanSharePayload {
  v: 1;
  groom: MilanPersonInput;
  bride: MilanPersonInput;
}

/** One partner as submitted by the form / API. */
export interface MilanPersonInput {
  name: string;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM (24h)
  pob: string; // free-text place
  /** Optional exact place picked from the autocomplete. */
  pobPlace?: {
    label: string;
    lat: number;
    lng: number;
    timezone: string;
    country?: string;
    source?: "gazetteer" | "nominatim";
  };
}
