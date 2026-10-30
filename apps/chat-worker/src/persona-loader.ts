import type { Env } from "./env";
import type { SeekerProfileRow } from "./seeker-profile";
import { PersonaEngine } from "./persona-engine";

export interface ConsultantRow {
  id: string;
  name: string;
  category: string;
  bio: string | null;
  specialties: string;
  languages: string;
  persona: string | null;
  system_prompt: string | null;
  is_paid: number;
  per_minute_rate: number;
  safety_level: string;
  banned_patterns: string;
  is_active: number;
  location: string | null;
  country: string | null;
  religion: string | null;
  lineage: string | null;
  native_language: string | null;
  gender: string | null;
}

export interface PersonaContext {
  id: string;
  userId: string;
  name: string;
  category: string;
  systemPrompt: string;
  persona: string | null;
  bio: string;
  specialties: string[];
  languages: string[];
  isPaid: boolean;
  perMinuteRate: number;
  safetyLevel: "RELAXED" | "STANDARD" | "STRICT";
  bannedPatterns: string[];
  fewShots: Array<{ role: "assistant" | "user"; content: string }>;
  location: string | null;
  country: string | null;
  religion: string | null;
  lineage: string | null;
  nativeLanguage: string | null;
  gender: "male" | "female" | null;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Kundali-grounded seeker context, read from D1 under the caller's user id. */
export interface SeekerContext {
  name?: string;
  dob?: string;
  tob?: string;
  pob?: string;
  concern?: string;
  chartSummary?: string | null;
}

type MissingField = "name" | "dob" | "tob" | "pob" | "concern";

function seekerContextFrom(astro?: SeekerContext | null) {
  if (!astro) return undefined;
  const sc: NonNullable<Parameters<typeof PersonaEngine.build>[0]["seekerContext"]> = {};
  if (astro.name) sc.name = astro.name;
  if (astro.dob) sc.dob = astro.dob;
  if (astro.tob) sc.tob = astro.tob;
  if (astro.pob) sc.pob = astro.pob;
  if (astro.concern) sc.concern = astro.concern;
  if (astro.chartSummary) sc.chartSummary = astro.chartSummary;
  return Object.keys(sc).length > 0 ? sc : undefined;
}

function missingFieldsFrom(astro?: SeekerContext | null): MissingField[] {
  if (!astro) return ["name", "dob", "tob", "pob", "concern"];
  const missing: MissingField[] = [];
  if (!astro.name) missing.push("name");
  if (!astro.dob) missing.push("dob");
  // Time-of-birth stays askable: intake allows "unknown", and an exact minute
  // materially sharpens the Lagna — so the consultant may still probe for it.
  if (!astro.tob) missing.push("tob");
  if (!astro.pob) missing.push("pob");
  if (!astro.concern) missing.push("concern");
  return missing;
}

/**
 * The seeker context a turn is grounded in. Callers must build this from the
 * authenticated user's stored profile — never from the request body, which is
 * how one seeker's birth details ended up in another seeker's reading.
 */
export function seekerContextFor(row: SeekerProfileRow | null): SeekerContext | undefined {
  if (!row) return undefined;
  const ctx: SeekerContext = {
    name: row.name ?? undefined,
    dob: row.dob ?? undefined,
    tob: row.tob ?? undefined,
    pob: row.pob ?? undefined,
    concern: row.concern ?? undefined,
    chartSummary: row.chart_summary ?? null,
  };
  return Object.values(ctx).some((v) => v) ? ctx : undefined;
}

export async function loadPersona(
  env: Env,
  consultantId: string,
  seeker?: SeekerContext | null,
): Promise<PersonaContext | null> {
  const row = await env.DB.prepare(
    `SELECT id, name, category, bio, specialties, languages, persona,
            system_prompt, is_paid, per_minute_rate, safety_level,
            banned_patterns, is_active, location, country,
            religion, lineage, native_language, gender
     FROM ai_consultant WHERE id = ? AND is_active = 1`
  ).bind(consultantId).first<ConsultantRow>();

  if (!row) {
    const exists = await env.DB.prepare(
      `SELECT id, is_active FROM ai_consultant WHERE id = ?`
    ).bind(consultantId).first<{ id: string; is_active: number }>();

    if (exists) {
      console.warn(`[persona-loader] consultant ${consultantId} exists but is_active=${exists.is_active}`);
    } else {
      console.warn(`[persona-loader] consultant ${consultantId} not found in D1`);
    }
    return null;
  }

  const specialties = parseJsonArray(row.specialties);
  const languages = parseJsonArray(row.languages);
  const bannedPatterns = parseJsonArray(row.banned_patterns);

  // Build the rich role contract via PersonaEngine (adds ~2000 chars of
  // expertise anchors, prohibitions, reasoning protocol, psychology patterns,
  // few-shots, language directives). Falls back to raw DB prompt only if
  // PersonaEngine throws for an unknown reason.
  let contract: ReturnType<typeof PersonaEngine.build>;
  try {
    contract = PersonaEngine.build({
      id: row.id,
      name: row.name,
      category: row.category,
      bio: row.bio ?? "",
      specialties,
      languages,
      persona: row.persona,
      systemPrompt: row.system_prompt,
      location: row.location,
      country: row.country,
      religion: row.religion,
      lineage: row.lineage,
      nativeLanguage: row.native_language,
      gender: (row.gender === "male" || row.gender === "female") ? row.gender : null,
      safetyLevel: row.safety_level,
      bannedPatterns,
      seekerContext: seekerContextFrom(seeker),
      missingFields: missingFieldsFrom(seeker),
    });
  } catch (e) {
    console.error("[persona-loader] PersonaEngine.build failed:", e);
    contract = {
      systemPrompt: row.system_prompt ?? `You are ${row.name}, a ${row.category.toLowerCase()} consultant.`,
      prohibitions: [],
      fewShots: [],
    };
  }

  return {
    id: row.id,
    userId: row.id,
    name: row.name,
    category: row.category,
    systemPrompt: contract.systemPrompt,
    persona: row.persona,
    bio: row.bio ?? "",
    specialties,
    languages,
    isPaid: row.is_paid === 1,
    perMinuteRate: row.per_minute_rate ?? 0,
    safetyLevel: (row.safety_level ?? "STANDARD") as PersonaContext["safetyLevel"],
    bannedPatterns,
    fewShots: contract.fewShots,
    location: row.location,
    country: row.country,
    religion: row.religion,
    lineage: row.lineage,
    nativeLanguage: row.native_language,
    gender: (row.gender === "male" || row.gender === "female") ? row.gender as "male" | "female" : null,
  };
}
