// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — AI Persona Loader (server context)
// ═══════════════════════════════════════════════════════════════════════════════
// Loads AIConsultant row + assembles a rich system prompt. Only imported by
// route handlers (server context). No `server-only` import — the subpath
// export boundary and route-handler runtime are the guard.
// ═══════════════════════════════════════════════════════════════════════════════

import {createAdminClient} from "@zeal/database/server";

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
}

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
}

export async function loadPersona(
  consultantId: string,
): Promise<PersonaContext | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("AIConsultant")
      .select(
        'id, name, category, bio, specialties, languages, persona, "systemPrompt", "isPaid", "perMinuteRate"',
      )
      .eq("id", consultantId)
      .eq("isActive", true)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as AIConsultantRow;

    const defaultSystemPrompt = [
      `You are ${row.name}, an expert ${row.category} consultant on Zeal.`,
      "You are NOT an AI assistant — you are a wise, empathetic, experienced guide.",
      "Speak with warmth, authority, and practical insight.",
      "Never break character. Never mention that you are an AI model.",
      "Keep responses focused, under 200 words unless the user asks for depth.",
      "If a user asks something outside your expertise, gently redirect to a topic you can help with.",
    ].join("\n");

    return {
      id: row.id,
      userId: row.id, // AI shadow User has the same id
      name: row.name,
      category: row.category,
      systemPrompt: row.systemPrompt || defaultSystemPrompt,
      persona: row.persona,
      bio: row.bio ?? "",
      specialties: row.specialties ?? [],
      languages: row.languages ?? [],
      isPaid: row.isPaid ?? false,
      perMinuteRate: row.perMinuteRate ?? 0,
    };
  } catch (err) {
    console.error("[persona-loader] failed:", err);
    return null;
  }
}

// ─── Build message array for a chat turn ──────────────────────────────────────
export interface PriorMessage {
  senderId: string | null;
  content: string;
  createdAt: string;
}

export function buildChatMessages(
  persona: PersonaContext,
  priorMessages: PriorMessage[],
  newUserMessage: string,
) {
  const systemBlock = [
    persona.systemPrompt,
    "",
    `Specialties: ${persona.specialties.join(", ") || "general guidance"}`,
    `Languages: ${persona.languages.join(", ") || "English"}`,
  ].join("\n");

  const history = priorMessages.slice(-20).map((m) => ({
    role: (m.senderId === persona.userId ? "assistant" : "user") as
      | "assistant"
      | "user",
    content: m.content,
  }));

  return [
    {
      role: "system" as const,
      content: systemBlock,
      cache_control: { type: "ephemeral" as const },
    },
    ...history,
    { role: "user" as const, content: newUserMessage },
  ];
}
