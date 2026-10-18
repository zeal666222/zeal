import type { Env } from "./env";
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

export async function loadPersona(
  env: Env,
  consultantId: string,
): Promise<PersonaContext | null> {
  const row = await env.DB.prepare(
    `SELECT id, name, category, bio, specialties, languages, persona,
            system_prompt, is_paid, per_minute_rate, safety_level,
            banned_patterns, is_active, location, country
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
  };
}
