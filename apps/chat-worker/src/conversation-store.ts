// Conversation store — D1 is the only authority for AI chat rooms and their
// transcripts. Ids carry an `ai-` prefix so the web app can route an AI room to
// this worker without asking Supabase whether the row exists.
import type { Env } from "./env";

export const AI_CONVERSATION_PREFIX = "ai-";

export interface ConversationRow {
  id: string;
  user_id: string;
  ai_consultant_id: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_text: string | null;
}

export interface ListedConversation extends ConversationRow {
  consultant_name: string | null;
  consultant_avatar: string | null;
  consultant_category: string | null;
}

/** Every AI room this seeker has, newest activity first. */
export async function listConversations(env: Env, userId: string): Promise<ListedConversation[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.ai_consultant_id, c.created_at, c.last_message_at, c.last_message_text,
            a.name AS consultant_name, a.avatar AS consultant_avatar, a.category AS consultant_category
     FROM conversation c
     LEFT JOIN ai_consultant a ON a.id = c.ai_consultant_id
     WHERE c.user_id = ? AND c.ai_consultant_id IS NOT NULL
     ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
  ).bind(userId).all<ListedConversation>();
  return results ?? [];
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  created_at: string;
}

export function isAiConversationId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(AI_CONVERSATION_PREFIX);
}

/**
 * The seeker's room with this consultant, creating it on first use.
 *
 * The unique partial index on (user_id, ai_consultant_id) makes this
 * get-or-create safe under concurrent taps on "Start chat": a losing insert is
 * ignored and the winner's row is re-read.
 */
export async function getOrCreateConversation(
  env: Env,
  userId: string,
  consultantId: string,
): Promise<{ conversationId: string; reused: boolean }> {
  const existing = await env.DB.prepare(
    `SELECT id FROM conversation WHERE user_id = ? AND ai_consultant_id = ? LIMIT 1`
  ).bind(userId, consultantId).first<{ id: string }>();

  if (existing) return { conversationId: existing.id, reused: true };

  const id = `${AI_CONVERSATION_PREFIX}${crypto.randomUUID()}`;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO conversation (id, user_id, ai_consultant_id) VALUES (?, ?, ?)`
  ).bind(id, userId, consultantId).run();

  // Participants are recorded for both sides so a transcript read can attribute
  // the AI bubble without re-deriving it from the consultant slug.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO conversation_participant (conversation_id, user_id, role) VALUES (?, ?, 'member')`
  ).bind(id, userId).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO conversation_participant (conversation_id, user_id, role) VALUES (?, ?, 'ai')`
  ).bind(id, consultantId).run();

  const created = await env.DB.prepare(
    `SELECT id FROM conversation WHERE user_id = ? AND ai_consultant_id = ? LIMIT 1`
  ).bind(userId, consultantId).first<{ id: string }>();

  return { conversationId: created?.id ?? id, reused: created?.id !== id };
}

export async function loadConversation(env: Env, conversationId: string): Promise<ConversationRow | null> {
  return await env.DB.prepare(
    `SELECT id, user_id, ai_consultant_id, created_at, last_message_at, last_message_text
     FROM conversation WHERE id = ?`
  ).bind(conversationId).first<ConversationRow>();
}

export async function requireParticipant(
  env: Env,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const hit = await env.DB.prepare(
    `SELECT 1 AS ok FROM conversation_participant WHERE conversation_id = ? AND user_id = ?`
  ).bind(conversationId, userId).first<{ ok: number }>();
  return Boolean(hit);
}

export async function insertMessage(
  env: Env,
  row: { id: string; conversationId: string; senderId: string; content: string; type?: string; createdAt?: string },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO message (id, conversation_id, sender_id, content, type, created_at)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
  ).bind(
    row.id,
    row.conversationId,
    row.senderId,
    row.content,
    row.type ?? "text",
    row.createdAt ?? null,
  ).run();
}

export async function readMessages(
  env: Env,
  conversationId: string,
  limit: number,
): Promise<MessageRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, conversation_id, sender_id, content, type, created_at
     FROM message WHERE conversation_id = ?
     ORDER BY created_at DESC, rowid DESC LIMIT ?`
  ).bind(conversationId, limit).all<MessageRow>();
  return (results ?? []).slice().reverse();
}

/** Keep the inbox preview honest — the room list renders these two columns. */
export async function touchConversation(env: Env, conversationId: string, preview: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE conversation
     SET last_message_at = datetime('now'), last_message_text = ?
     WHERE id = ?`
  ).bind(preview.slice(0, 200), conversationId).run();
}

/** Stamp in the exact format `datetime('now')` produces, so text ordering is real ordering. */
export function sqliteNow(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** D1's space-separated UTC stamp back to the ISO form the browser expects. */
export function isoOf(stamp: string): string {
  return stamp.includes("T") ? stamp : `${stamp.replace(" ", "T")}Z`;
}
