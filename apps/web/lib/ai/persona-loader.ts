// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — AI Persona Loader
// ═══════════════════════════════════════════════════════════════════════════════
// Loads the AIConsultant row, then delegates prompt construction to
// PersonaEngine (structured role contract).
//
// The returned PersonaContext is a STRICT SUPERSET of the type expected by
// @zeal/database/ai-chat-handler. That handler declares its own minimal
// PersonaContext; because this object includes every field it needs (and more),
// TypeScript structurally accepts it.
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";
import {
  PersonaEngine,
  type PersonaInput,
  type RoleContract,
} from "./engine/persona-engine";
import { fetchBirthProfile, toSeekerContext, getMissingFields, type BirthProfile } from "../birth-profile";
import { computeChart } from "./astrology-ai";

export interface PersonaContext extends RoleContract {
  id: string;
  userId: string;
  name: string;
  category: string;
  /** Raw free-form persona note from the DB (may be null). */
  persona: string | null;
  bio: string;
  specialties: string[];
  languages: string[];
  isPaid: boolean;
  perMinuteRate: number;
  safetyLevel: "RELAXED" | "STANDARD" | "STRICT";
  bannedPatterns: string[];
}

const MAX_SYSTEM_PROMPT_LENGTH = 6000;

interface AIConsultantRow {
  id: string;
  name: string;
  category: string;
  bio: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  persona: string | null;
  systemPrompt: string | null;
  isPaid: boolean | null;
  perMinuteRate: number | null;
  safetyLevel: string | null;
  bannedPatterns: string[] | null;
  isActive: boolean | null;
  location: string | null;
  country: string | null;
}

export async function loadPersona(
  consultantId: string,
  seekerContextOrUserId?: PersonaInput["seekerContext"] | string,
): Promise<PersonaContext | null> {
  try {
    let seekerContext: PersonaInput["seekerContext"] = undefined;
    let missingFields: PersonaInput["missingFields"] = undefined;

    if (typeof seekerContextOrUserId === "string") {
      const profile = await fetchBirthProfile(seekerContextOrUserId);
      seekerContext = toSeekerContext(profile);
      missingFields = getMissingFields(profile);

      // Compute ephemeris if we have complete birth data (DOB + POB with coords)
      if (profile?.dateOfBirth && profile?.latitude && profile?.longitude) {
        try {
          const { chartForRAG, dasha } = await computeChart({
            birthDate: profile.dateOfBirth,
            birthTime: profile.timeOfBirth ?? "12:00",
            birthPlace: { lat: profile.latitude, lng: profile.longitude },
            timezone: "Asia/Kolkata",
            chartType: "vedic",
          });

          // Build a concise chart summary to inject into the system prompt
          const planets = chartForRAG.planets ?? [];
          const planetSummary = planets
            .slice(0, 9)
            .map((p: { name?: string; sign?: string; degree?: number; house?: number }) =>
              `${p.name}: ${p.sign} ${p.degree?.toFixed(1) ?? "?"}° (House ${p.house ?? "?"})`
            )
            .join(", ");

          const dashaSummary = dasha
            ? `Current Mahadasha: ${dasha.mahadasha.planet} (until ${dasha.mahadasha.endDate}), Antardasha: ${dasha.antardasha.planet} (until ${dasha.antardasha.endDate})`
            : "";

          // Append chart data to seekerContext for the persona engine
          seekerContext = {
            ...seekerContext,
            chartSummary: planetSummary + (dashaSummary ? `. ${dashaSummary}` : ""),
          };
        } catch {
          // Non-fatal — continue without computed chart
        }
      }
    } else if (seekerContextOrUserId && typeof seekerContextOrUserId === "object") {
      seekerContext = seekerContextOrUserId;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("AIConsultant")
      .select(
        'id, name, category, bio, specialties, languages, persona, "systemPrompt", "isPaid", "perMinuteRate", "safetyLevel", "bannedPatterns", "isActive", location, country',
      )
      .eq("id", consultantId)
      .eq("isActive", true)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as AIConsultantRow;

    // Guard against runaway system prompts
    if ((row.systemPrompt ?? "").length > MAX_SYSTEM_PROMPT_LENGTH) {
      console.warn(`[persona-loader] systemPrompt too long for ${row.id} — using default`);
      row.systemPrompt = null;
    }

    // Build the structured role contract
    const contract = PersonaEngine.build({
      id: row.id,
      name: row.name,
      category: row.category,
      bio: row.bio ?? "",
      specialties: row.specialties ?? [],
      languages: row.languages ?? [],
      persona: row.persona,
      systemPrompt: row.systemPrompt,
      location: row.location,
      country: row.country,
      seekerContext,
      missingFields,
    });

    return {
      // RoleContract fields
      systemPrompt: contract.systemPrompt,
      prohibitions: contract.prohibitions,
      fewShots: contract.fewShots,
      // Identity
      id: row.id,
      userId: row.id,
      name: row.name,
      category: row.category,
      persona: row.persona,
      bio: row.bio ?? "",
      specialties: row.specialties ?? [],
      languages: row.languages ?? [],
      isPaid: row.isPaid ?? false,
      perMinuteRate: row.perMinuteRate ?? 0,
      safetyLevel: (row.safetyLevel ?? "STANDARD") as PersonaContext["safetyLevel"],
      bannedPatterns: row.bannedPatterns ?? [],
    };
  } catch (err) {
    console.error("[persona-loader] failed:", err);
    return null;
  }
}

export interface PriorMessage {
  senderId: string | null;
  content: string;
  createdAt: string;
}

/** Convert prior messages + new user message to AIMessage[] using the contract. */
export function buildChatMessages(
  persona: PersonaContext,
  priorMessages: PriorMessage[],
  newUserMessage: string,
) {
  const history = priorMessages.map((m) => ({
    role: (m.senderId === persona.userId ? "assistant" : "user") as
      | "assistant"
      | "user",
    content: m.content,
  }));

  return PersonaEngine.buildMessages(persona, history, newUserMessage);
}
