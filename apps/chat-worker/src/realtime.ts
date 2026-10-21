import type { Env } from "./env";

/**
 * Push an event into a room's Durable Object. Never throws: a realtime hiccup
 * must not cost the seeker their answer, which has already been persisted and
 * is streaming over SSE.
 */
export async function publishToRoom(env: Env, conversationId: string, event: unknown): Promise<void> {
  if (!env.CHAT_ROOM) return;
  try {
    const stub = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(conversationId));
    await stub.fetch(new Request("https://room/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }));
  } catch (e) {
    console.warn("[realtime] room publish failed:", e instanceof Error ? e.message : e);
  }
}
