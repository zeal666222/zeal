// apps/web/lib/chat/conversation-id.ts
// The one rule that says which backend owns a room, with no import side effects
// so both the browser and route handlers can use it.
//
// The zeal-chat worker mints every AI room id as `ai-<uuid>`; human rooms keep
// plain uuids and stay on Supabase.

export const AI_CONVERSATION_PREFIX = "ai-";

export function isAiConversationId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(AI_CONVERSATION_PREFIX);
}
