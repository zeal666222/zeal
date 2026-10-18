import type { Env } from "./env";

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

  const systemPrompt = row.system_prompt ?? buildDefaultSystemPrompt(row);

  return {
    id: row.id,
    userId: row.id,
    name: row.name,
    category: row.category,
    systemPrompt,
    persona: row.persona,
    bio: row.bio ?? "",
    specialties: parseJsonArray(row.specialties),
    languages: parseJsonArray(row.languages),
    isPaid: row.is_paid === 1,
    perMinuteRate: row.per_minute_rate ?? 0,
    safetyLevel: (row.safety_level ?? "STANDARD") as PersonaContext["safetyLevel"],
    bannedPatterns: parseJsonArray(row.banned_patterns),
    fewShots: [],
  };
}

function buildDefaultSystemPrompt(row: ConsultantRow): string {
  const name = row.name;
  const category = row.category;
  const bio = row.bio ?? `a ${category.toLowerCase()} consultant`;
  const specialties = parseJsonArray(row.specialties);
  const specStr = specialties.length > 0 ? specialties.join(", ") : category.toLowerCase();

  return `You are ${name}, a ${bio}. You specialize in ${specStr}.

Speak in a warm, conversational Hinglish style (mix of Hindi and English). Be empathetic, insightful, and practical.

Guidelines:
- Never claim to predict the future with certainty
- Always frame guidance as possibilities, not guarantees
- Respect the seeker's free will and autonomy
- Draw from traditional wisdom and modern psychology
- Keep responses concise (2-4 paragraphs) unless depth is requested
- Use the seeker's name if known
- Never discuss topics outside your expertise`;
}
