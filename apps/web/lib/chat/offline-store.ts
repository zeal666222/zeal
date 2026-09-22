// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — IndexedDB Chat Cache (LZ-String compressed)
// ═══════════════════════════════════════════════════════════════════════════════
// Cache-first chat storage. Every message write goes through LZ-String
// UTF-16 compression before hitting IndexedDB. Cold-open reads decompress
// and return in <200ms.
//
// Constraints:
//   • 7-day TTL per conversation
//   • Max 50 conversations (LRU by lastMessageAt)
//   • QuotaExceededError → clear oldest 25%, retry
//   • SSR-safe (returns null when window is undefined)
// ═══════════════════════════════════════════════════════════════════════════════

import Dexie, { type Table } from "dexie";
import LZString from "lz-string";

export interface CachedMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  createdAt: string;
}

export interface CachedConversation {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  isAI: boolean;
  lastMessageAt: number;
  messagesCompressed: string;
  messageCount: number;
  cachedAt: number;
}

class ZealChatDB extends Dexie {
  conversations!: Table<CachedConversation, string>;

  constructor() {
    super("zeal-chat-cache");
    this.version(1).stores({
      conversations: "id, lastMessageAt, partnerId, cachedAt",
    });
  }
}

let db: ZealChatDB | null = null;

function getDB(): ZealChatDB | null {
  if (typeof window === "undefined") return null;
  if (typeof indexedDB === "undefined") return null;
  if (!db) {
    try {
      db = new ZealChatDB();
    } catch (e) {
      console.warn("[offline-store] DB init failed:", e);
      return null;
    }
  }
  return db;
}

const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CONVERSATIONS = 50;

export async function cacheConversation(
  conversationId: string,
  messages: CachedMessage[],
  meta: {
    partnerId: string;
    partnerName: string;
    partnerAvatar: string | null;
    isAI: boolean;
  },
): Promise<void> {
  const d = getDB();
  if (!d) return;
  if (messages.length === 0) return;

  try {
    const json = JSON.stringify(messages);
    const compressed = LZString.compressToUTF16(json);
    const last = messages[messages.length - 1];
    if (!last) return;

    await d.conversations.put({
      id: conversationId,
      partnerId: meta.partnerId,
      partnerName: meta.partnerName,
      partnerAvatar: meta.partnerAvatar,
      isAI: meta.isAI,
      lastMessageAt: new Date(last.createdAt).getTime() || Date.now(),
      messagesCompressed: compressed,
      messageCount: messages.length,
      cachedAt: Date.now(),
    });

    await pruneOldEntries(d);
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err?.name === "QuotaExceededError") {
      console.warn("[offline-store] quota exceeded — pruning");
      await emergencyPrune(d);
      try {
        const json = JSON.stringify(messages);
        const compressed = LZString.compressToUTF16(json);
        const last = messages[messages.length - 1];
    if (!last) return;
        await d.conversations.put({
          id: conversationId,
          partnerId: meta.partnerId,
          partnerName: meta.partnerName,
          partnerAvatar: meta.partnerAvatar,
          isAI: meta.isAI,
          lastMessageAt: new Date(last.createdAt).getTime() || Date.now(),
          messagesCompressed: compressed,
          messageCount: messages.length,
          cachedAt: Date.now(),
        });
      } catch {
        console.warn("[offline-store] retry after prune failed");
      }
    } else {
      console.warn("[offline-store] cache failed:", e);
    }
  }
}

export async function getCachedMessages(
  conversationId: string,
): Promise<CachedMessage[] | null> {
  const d = getDB();
  if (!d) return null;

  try {
    const row = await d.conversations.get(conversationId);
    if (!row) return null;

    if (Date.now() - row.cachedAt > MAX_CACHE_AGE_MS) {
      await d.conversations.delete(conversationId);
      return null;
    }

    const json = LZString.decompressFromUTF16(row.messagesCompressed);
    if (!json) return null;
    return JSON.parse(json) as CachedMessage[];
  } catch (e) {
    console.warn("[offline-store] read failed:", e);
    return null;
  }
}

export async function getCachedConversations(): Promise<CachedConversation[]> {
  const d = getDB();
  if (!d) return [];
  try {
    return await d.conversations.orderBy("lastMessageAt").reverse().toArray();
  } catch {
    return [];
  }
}

export async function clearConversationCache(conversationId: string): Promise<void> {
  const d = getDB();
  if (!d) return;
  try {
    await d.conversations.delete(conversationId);
  } catch { /* ignore */ }
}

export async function getCacheStats(): Promise<{
  conversations: number;
  totalMessages: number;
  approxBytes: number;
}> {
  const d = getDB();
  if (!d) return { conversations: 0, totalMessages: 0, approxBytes: 0 };
  try {
    const rows = await d.conversations.toArray();
    let totalMessages = 0;
    let approxBytes = 0;
    for (const r of rows) {
      totalMessages += r.messageCount;
      approxBytes += r.messagesCompressed.length * 2; // UTF-16
    }
    return { conversations: rows.length, totalMessages, approxBytes };
  } catch {
    return { conversations: 0, totalMessages: 0, approxBytes: 0 };
  }
}

async function pruneOldEntries(d: ZealChatDB): Promise<void> {
  const cutoff = Date.now() - MAX_CACHE_AGE_MS;
  try {
    await d.conversations.where("cachedAt").below(cutoff).delete();
  } catch { /* ignore */ }

  try {
    const count = await d.conversations.count();
    if (count > MAX_CONVERSATIONS) {
      const oldest = await d.conversations
        .orderBy("lastMessageAt")
        .limit(count - MAX_CONVERSATIONS)
        .toArray();
      await d.conversations.bulkDelete(oldest.map((c) => c.id));
    }
  } catch { /* ignore */ }
}

async function emergencyPrune(d: ZealChatDB): Promise<void> {
  try {
    const rows = await d.conversations.orderBy("cachedAt").toArray();
    const toDelete = rows.slice(0, Math.max(1, Math.floor(rows.length * 0.25)));
    await d.conversations.bulkDelete(toDelete.map((c) => c.id));
  } catch { /* ignore */ }
}
