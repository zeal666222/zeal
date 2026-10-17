// ============================================================================
// Guna Milan — deterministic Ashtakoot (36-point) compatibility engine
// ----------------------------------------------------------------------------
// PHILOSOPHY (identical to the kundali engine): astronomy comes from the proven
// @zeal/astrology stack, compatibility comes from THIS pure rule table. Nothing
// here reads the clock, the network, or an AI provider — the same two charts
// always produce the same 36-point breakdown, so results are verifiable and
// unit-testable (computeAshtakoot takes plain integers, no I/O).
//
// INPUT per partner: (a) Moon rashi index 0-11 (0 = Mesha/Aries … 11 = Meena/
// Pisces, sidereal Lahiri) and (b) Janma nakshatra index 0-26 (0 = Ashwini).
// Kuja/Mangal dosha additionally needs Mars' sign + house from Lagna.
//
// ─── CLASSICAL RULE SOURCES, KOOT BY KOOT ────────────────────────────────────
// 1. VARNA (1) — Brihat Samhita ch.74 / Kalidasa Ashtakoota. Varna follows the
//    rashi cycle Kshatriya → Vaishya → Shudra → Brahmin (fire / earth / air /
//    water groups: Mesha=Kshatriya, Vrishabha=Vaishya, Mithuna=Shudra,
//    Karka=Brahmin, repeating). Rule: groom's varna >= bride's varna → 1, else 0.
// 2. VASHYA (2) — Phaladeepika ch.3 / Jataka Parijata. Rashi → vashya group by
//    element: fire = Vanachara (wild), earth = Chatushpada (four-footed),
//    air = Manava (human), water = Jalachara (aquatic). Same group = 2,
//    amenable cross-group = 1, incompatible (wild↔aquatic, human↔aquatic) = 0
//    per the popular milan matrix.
// 3. TARA (3) — Brihat Samhita ch.78 (Navatara). Count the bride's nakshatra
//    from the groom's (groom = 1) and reduce mod 9 (remainder 0 = 9). Inauspicious
//    tara: 3 Vipat, 5 Pratyari, 7 Naidhana → 0 points. 1 Janma, 2 Sampat,
//    4 Kshema, 6 Sadhaka, 8 Mitta, 9 Parama-Mitta → 3 points. Both born in the
//    SAME nakshatra count as 1 (Janma-tara of the same source) → treated as
//    allowed/auspicious here, as standard almanac milan practice.
// 4. YONI (4) — Brihat Samhita ch.70 / Phaladeepika ch.3. Each nakshatra carries
//    one of 14 yonis (animals); the animal tables differ marginally between
//    lineages, so the stable, uncontested core we score on is the yoni SEAT,
//    i.e. the rashi relationship: same nakshatra (same yoni) = 4, friendly
//    tatva (element) pair = 3, neutral = 2, hostile tatva pair (fire↔water,
//    earth↔air) = 0. Animal names are surfaced in the UI for context.
// 5. GRAHA MAITRI (5) — BPHS ch.87 / Phaladeepika ch.8 (naisargika maitri of the
//    Moon-sign lords): same lord or same rashi = 5, friends = 4, neutral = 3,
//    permanent enmity = 0.
// 6. GANA (6) — Kalidasa Ashtakoota / Phaladeepika ch.3. Nakshatra gana
//    Deva/Manushya/Rakshasa (the 9-Rakshasa set — Krittika, Ashlesha, Magha,
//    Chitra, Vishakha, Jyeshtha, Mula, Dhanishta, Shatabhisha — is uncontested
//    and matches packages/astrology/knowledge nakshatra corpus). Pair table:
//    Deva-Deva 6, Deva-Manushya 5, Deva-Rakshasa 1, Manushya-Deva 5,
//    Manushya-Manushya 6, Manushya-Rakshasa 0, Rakshasa-Deva 0,
//    Rakshasa-Manushya 0, Rakshasa-Rakshasa 6.
// 7. BHAKOOT (7) — Brihat Samhita ch.76 / Phaladeepika ch.3 "bhanga" doshas.
//    Rashi axes: 6-8 (shadashtaka), 2-12 (dwidwashaka), 7-7 (sapta) → 0;
//    5-9 (navama bhanga) → 4 (partial); all other axes → 7.
// 8. NADI (8) — Saravali / Ashtakoota prakriya. Nakshatras cycle Aadi (vata) /
//    Madhya (pitta) / Anthya (kapha) = index mod 3. Different nadi = 8, same
//    nadi = 0; when the shared nadi is Anthya we attach the classical
//    "Antyashaja adhyaya" caution (Saravali treats identical Anthya nadi as a
//    health/progeny obstacle needing a jyotishi's upaaya).
//
// MANGAL (KUJA) DOSHA — Phaladeepika ch.5 / BPHS: Mars in the 1st, 2nd, 4th,
// 7th, 8th or 12th from Lagna OR from Moon creates Kuja dosha. Simplified but
// documented cancellation (as stated to the user): Mars in its own signs
// (Mesha, Vrishchika), exalted (Makara) or in Jupiter-ruled signs (Dhanu, Meena)
// cancels it; when BOTH partners carry an uncancelled Kuja dosha the classical
// "kuaja-kuaja" balance (dosha neutralises itself) is noted. Mars being
// conjunct/aspected by Jupiter or Moon is NOT evaluated here — a human jyotishi
// can overrule; the UI says so explicitly.
// ============================================================================

import type { KundaliResult, PlanetInHouse } from "@/lib/kundali/engine";
import type {
  KootScore,
  MangalReport,
  MangalStatus,
  MilanBand,
  MilanBandKey,
  MilanMatch,
  MoonData,
} from "./types";

// ─── Errors ────────────────────────────────────────────────────────────────────

export class MilanRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MilanRuleError";
  }
}

/** Always-non-negative modulo (JS % is signed). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// ─── Rashi table (index 0-11 = Aries … Pisces, sidereal/Lahiri) ────────────────

type PlanetLord = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";

interface RashiRef {
  en: string;
  sa: string;
  lord: PlanetLord;
}

export const RASHI: readonly RashiRef[] = [
  { en: "Aries", sa: "Mesha", lord: "Mars" },
  { en: "Taurus", sa: "Vrishabha", lord: "Venus" },
  { en: "Gemini", sa: "Mithuna", lord: "Mercury" },
  { en: "Cancer", sa: "Karka", lord: "Moon" },
  { en: "Leo", sa: "Simha", lord: "Sun" },
  { en: "Virgo", sa: "Kanya", lord: "Mercury" },
  { en: "Libra", sa: "Tula", lord: "Venus" },
  { en: "Scorpio", sa: "Vrishchika", lord: "Mars" },
  { en: "Sagittarius", sa: "Dhanu", lord: "Jupiter" },
  { en: "Capricorn", sa: "Makara", lord: "Saturn" },
  { en: "Aquarius", sa: "Kumbha", lord: "Saturn" },
  { en: "Pisces", sa: "Meena", lord: "Jupiter" },
];

const SIGN_INDEX: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  RASHI.forEach((r, i) => {
    map[r.en.toLowerCase()] = i;
    map[r.sa.toLowerCase()] = i;
  });
  return map;
})();

// ─── Nakshatra tables (index 0-26) ─────────────────────────────────────────────

export const NAKSHATRA_NAMES: readonly string[] = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
  "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

/** Gana per nakshatra — mirrors packages/astrology/knowledge (nakshatras.ts `nature`). */
export const NAKSHATRA_GANA: readonly ("deva" | "manushya" | "rakshasa")[] = [
  "deva", "manushya", "rakshasa", "manushya", "manushya", "manushya",
  "deva", "deva", "rakshasa", "rakshasa", "manushya", "manushya",
  "deva", "rakshasa", "deva", "rakshasa", "deva", "rakshasa", "rakshasa",
  "manushya", "manushya", "deva", "rakshasa", "rakshasa", "manushya",
  "manushya", "deva",
];

/** Yoni (animal) per nakshatra — displayed for context; scoring uses the yoni seat (see header). */
export const NAKSHATRA_YONI: readonly string[] = [
  "Ashva (horse)", "Gaja (elephant)", "Mesha (sheep)", "Sarpa (serpent)",
  "Sarpa (serpent)", "Shvana (dog)", "Marjara (cat)", "Shvana (dog)",
  "Marjara (cat)", "Chhaga (goat)", "Kapi (monkey)", "Vrishabha (bull)",
  "Mahisha (buffalo)", "Vyaghra (tiger)", "Mahisha (buffalo)", "Vyaghra (tiger)",
  "Mushaka (rat)", "Mriga (deer)", "Shvana (dog)", "Kapi (monkey)",
  "Nakula (mongoose)", "Kapi (monkey)", "Simha (lion)", "Vyaghra (tiger)",
  "Simha (lion)", "Gaja (elephant)", "Mriga (deer)",
];

const NADI_NAMES: readonly ("Aadi" | "Madhya" | "Anthya")[] = ["Aadi", "Madhya", "Anthya"];

// ─── 1. VARNA (max 1) ──────────────────────────────────────────────────────────

type Varna = "Brahmin" | "Kshatriya" | "Vaishya" | "Shudra";

/** Element cycle: fire=Kshatriya, earth=Vaishya, air=Shudra, water=Brahmin. */
const VARNA_CYCLE: readonly Varna[] = ["Kshatriya", "Vaishya", "Shudra", "Brahmin"];
const VARNA_RANK: Record<Varna, number> = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 };

export function varnaOf(signIndex: number): Varna {
  return VARNA_CYCLE[mod(signIndex, 4)] ?? "Shudra";
}

function scoreVarna(gS: number, bS: number): { earned: number; why: string; detail: string } {
  const g = varnaOf(gS);
  const b = varnaOf(bS);
  const earned = VARNA_RANK[g] >= VARNA_RANK[b] ? 1 : 0;
  const why =
    earned === 1
      ? `Varna match: groom ${g}, bride ${b} — the varna order is right (1/1). A balanced share of respect holds.`
      : `Varna order reversed: groom ${g}, bride ${b} (${b} ranks higher) — 0/1. A small point, but it touches family standing and respect; smooth it over with open conversation.`;
  return { earned, why, detail: `varna: vara ${RASHI[mod(gS, 12)]!.sa}=${g} (rank ${VARNA_RANK[g]}) · vadhoo ${RASHI[mod(bS, 12)]!.sa}=${b} (rank ${VARNA_RANK[b]})` };
}

// ─── 2. VASHYA (max 2) ─────────────────────────────────────────────────────────

type Vashya = "vanachara" | "chatushpada" | "manava" | "jalachara";

/** Element cycle: fire → wild, earth → four-footed, air → human, water → aquatic. */
const VASHYA_BY_ELEMENT: readonly Vashya[] = ["vanachara", "chatushpada", "manava", "jalachara"];

export function vashyaOf(signIndex: number): Vashya {
  return VASHYA_BY_ELEMENT[mod(signIndex, 4)] ?? "manava";
}

const VASHYA_LABEL: Record<Vashya, string> = {
  vanachara: "Vanachara (wild)",
  chatushpada: "Chatushpada (four-footed)",
  manava: "Manava (human)",
  jalachara: "Jalachara (aquatic)",
};

/** Symmetric cross-group points: same 2 · amenable 1 · incompatible 0. */
function vashyaPoints(a: Vashya, b: Vashya): number {
  if (a === b) return 2;
  const pair = [a, b].sort().join("|");
  if (pair === "jalachara|vanachara" || pair === "jalachara|manava") return 0;
  return 1;
}

function scoreVashya(gS: number, bS: number): { earned: number; why: string; detail: string } {
  const g = vashyaOf(gS);
  const b = vashyaOf(bS);
  const earned = vashyaPoints(g, b);
  const why =
    earned === 2
      ? `Both share the same vashya — ${VASHYA_LABEL[g]} — a natural harmony of will and energy (2/2).`
      : earned === 1
        ? `Different vashya: ${VASHYA_LABEL[g]} vs ${VASHYA_LABEL[b]} — 1/2. There is attraction, but you'll need conversation to decide 'who leads'.`
        : `Vashya conflict: ${VASHYA_LABEL[g]} vs ${VASHYA_LABEL[b]} — 0/2. Power and courting styles pull in opposite directions; a conscious compromise will be needed here.`;
  return { earned, why, detail: `vashya: ${RASHI[mod(gS, 12)]!.sa}=${g} · ${RASHI[mod(bS, 12)]!.sa}=${b}` };
}

// ─── 3. TARA (max 3) ───────────────────────────────────────────────────────────

const TARA_INAUSPICIOUS = new Set([3, 5, 7]); // Vipat · Pratyari · Naidhana

const TARA_NAMES: Record<number, string> = {
  1: "Janma", 2: "Sampat", 3: "Vipat", 4: "Kshema", 5: "Pratyari",
  6: "Sadhaka", 7: "Naidhana", 8: "Mitta", 9: "Parama-Mitta",
};

/** Bride's nakshatra counted from the groom's (groom = 1), reduced mod 9 (0 → 9). */
export function taraRemainder(groomNak: number, brideNak: number): number {
  const count = mod(brideNak - groomNak, 27) + 1;
  return mod(count, 9) || 9;
}

function scoreTara(gN: number, bN: number): { earned: number; why: string; detail: string } {
  const rem = taraRemainder(gN, bN);
  const bad = TARA_INAUSPICIOUS.has(rem);
  const earned = bad ? 0 : 3;
  const same = gN === bN ? " Same nakshatra (same source) — no Tara dosha; it counts as Janma-tara." : "";
  const why = bad
    ? `Tara ${rem} (${TARA_NAMES[rem]}) — inauspicious tara count: 0/3. This mismatch in health/pull can create friction.${same}`
    : `Tara ${rem} (${TARA_NAMES[rem]}) — auspicious tara: 3/3. Supportive alignment for fortune, health and progress.${same}`;
  return { earned, why, detail: `tara gan ${rem} (mod 9) · nakshatra ${gN + 1} → ${bN + 1}` };
}

// ─── 4. YONI (max 4) ───────────────────────────────────────────────────────────

type Element = "fire" | "earth" | "air" | "water";

/** element index → element name (kept in sync with the VARNA/VASHYA cycles). */
const VARNA_ELEMENT: readonly Element[] = ["fire", "earth", "air", "water"];

const ELEMENT_LABEL: Record<Element, string> = { fire: "Agni", earth: "Prithvi", air: "Vayu", water: "Jala" };

function elementOf(signIndex: number): Element {
  return VARNA_ELEMENT[mod(signIndex, 4)] ?? "earth";
}

/** Classic tatva friendship: same-element + fire↔air + earth↔water are friendly; fire↔water + earth↔air hostile. */
function yoniPointsFromSeat(gS: number, bS: number): 3 | 2 | 0 {
  const a = elementOf(gS);
  const b = elementOf(bS);
  if (a === b) return 3;
  const pair = [a, b].sort().join("-");
  if (pair === "air-fire" || pair === "earth-water") return 3;
  if (pair === "fire-water" || pair === "air-earth") return 0;
  return 2;
}

function scoreYoni(groom: MoonData, bride: MoonData): { earned: number; why: string; detail: string } {
  const gy = NAKSHATRA_YONI[mod(groom.nakshatraIndex, 27)] ?? "—";
  const by = NAKSHATRA_YONI[mod(bride.nakshatraIndex, 27)] ?? "—";
  const sameYoni = groom.nakshatraIndex === bride.nakshatraIndex;
  const seatPoints = yoniPointsFromSeat(groom.signIndex, bride.signIndex);
  const earned = sameYoni ? 4 : seatPoints;
  const a = ELEMENT_LABEL[elementOf(groom.signIndex)];
  const b = ELEMENT_LABEL[elementOf(bride.signIndex)];
  const why = sameYoni
    ? `Yoni match: ${gy} × ${by} — same nakshatra, same yoni (4/4). Complete harmony of physical rhythm.`
    : earned === 3
      ? `Yoni match: ${gy} × ${by} — the yoni seats ${a}/${b} tatva are friendly (3/4). Good physical/energy compatibility.`
      : earned === 2
        ? `Yoni match: ${gy} × ${by} — ${a}/${b} neutral (2/4). Workable, but your rhythms may differ.`
        : `Yoni match: ${gy} × ${by} — ${a} vs ${b}: opposing-tatva yoni (0/4). The classical texts call such pairs the main tension on the physical/intimate side — ask a Jyotishi about upaaya.`;
  return { earned, why, detail: `yoni ${gy} × ${by} · tatva ${a}/${b}` };
}

// ─── 5. GRAHA MAITRI (max 5) ───────────────────────────────────────────────────

/** Naisargika (permanent) friendship pairs of the 7 lords — BPHS ch.87 / Phaladeepika ch.8. */
const FRIEND_PAIRS = new Set([
  "Moon-Sun", "Mars-Sun", "Jupiter-Sun",
  "Mercury-Moon", "Jupiter-Moon",
  "Jupiter-Mars",
  "Mercury-Venus",
  "Saturn-Venus",
]);

/** Permanent enmity pairs (same sources). */
const ENEMY_PAIRS = new Set([
  "Sun-Venus", "Saturn-Sun",
  "Moon-Saturn",
  "Mars-Mercury", "Mars-Saturn",
  "Jupiter-Mercury", "Jupiter-Venus",
]);

export function maitriOfLords(a: PlanetLord, b: PlanetLord): "same" | "friend" | "neutral" | "enemy" {
  if (a === b) return "same";
  const key = [a, b].sort().join("-");
  if (FRIEND_PAIRS.has(key)) return "friend";
  if (ENEMY_PAIRS.has(key)) return "enemy";
  return "neutral";
}

function scoreGrahaMaitri(gS: number, bS: number): { earned: number; why: string; detail: string } {
  const gLord = RASHI[mod(gS, 12)]!.lord;
  const bLord = RASHI[mod(bS, 12)]!.lord;
  const rel = maitriOfLords(gLord, bLord);
  const sameSign = gS === bS;
  let earned: number;
  if (sameSign || rel === "same") earned = 5;
  else if (rel === "friend") earned = 4;
  else if (rel === "neutral") earned = 3;
  else earned = 0;
  const why =
    earned >= 4
      ? `The Moon's lords ${gLord} and ${bLord} ${rel === "same" ? "are one and the same" : "are permanent friends"} — harmony of mind is the greatest wealth (4-5/5).`
      : earned === 3
        ? `${gLord} × ${bLord} neutral friendship (3/5) — the heart's rapport is okay; small compromises will be needed on everyday needs.`
        : `${gLord} × ${bLord} carry innate enmity (0/5). This is the widest gap in Graha Maitri — an explicit understanding at the level of thinking and behaviour is essential.`;
  return { earned, why, detail: `lords ${gLord} × ${bLord} — ${rel}` };
}

// ─── 6. GANA (max 6) ───────────────────────────────────────────────────────────

type Gana = "deva" | "manushya" | "rakshasa";

/** rows = groom, cols = bride (Kalidasa/Phaladeepika milan table). */
const GANA_TABLE: Record<Gana, Record<Gana, number>> = {
  deva: { deva: 6, manushya: 5, rakshasa: 1 },
  manushya: { deva: 5, manushya: 6, rakshasa: 0 },
  rakshasa: { deva: 0, manushya: 0, rakshasa: 6 },
};

const GANA_LABEL: Record<Gana, string> = { deva: "Deva", manushya: "Manushya", rakshasa: "Rakshasa" };

export function ganaOf(nakshatraIndex: number): Gana {
  return NAKSHATRA_GANA[mod(nakshatraIndex, 27)] ?? "manushya";
}

function scoreGana(gN: number, bN: number): { earned: number; why: string; detail: string } {
  const g = ganaOf(gN);
  const b = ganaOf(bN);
  const earned = GANA_TABLE[g][b]!;
  const why =
    earned === 6
      ? `Gana match: groom ${GANA_LABEL[g]} × bride ${GANA_LABEL[b]} (6/6) — temperament, values and family style align directly.`
      : earned === 5
        ? `Gana match: ${GANA_LABEL[g]} × ${GANA_LABEL[b]} (5/6) — nearly the same temperamental colour; only a little adaptation is missing.`
        : earned === 1
          ? `Gana match: ${GANA_LABEL[g]} × ${GANA_LABEL[b]} (1/6) — divine-raised vs fierce-natured; it will only work with patience and respect.`
          : `Gana conflict: ${GANA_LABEL[g]} × ${GANA_LABEL[b]} (0/6) — deep temperament differences. This side is not changeable; a Jyotishi's read of the match is essential.`;
  return { earned, why, detail: `gana ${GANA_LABEL[g]} × ${GANA_LABEL[b]}` };
}

// ─── 7. BHAKOOT (max 7) ────────────────────────────────────────────────────────

/** Unordered rashi axis 1..12 (7 = opposition, 8 = the 6/8 pair, 12 = the 2/12 pair, 1 = same sign). */
export function rashiAxis(a: number, b: number): number {
  const d = mod(b - a, 12) + 1;
  const r = mod(a - b, 12) + 1;
  return Math.max(d, r);
}

function scoreBhakoot(gS: number, bS: number): { earned: number; why: string; detail: string; axis: number } {
  const axis = rashiAxis(gS, bS);
  const earned = axis === 8 || axis === 12 || axis === 7 ? 0 : axis === 9 ? 4 : 7;
  const why =
    earned === 0
      ? `Bhakoot 0/7 — the rashi sit in the ${axis === 8 ? "6-8 (shadashtaka bhanga)" : axis === 12 ? "2-12 (dwidwashaka bhanga)" : "7-7 (sapata bhanga)"} axis. A tough angle for wealth, prosperity and day-to-day comfort; it can be cushioned with separate financial planning.`
      : earned === 4
        ? `Bhakoot 4/7 — rashi 5-9 axis (navama bhanga): not a full dosha, but some pull (especially in fortune-linked work).`
        : `Bhakoot 7/7 — no bhanga yog (rashi axis ${axis}). The alignment of fortune, money and children prospects is auspicious.`;
  return { earned, why, axis, detail: `rashi axis ${axis} (1 = same · 7 = opposition · 8 = 6/8 · 12 = 2/12)` };
}

// ─── 8. NADI (max 8) ───────────────────────────────────────────────────────────

export function nadiOf(nakshatraIndex: number): "Aadi" | "Madhya" | "Anthya" {
  return NADI_NAMES[mod(nakshatraIndex, 3)] ?? "Aadi";
}

const NADI_TATVA: Record<"Aadi" | "Madhya" | "Anthya", string> = {
  Aadi: "Vata (air)",
  Madhya: "Pitta (bile)",
  Anthya: "Kapha (phlegm)",
};

function scoreNadi(gN: number, bN: number): { earned: number; why: string; detail: string; antya: boolean } {
  const g = nadiOf(gN);
  const b = nadiOf(bN);
  const same = g === b;
  const antya = same && g === "Anthya";
  const why = same
    ? antya
      ? `Same Nadi (${g} / ${NADI_TATVA[g]}) — 0/8, and it is the Anthya nadi. The Saravali/Ashtakoota tradition calls this "Antyashaja-adhyaya": an identical nadi is taken as the classical concern for physical blending and the children sphere, and it carries an instruction for upaaya (a Jyotishi-directed vrushchikabhishek/upaaya). Don't read this as just a number — confirm it practically with an experienced Jyotishi.`
      : `Same Nadi (${g} / ${NADI_TATVA[g]}) — 0/8. The physical constitutions match too closely, so the classical count gives zero; it is not as severe as the Anthya case, but extra care around health/children is advised.`
    : `Different Nadi (${g} × ${b}) — 8/8. The physical humours and tatva complement each other: health and children prospects are auspicious.`;
  return { earned: same ? 0 : 8, why, antya, detail: `nadi ${g} (${NADI_TATVA[g]}) × ${b} (${NADI_TATVA[b]})` };
}

// ─── Bands ─────────────────────────────────────────────────────────────────────

const BANDS: Record<MilanBandKey, MilanBand> = {
  shreshth: {
    key: "shreshth",
    label: "Shreshth",
    range: "32-36",
    headline: "Shreshth (excellent) Milan — the pair looks strong and harmonious",
    note: "Ashtakoot 32+ — most koots are supporting you. Muhurat and married life after the wedding should also go well. Do confirm the mangal/nadi binding details once with a Jyotishi.",
  },
  uttam: {
    key: "uttam",
    label: "Uttam",
    range: "26-31",
    headline: "Uttam (good) Milan — a solid base, with a few areas to watch",
    note: "26-31: the match is good, but some koots score low. Talk about the weaker koots listed below now and small friction later can be avoided.",
  },
  madhyam: {
    key: "madhyam",
    label: "Madhyam",
    range: "18-25",
    headline: "Madhyam (moderate) Milan — move ahead with thought and counsel",
    note: "18-25: several key angles (like Gana/Bhakoot/Nadi) score low. The relationship can work, but do examine the point-by-point match with the families and a Jyotishi.",
  },
  chetaavni: {
    key: "chetaavni",
    label: "Chetaavni — take expert counsel",
    range: "0-17",
    headline: "Chetaavni (caution) — low score, deep thinking needed",
    note: "Below 18: several Ashtakoot koots work against each other. Don't decide on this number alone — do take counsel from an experienced Jyotishi.",
  },
};

export function bandFor(total: number): MilanBand {
  if (total >= 32) return BANDS.shreshth!;
  if (total >= 26) return BANDS.uttam!;
  if (total >= 18) return BANDS.madhyam!;
  return BANDS.chetaavni!;
}

// ─── Mangal (Kuja) dosha ───────────────────────────────────────────────────────

const MANGAL_HOUSES = new Set([1, 2, 4, 7, 8, 12]);

/**
 * Simplified cancellation set (documented to the user):
 *  0 Mesha (own) · 7 Vrishchika (own) · 9 Makara (exalted)
 *  8 Dhanu · 11 Meena (Jupiter-ruled, "Guru ki rashi mein Kuja shant")
 */
const MANGAL_CANCEL_SIGNS = new Set([0, 7, 8, 9, 11]);

export interface MangalInput {
  marsSignIndex: number;
  marsSign: string;
  marsHouseFromLagna: number;
  moonSignIndex: number;
}

export function assessMangal(input: MangalInput): MangalStatus {
  const marsSignIndex = mod(input.marsSignIndex, 12);
  const fromMoon = mod(marsSignIndex - mod(input.moonSignIndex, 12), 12) + 1;
  const fromLagna = input.marsHouseFromLagna;
  const inLagna = MANGAL_HOUSES.has(fromLagna);
  const inMoon = MANGAL_HOUSES.has(fromMoon);
  const hasDosha = inLagna || inMoon;
  const cancelled = hasDosha && MANGAL_CANCEL_SIGNS.has(marsSignIndex);
  const where = [
    inLagna ? `from Lagna in the ${fromLagna}th Bhava` : null,
    inMoon ? `from Chandra in the ${fromMoon}th Bhava` : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const note = !hasDosha
    ? `No Mangal Dosha — Mars sits in the ${fromLagna}th Bhava from Lagna and the ${fromMoon}th from Chandra (both outside 1/2/4/7/8/12).`
    : cancelled
      ? `Mangal Dosha would form ${where}, but Mars sits in its own/exalted/Jupiter-ruled sign (${input.marsSign}) — the classical nivrutti (cancellation) yog applies, so it is treated as dosha-free.`
      : `Mangal (Kuja) Dosha is present — Mars ${where}, sign ${input.marsSign}. Effect: friction in energy/temperament and emotional intensity; look at upaaya and the balance between both kundalis.`;
  return {
    hasDosha,
    cancelled,
    marsHouseFromLagna: fromLagna,
    marsHouseFromMoon: fromMoon,
    marsSign: input.marsSign,
    note,
  };
}

function mangalReport(groom: MangalStatus, bride: MangalStatus): MangalReport {
  const groomActive = groom.hasDosha && !groom.cancelled;
  const brideActive = bride.hasDosha && !bride.cancelled;
  const santhulan = groomActive && brideActive;
  const bothCancelled =
    groom.hasDosha && groom.cancelled && bride.hasDosha && bride.cancelled;
  const note = santhulan
    ? "Both kundalis carry Kuja Dosha — in the traditional 'Kuja-Kuja marriage' the dosha balances itself (santhulan); many Jyotishis treat it as dosha-free. Still, confirm Muhurat and upaaya once with a Jyotishi."
    : groomActive || brideActive
      ? `Only the ${groomActive ? "groom" : "bride"} side has an active Kuja Dosha — classic counsel: (a) re-check the cancellation shown above, (b) dosha-shanti remedies (Kuja Dosha nivrutti puja, Muhurat considerations), (c) show both kundalis to a Jyotishi for the final call.`
      : bothCancelled
        ? "Both sides would form Kuja Dosha, but on both Mars sits in its own/exalted/Jupiter-ruled sign — the nivrutti yog keeps the dosha quiet, so the traditional worry is limited. Still have a Jyotishi confirm the final Muhurat."
        : "Neither side carries an active Kuja Dosha — a relief for the marriage.";
  return { groom, bride, santhulan, note };
}

// ─── Kundali → MoonData / Mars adapters (still pure, no I/O) ───────────────────

function signIndexOf(sign: string): number {
  const i = SIGN_INDEX[(sign ?? "").toLowerCase().trim()];
  return typeof i === "number" ? i : -1;
}

function nakshatraIndexOf(name: string, signIndex: number, degreeInSign: number): number {
  const needle = (name ?? "").toLowerCase().trim();
  const direct = NAKSHATRA_NAMES.findIndex((n) => n.toLowerCase() === needle);
  if (direct >= 0) return direct;
  // Deterministic fallback from the sidereal longitude the engine already computed.
  if (signIndex >= 0 && Number.isFinite(degreeInSign)) {
    const abs = mod(signIndex * 30 + degreeInSign, 360);
    return Math.min(26, Math.max(0, Math.floor(abs / 13.333333333333334)));
  }
  return -1;
}

function findPlanet(k: KundaliResult, name: string): PlanetInHouse | undefined {
  return k.chart.planets.find((p) => p.planet === name);
}

export interface PartnerAstroData extends MoonData {
  mars: PlanetInHouse;
  ascendantSignIndex: number;
}

/** Pull the only facts Ashtakoot needs out of a computed kundali. Throws on missing data. */
export function partnerDataFromKundali(k: KundaliResult): PartnerAstroData {
  const moon = findPlanet(k, "Moon");
  const signIndex = signIndexOf(k.chart.moonSign);
  if (signIndex < 0 || !moon) {
    throw new MilanRuleError("Could not read the Moon's position from the kundali — please correct the birth data.");
  }
  const nakshatraIndex = nakshatraIndexOf(k.chart.moonNakshatra, signIndex, moon.degree);
  if (nakshatraIndex < 0) {
    throw new MilanRuleError(`Nakshatra "${k.chart.moonNakshatra}" was not found in our classical table.`);
  }
  const mars = findPlanet(k, "Mars");
  if (!mars) throw new MilanRuleError("Could not read Mangal (Mars)' position — the Kuja Dosha check could not run.");
  const ascendantSignIndex = signIndexOf(k.chart.ascendantSign);
  return {
    signIndex,
    nakshatraIndex,
    nakshatraName: k.chart.moonNakshatra,
    signName: k.chart.moonSign,
    mars,
    ascendantSignIndex,
  };
}

// ─── Core Ashtakoot ────────────────────────────────────────────────────────────

const KOOT_META: ReadonlyArray<{ key: KootScore["key"]; name: string; nameHi: string; max: number; meaning: string }> = [
  { key: "varna", name: "Varna", nameHi: "Varna — behavioural standing", max: 1, meaning: "The traditionally-rated level of each partner's qualities/behaviour; a small point, a signal of parity." },
  { key: "vashya", name: "Vashya", nameHi: "Vashya — attraction and control", max: 2, meaning: "Who holds sway over whom — the balance of mental attraction and respect." },
  { key: "tara", name: "Tara", nameHi: "Tara — the 9-fold nakshatra match", max: 3, meaning: "Auspiciousness computed from the Janma nakshatra: health, growth, conjugal happiness." },
  { key: "yoni", name: "Yoni", nameHi: "Yoni — physical/innate match", max: 4, meaning: "The yoni (animal) seated in the nakshatra: harmony of physical rhythm and energy." },
  { key: "grahaMaitri", name: "Graha Maitri", nameHi: "Graha Maitri — harmony of minds", max: 5, meaning: "The natural friendship of the Moon-sign lords — how you think and behave together." },
  { key: "gana", name: "Gana", nameHi: "Gana — native temperament", max: 6, meaning: "Deva/Manushya/Rakshasa gana: temperament and the style of your values." },
  { key: "bhakoot", name: "Bhakoot", nameHi: "Bhakoot — fortune and wealth", max: 7, meaning: "The bhanga doshas of the rashi pair: money, prosperity, daily comfort and children." },
  { key: "nadi", name: "Nadi", nameHi: "Nadi — physical constitution", max: 8, meaning: "The heaviest koot (vata/pitta/kapha): the match of health and progeny." },
];

export interface AshtakootResult {
  koots: KootScore[];
  total: number;
  maxTotal: 36;
  percentage: number;
  band: MilanBand;
  nadiAntya: boolean;
}

function assertMoonData(label: string, m: MoonData): void {
  if (!Number.isInteger(m.signIndex) || m.signIndex < 0 || m.signIndex > 11) {
    throw new MilanRuleError(`${label}: invalid Moon-rashi index (must be 0-11).`);
  }
  if (!Number.isInteger(m.nakshatraIndex) || m.nakshatraIndex < 0 || m.nakshatraIndex > 26) {
    throw new MilanRuleError(`${label}: invalid nakshatra index (must be 0-26).`);
  }
}

/**
 * Pure Ashtakoot scoring. Deterministic: same (groom, bride) MoonData in →
 * byte-identical 36-point breakdown out. This is the unit-test surface.
 */
export function computeAshtakoot(groom: MoonData, bride: MoonData): AshtakootResult {
  assertMoonData("vara", groom);
  assertMoonData("vadhoo", bride);
  const gS = groom.signIndex;
  const bS = bride.signIndex;
  const gN = groom.nakshatraIndex;
  const bN = bride.nakshatraIndex;

  const varna = scoreVarna(gS, bS);
  const vashya = scoreVashya(gS, bS);
  const tara = scoreTara(gN, bN);
  const yoni = scoreYoni(groom, bride);
  const maitri = scoreGrahaMaitri(gS, bS);
  const gana = scoreGana(gN, bN);
  const bhakoot = scoreBhakoot(gS, bS);
  const nadi = scoreNadi(gN, bN);

  const scored = [varna, vashya, tara, yoni, maitri, gana, bhakoot, nadi];

  const koots: KootScore[] = KOOT_META.map((meta, i) => {
    const s = scored[i]!;
    const detail = "detail" in s && typeof (s as { detail?: unknown }).detail === "string"
      ? (s as { detail: string }).detail
      : "";
    return {
      key: meta.key,
      name: meta.name,
      nameHi: meta.nameHi,
      max: meta.max,
      earned: s.earned,
      meaning: meta.meaning,
      verdict: s.why,
      detail,
    };
  });

  const total = koots.reduce((sum, k) => sum + k.earned, 0);
  const maxTotal = koots.reduce((sum, k) => sum + k.max, 0);
  // Guard: the classical table must always sum to 36 or our tables are broken.
  if (maxTotal !== 36) throw new MilanRuleError("Koot max total is not 36 — the rule table is broken.");

  return {
    koots,
    total,
    maxTotal: 36,
    percentage: (total / 36) * 100,
    band: bandFor(total),
    nadiAntya: nadi.antya,
  };
}

// ─── Verdict display copy (deterministic; no AI anywhere) ─────────────────────

function buildSummary(groom: MoonData, bride: MoonData, res: AshtakootResult, mangal: MangalReport): string[] {
  const lines: string[] = [];
  lines.push(
    `Milan: Vara ${groom.signName} (${groom.nakshatraName}) × Vadhoo ${bride.signName} (${bride.nakshatraName}). Total Ashtakoot ${res.total}/36 — ${res.band.label} band (${res.band.range}).`
  );
  lines.push(res.band.note);

  const full = res.koots.filter((k) => k.earned === k.max).map((k) => k.name);
  const weak = res.koots.filter((k) => k.earned <= k.max * 0.4).map((k) => k.name);
  if (full.length > 0) {
    lines.push(`Koots at full match: ${full.join(", ")} — on these angles the couple's foundation is strong; trust it.`);
  }
  if (weak.length > 0) {
    lines.push(`Weaker angles: ${weak.join(", ")} — clear conversation now, expectation-setting and (where relevant) Jyotishi-guided upaaya will help here.`);
  }
  if (res.nadiAntya) {
    lines.push(
      "Same Nadi and Anthya: the classical texts (Saravali/Ashtakoota tradition) flag this as 'Antyashaja-adhyaya' — practical attention to the health and children side, and upaaya counsel, should come from a Jyotishi, not from this arithmetic alone."
    );
  }
  lines.push(mangal.note);
  lines.push(
    "This entire score is 100% deterministic: from the Chandra rashi + Janma nakshatra computed with the Lahiri ayanamsa, our classical rule table did the math. No AI guessed anything here — you can recalculate and verify it."
  );
  return lines;
}

export interface MilanComputeOptions {
  /** Same birth data for both partners (allowed, but flagged honestly). */
  sameDataFlag?: boolean;
  advisories?: string[];
}

/** API entry point: two computed kundalis in, one full Milan verdict out. */
export function computeMilan(
  groomKundali: KundaliResult,
  brideKundali: KundaliResult,
  opts: MilanComputeOptions = {}
): MilanMatch {
  const g = partnerDataFromKundali(groomKundali);
  const b = partnerDataFromKundali(brideKundali);

  const groomMoon: MoonData = {
    signIndex: g.signIndex,
    nakshatraIndex: g.nakshatraIndex,
    nakshatraName: g.nakshatraName,
    signName: g.signName,
  };
  const brideMoon: MoonData = {
    signIndex: b.signIndex,
    nakshatraIndex: b.nakshatraIndex,
    nakshatraName: b.nakshatraName,
    signName: b.signName,
  };

  const res = computeAshtakoot(groomMoon, brideMoon);

  const marsHouseFromLagna = (p: PartnerAstroData): number =>
    p.ascendantSignIndex >= 0 ? mod(p.mars.signIndex - p.ascendantSignIndex, 12) + 1 : p.mars.house;

  const groomMangal = assessMangal({
    marsSignIndex: g.mars.signIndex,
    marsSign: g.mars.sign,
    marsHouseFromLagna: marsHouseFromLagna(g),
    moonSignIndex: groomMoon.signIndex,
  });
  const brideMangal = assessMangal({
    marsSignIndex: b.mars.signIndex,
    marsSign: b.mars.sign,
    marsHouseFromLagna: marsHouseFromLagna(b),
    moonSignIndex: brideMoon.signIndex,
  });
  const mangal = mangalReport(groomMangal, brideMangal);

  const advisories = [...(opts.advisories ?? [])];
  if (groomMoon.signIndex === brideMoon.signIndex && groomMoon.nakshatraIndex === brideMoon.nakshatraIndex) {
    advisories.push("Both share the same Chandra rashi + nakshatra — the Nadi and Tara same-source rules apply; this is a special case when reading the Milan.");
  }

  return {
    version: "ashtakoot-v1",
    groom: groomMoon,
    bride: brideMoon,
    koots: res.koots,
    total: res.total,
    maxTotal: 36,
    percentage: res.percentage,
    band: res.band,
    mangal,
    summary: buildSummary(groomMoon, brideMoon, res, mangal),
    sameDataFlag: opts.sameDataFlag ?? false,
    advisories,
  };
}
