// apps/web/lib/chat/worker.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Server-side client for the zeal-chat Cloudflare worker.
//
// AI chat lives there end to end — the room, the transcript, the seeker's
// intake, the provider chain and the realtime socket all run on Cloudflare
// (D1 + Workers AI + a Durable Object). Supabase is not on any of these paths;
// it stays what it has always been for this app: identity and money.
//
// Ids minted by the worker carry an `ai-` prefix, which is how the rest of the
// app knows to come here instead of Supabase without a lookup.
// ═══════════════════════════════════════════════════════════════════════════════

export const WORKER_URL =
  process.env.CHAT_WORKER_URL ?? "https://zeal-chat.zeal666-app.workers.dev";

export { AI_CONVERSATION_PREFIX, isAiConversationId } from "./conversation-id";

export class WorkerError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "WorkerError";
    this.status = status;
  }
}

async function call<T>(
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let message = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch { /* keep raw text */ }
    throw new WorkerError(res.status, message || `worker ${res.status}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export interface WorkerProfile {
  name: string | null;
  dob: string | null;
  tob: string | null;
  pob: string | null;
  latitude: number | null;
  longitude: number | null;
  gender: string | null;
  concern: string | null;
  hasChart: boolean;
  updatedAt: string | null;
}

export interface WorkerIntakeState {
  profile: WorkerProfile | null;
  chartStale: boolean;
  hasBirthData: boolean;
  missing: Array<"name" | "dob" | "pob">;
}

export interface WorkerProfilePatch {
  name?: string;
  dob?: string;
  tob?: string;
  pob?: string;
  latitude?: number;
  longitude?: number;
  gender?: string;
  concern?: string;
  chartSummary?: string;
}

export interface WorkerConsultant {
  id: string;
  name: string;
  avatar: string | null;
  category: string;
  rate: number;
  isPaid: boolean;
}

export interface WorkerConversation {
  conversationId: string;
  isAI: boolean;
  consultantId: string | null;
  consultant: WorkerConsultant | null;
  intake: { chartStale: boolean; hasBirthData: boolean; missing: WorkerIntakeState["missing"] };
}

export interface WorkerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
}

export function createConversation(
  accessToken: string,
  consultantId: string,
): Promise<{ conversationId: string; isAI: boolean; reused: boolean }> {
  return call(accessToken, "/api/conversations", { method: "POST", body: { consultantId } });
}

export interface WorkerConversationSummary {
  conversationId: string;
  consultantId: string | null;
  createdAt: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  consultantName: string | null;
  consultantAvatar: string | null;
  consultantCategory: string | null;
}

export function listConversations(
  accessToken: string,
): Promise<{ conversations: WorkerConversationSummary[] }> {
  return call(accessToken, "/api/conversations");
}

export function getConversation(accessToken: string, conversationId: string): Promise<WorkerConversation> {
  return call(accessToken, `/api/conversations/${conversationId}`);
}

export function readMessages(
  accessToken: string,
  conversationId: string,
  limit = 50,
): Promise<{ messages: WorkerMessage[] }> {
  return call(accessToken, `/api/conversations/${conversationId}/messages?limit=${limit}`);
}

export function getIntake(accessToken: string): Promise<WorkerIntakeState> {
  return call(accessToken, "/api/profile/birth");
}

export function putIntake(accessToken: string, patch: WorkerProfilePatch): Promise<WorkerIntakeState> {
  return call(accessToken, "/api/profile/birth", { method: "PUT", body: patch });
}

export function wsTicket(
  accessToken: string,
  conversationId: string,
): Promise<{ ticket: string; expiresInSeconds: number }> {
  return call(accessToken, `/api/conversations/${conversationId}/ws-ticket`);
}

/** Upgrade URL handed to the browser. The ticket is the only credential. */
export function wsUrl(conversationId: string, ticket: string): string {
  const base = WORKER_URL.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${base}/api/conversations/${conversationId}/ws?ticket=${encodeURIComponent(ticket)}`;
}
