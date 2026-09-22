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
}

export async function loadPersona(
  consultantId: string,
  seekerContext?: PersonaInput["seekerContext"],
): Promise<PersonaContext | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("AIConsultant")
      .select(
        'id, name, category, bio, specialties, languages, persona, "systemPrompt", "isPaid", "perMinuteRate", "safetyLevel", "bannedPatterns", "isActive"',
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
      seekerContext,
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
