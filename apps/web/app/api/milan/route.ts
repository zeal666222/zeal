// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Guna Milan (Ashtakoot) API
// ─────────────────────────────────────────────────────────────────────────────
// POST { groom: {name,dob,tob,pob,pobPlace?}, bride: {...}, question? }
//   1. Rate limit (generalLimiter, IP keyed) + hard input-size cap.
//   2. Strict per-field validation (Hinglish messages, no stack traces ever).
//   3. Both Janam kundalis computed with the SAME deterministic engine as
//      /api/kundali (Lahiri ayanamsa, IANA timezone) — no astronomy re-implemented.
//   4. Ashtakoot 36-point scoring + Kuja (Mangal) dosha from lib/milan/engine.
// No AI, no paid APIs: the whole response is reproducible arithmetic.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { checkRateLimit, generalLimiter } from "@/lib/rate-limit";
import {
  KundaliInputError,
  computeKundali,
  validateBirthDate,
  validateBirthTime,
  validateName,
  type KundaliResult,
} from "@/lib/kundali/engine";
import { resolvePlace, type ResolvedPlace } from "@/lib/kundali/geocoder";
import { MilanRuleError, computeMilan } from "@/lib/milan/engine";
import type { MilanMatch, MilanPersonInput } from "@/lib/milan/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Whole-body ceiling — two partners' birth data never needs more than this. */
const MAX_BODY_BYTES = 6000;
const MAX_PLACE_LABEL = 140;
const MAX_TIMEZONE = 64;
const MAX_QUESTION = 800;

class MilanInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MilanInputError";
  }
}

const ROLE_LABEL: Record<"groom" | "bride", string> = { groom: "Vara (groom)", bride: "Vadhoo (bride)" };
// ─── Per-partner validation ─────────────────────────────────────────────────────

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MilanInputError(`${label} — please send the data as a valid object.`);
  }
  return value as Record<string, unknown>;
}

/** Strict finite-number coercion: null / "" / booleans / NaN / arrays are rejected. */
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean" || typeof value === "object") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validatePobPlace(raw: unknown, label: string): MilanPersonInput["pobPlace"] | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const p = asRecord(raw, `${label} pobPlace`);
  const lat = toFiniteNumber(p.lat);
  const lng = toFiniteNumber(p.lng);
  const timezone = typeof p.timezone === "string" ? p.timezone.trim() : "";
  const placeLabel = typeof p.label === "string" ? p.label.trim() : "";

  if (lat === null || lng === null) {
    throw new MilanInputError(`${label}: coordinates are invalid — please pick a city from the suggestions or type just the city name.`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new MilanInputError(`${label}: coordinates are out of range (lat ±90, lng ±180).`);
  }
  if (!timezone || timezone.length > MAX_TIMEZONE || !/^[A-Za-z0-9_+\-/]+$/.test(timezone)) {
    throw new MilanInputError(`${label}: autocomplete did not provide an IANA timezone — please pick the city again.`);
  }
  if (!placeLabel || placeLabel.length > MAX_PLACE_LABEL) {
    throw new MilanInputError(`${label}: place label is too long or empty.`);
  }
  const source = p.source === "nominatim" ? "nominatim" : "gazetteer";
  return {
    label: placeLabel,
    lat,
    lng,
    timezone,
    country: typeof p.country === "string" ? p.country.slice(0, 60) : "",
    source,
  };
}

interface ValidatedPerson {
  name: string;
  dob: string;
  tob: string;
  pob: string;
  place: string;
  resolved: ResolvedPlace;
}

async function validatePerson(raw: unknown, role: "groom" | "bride"): Promise<ValidatedPerson> {
  const label = ROLE_LABEL[role];
  const body = asRecord(raw, label);

  // Kundali validators throw friendly error messages; we prefix the role so
  // the user knows WHICH column has the problem.
  let name: string;
  let dob: string;
  let tob: string;
  try {
    name = validateName(body.name);
    dob = validateBirthDate(body.dob);
    tob = validateBirthTime(body.tob);
  } catch (err) {
    if (err instanceof KundaliInputError) throw new MilanInputError(`${label} — ${err.message}`);
    throw new MilanInputError(`${label}: we couldn't read the birth data — please fill it in again.`);
  }

  const pob = String(body.pob ?? "").trim();
  if (!pob) throw new MilanInputError(`${label} — please enter the place of birth.`);
  if (pob.length > MAX_PLACE_LABEL) throw new MilanInputError(`${label} — place is too long; keep it to "City, State".`);

  const pobPlace = validatePobPlace(body.pobPlace, label);

  // Autocomplete gave us exact coords + tz → trust them (no network, deterministic).
  // Otherwise fall back to the same server-side resolver the kundali API uses.
  let resolved: ResolvedPlace;
  if (pobPlace) {
    resolved = {
      lat: pobPlace.lat,
      lng: pobPlace.lng,
      timezone: pobPlace.timezone,
      canonicalName: pobPlace.label,
      country: pobPlace.country ?? "",
      source: pobPlace.source === "nominatim" ? "nominatim" : "gazetteer",
    };
  } else {
    const r = await resolvePlace(pob, { allowNetwork: true, timeoutMs: 3500 });
    if (!r) {
      throw new MilanInputError(
        `${label} — we couldn't locate "${pob}". Please pick a city from the suggestions or write the full name (e.g. "Pune, Maharashtra").`
      );
    }
    resolved = r;
  }

  return { name, dob, tob, pob, place: pobPlace ? pobPlace.label : pob, resolved };
}

// ─── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // 1. Rate limit (same pattern as /api/geo/suggest)
    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    const rl = await checkRateLimit(generalLimiter, `milan:ip:${ip}`);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many requests — please pause a moment and try again.", code: "RATE_LIMIT", retryable: true },
        { status: 429, headers: rl.headers }
      );
    }

    // 2. Size-capped body read + safe JSON parse
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request too large — please send only the basic birth data for both partners.", code: "VALIDATION" },
        { status: 413, headers: rl.headers }
      );
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed request — please try again.", code: "VALIDATION" },
        { status: 400, headers: rl.headers }
      );
    }

    // 3. Validate both partners
    const groomIn = body.groom === undefined ? null : body.groom;
    const brideIn = body.bride === undefined ? null : body.bride;
    if (!groomIn || !brideIn) {
      return NextResponse.json(
        { success: false, error: "Both partners are required — please fill birth details for Vara (groom) and Vadhoo (bride).", code: "VALIDATION" },
        { status: 400, headers: rl.headers }
      );
    }
    const groom = await validatePerson(groomIn, "groom");
    const bride = await validatePerson(brideIn, "bride");

    // 4. Compute both kundalis with the proven deterministic engine
    const groomChart = computeKundali(groom.name, groom.dob, groom.tob, groom.place, groom.resolved);
    const brideChart = computeKundali(bride.name, bride.dob, bride.tob, bride.place, bride.resolved);

    // 5. Same-person / same-data detection (allowed, but we flag it honestly)
    const sameDataFlag =
      groom.dob === bride.dob &&
      groom.tob === bride.tob &&
      Math.abs(groom.resolved.lat - bride.resolved.lat) < 0.01 &&
      Math.abs(groom.resolved.lng - bride.resolved.lng) < 0.01;

    const advisories: string[] = [];
    if (sameDataFlag) {
      advisories.push(
        "Both partners were given the same birth data — the Milan was computed as a self-match, which is not a real vivah Milan. Please re-check with distinct names."
      );
    }
    advisories.push(...chartAdvisories("Vara", groomChart));
    advisories.push(...chartAdvisories("Vadhoo", brideChart));

    // 6. Deterministic Ashtakoot scoring
    const match: MilanMatch = computeMilan(groomChart, brideChart, { sameDataFlag, advisories });

    const headers = new Headers(rl.headers);
    headers.set("Cache-Control", "private, no-store");
    return NextResponse.json(
      {
        success: true,
        match,
        charts: { groom: groomChart, bride: brideChart },
        question: String(body.question ?? "").trim().slice(0, MAX_QUESTION),
      },
      { headers }
    );
  } catch (err) {
    // Friendly error surface. Never echo stack traces.
    if (err instanceof MilanInputError || err instanceof KundaliInputError) {
      return NextResponse.json({ success: false, error: err.message, code: "VALIDATION" }, { status: 400 });
    }
    if (err instanceof MilanRuleError) {
      return NextResponse.json(
        { success: false, error: `Milan calculation issue: ${err.message}`, code: "RULE_ERROR" },
        { status: 422 }
      );
    }
    console.error("[milan]", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { success: false, error: "We couldn't compute the Milan — please try again in a moment.", code: "INTERNAL" },
      { status: 500 }
    );
  }
}

/** Surface only the accuracy CAVEATS the kundali engine computed (Moon near a rashi boundary, approx coords). */
function chartAdvisories(label: string, k: KundaliResult): string[] {
  const out: string[] = [];
  for (const f of k.confidence.factors) {
    const n = f.toLowerCase();
    if (n.includes("boundary") || n.includes("seema") || n.includes("kareeb") || n.includes("approximate")) {
      out.push(`${label} — ${f}`);
    }
  }
  if (k.input.resolvedPlace.source === "nominatim") {
    out.push(`${label} — place ke coordinates approximate (OpenStreetMap) se aaye; suggestion list se exact city chuniye.`);
  }
  return out;
}
