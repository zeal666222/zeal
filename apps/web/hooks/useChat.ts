"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useChat — Conversation messages with realtime + optimistic sends
// Liveness sources (merged, deduped by message id):
//   1. room:{id}:messages broadcast channel (@zeal/realtime)  — human rooms
//   2. the AI room's Cloudflare Durable Object socket         — AI rooms
//   3. AI SSE stream events (userMessageId / delta / filler / done+message)
//   4. Background poll (guaranteed fallback when neither socket is live)
// ═══════════════════════════════════════════════════════════════════════════════

import {useCallback, useEffect, useRef, useState} from "react";
import {useChannel, useConnection, channels, type BroadcastChange} from "@zeal/realtime";
import {isAiConversationId} from "@/lib/chat/conversation-id";
import {useWorkerRoom} from "@/hooks/use-worker-room";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  type: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  _optimistic?: boolean;
}

/** Result of auto_start_chat_billing, surfaced by send()/sendToAI(). */
export interface BillingInfo {
  success: boolean;
  sessionId?: string;
  rate?: number;
  isAI?: boolean;
  free?: boolean;
  reused?: boolean;
  error?: string;
  required?: number;
  available?: number;
}

/** Persona-aware "thinking out loud" phase emitted before the first token. */
export interface StageEvent {
  index: number;
  key: string;
  label: string;
  total: number;
}

/** Persona-tuned follow-up chip surfaced on the AI's `done` event. */
export interface Suggestion {
  label: string;
  prompt: string;
  icon?: "sparkle" | "chart" | "heart" | "briefcase" | "moon" | "clock";
}

/** What the worker knows about the seeker after a turn that carried birth data. */
export interface ProfileUpdate {
  hasBirthData: boolean;
  chartStale: boolean;
  missing: Array<"name" | "dob" | "pob">;
}

interface MessageRow {
  id?: string;
  conversationId?: string;
  senderId?: string | null;
  content?: string;
  type?: string;
  createdAt?: string;
}

interface UseChatOptions {
  conversationId: string | null;
  currentUserId: string;
  pageSize?: number;
  /** Background poll interval in ms. 0 disables polling. */
  pollMs?: number;
  /** Partner metadata for IndexedDB offline cache. */
  partnerId?: string;
  partnerName?: string;
  partnerAvatar?: string | null;
  isAI?: boolean;
}

export function useChat({
  conversationId,
  currentUserId,
  pageSize = 50,
  pollMs = 15_000,
  partnerId = "",
  partnerName = "",
  partnerAvatar = null,
  isAI = false,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(!!conversationId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  const mergeIncoming = useCallback((incoming: ChatMessage) => {
    if (seenIds.current.has(incoming.id)) return;
    seenIds.current.add(incoming.id);
    setMessages((prev) => {
      const cleaned = prev.filter(
        (m) => !(m._optimistic && m.content === incoming.content && m.senderId === incoming.senderId),
      );
      return [...cleaned, incoming].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, []);

  // ─── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    seenIds.current = new Set();

    fetch(`/api/chat/${conversationId}/messages?limit=${pageSize}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { messages?: ChatMessage[]; hasMore?: boolean }) => {
        if (cancelled) return;
        const list = data.messages ?? [];
        list.forEach((m) => seenIds.current.add(m.id));
        setMessages(list);
        setHasMore(!!data.hasMore && list.length > 0);

        // ─── IndexedDB write-through ─────────────────────────────────────
        // Persist every server-originated load so cold-open is instant.
        void (async () => {
          try {
            const { cacheConversation } = await import("@/lib/chat/offline-store");
            await cacheConversation(
              conversationId,
              list as never,
              { partnerId, partnerName, partnerAvatar, isAI },
            );
          } catch { /* cache failure is non-fatal */ }
        })();
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [conversationId, pageSize, reloadKey]);

  // ─── Realtime broadcast (human rooms) ─────────────────────────────────────
  // Which transport owns this room is decided by the id, not a lookup: the
  // worker mints AI rooms as `ai-<uuid>`, so Supabase never sees their turns.
  const aiRoom = isAI && isAiConversationId(conversationId);
  useChannel<BroadcastChange<MessageRow>>({
    channel: conversationId && !aiRoom ? channels.roomMessages(conversationId) : null,
    event: "*",
    onMessage: (payload) => {
      if (payload?.type !== "INSERT") return;
      const record = payload.record;
      if (!record?.id || !record.content) return;
      mergeIncoming({
        id: record.id,
        conversationId: record.conversationId ?? conversationId ?? "",
        senderId: record.senderId ?? null,
        content: record.content,
        type: record.type ?? "text",
        createdAt: record.createdAt ?? new Date().toISOString(),
      });
    },
  });

  // ─── Cloudflare room socket (AI rooms) ────────────────────────────────────
  // Supabase realtime cannot carry these: the transcript lives in the worker's
  // D1, and the worker publishes each persisted turn straight into the room's
  // Durable Object. Same merge path, so the sender's other tabs stay live too.
  const { connected: roomLive } = useWorkerRoom({
    conversationId,
    enabled: aiRoom,
    onMessage: (raw) => {
      const record = raw as MessageRow;
      if (!record?.id || !record.content) return;
      mergeIncoming({
        id: record.id,
        conversationId: record.conversationId ?? conversationId ?? "",
        senderId: record.senderId ?? null,
        content: record.content,
        type: record.type ?? "text",
        createdAt: record.createdAt ?? new Date().toISOString(),
      });
    },
  });

  // ─── Background poll fallback ─────────────────────────────────────────────
  // Only polls while the room's own socket is NOT connected — broadcasts are the
  // primary transport, the poll is the guaranteed fallback, and an idle 15s
  // fetch per open chat is exactly the waterfall load we avoid when live.
  // AI rooms have no Supabase channel at all, so they key off the DO socket.
  const connection = useConnection();
  useEffect(() => {
    if (!conversationId || pollMs <= 0) return;
    if (aiRoom ? roomLive : connection === "connected") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/chat/${conversationId}/messages?limit=${pageSize}`, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as { messages?: ChatMessage[] };
        for (const m of data.messages ?? []) {
          if (!cancelled && m.id && !seenIds.current.has(m.id)) mergeIncoming(m);
        }
      } catch { /* transient — retry on next tick */ }
    };
    void tick();
    const id = setInterval(() => { void tick(); }, pollMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [conversationId, pageSize, pollMs, mergeIncoming, connection, aiRoom, roomLive]);

  // ─── send (user-to-user) ──────────────────────────────────────────────────
  const send = useCallback(
    async (content: string): Promise<{ billing?: BillingInfo } | undefined> => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return undefined;

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        conversationId,
        senderId: currentUserId,
        content: trimmed,
        type: "text",
        createdAt: new Date().toISOString(),
        _optimistic: true,
      };

      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);
      setError(null);

      try {
        const res = await fetch(`/api/chat/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });
        if (res.status === 402) {
          // Blocked by the billing gate: the message was NOT persisted. Drop the
          // optimistic bubble and hand the wallet-gate info back to the caller.
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return {
            billing: (body.billing as BillingInfo) ?? {
              success: false,
              error: "insufficient_balance",
              required: Number(body.required ?? 0),
              available: Number(body.available ?? 0),
            },
          };
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string })?.error || `HTTP ${res.status}`);
        }
        const { message, billing } = (await res.json()) as {
          message: ChatMessage;
          billing?: BillingInfo;
        };
        if (message?.id) {
          seenIds.current.add(message.id);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...message, _optimistic: false } : m)));
        }
        return { billing };
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(err instanceof Error ? err.message : "Failed to send");
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentUserId],
  );

  // ─── sendToAI (streaming) ─────────────────────────────────────────────────
  interface SendToAIHandlers {
    onDelta: (acc: string) => void;
    onFiller?: (filler: string) => void;
    onBilling?: (billing: BillingInfo) => void;
    onStage?: (stage: StageEvent) => void;
    onStageDone?: () => void;
    onSuggestions?: (suggestions: Suggestion[]) => void;
    /** The turn contained birth details the worker just saved to this seeker's
     *  profile — the intake form can retire itself. */
    onProfileUpdated?: (update: ProfileUpdate) => void;
  }

  // Typewriter pacing: burst provider chunks (Groq/CF AI can drop a whole
  // paragraph in one frame) are buffered and released at a steady cadence so
  // the bubble "types" instead of jumping. Reveal speed adapts to queue depth
  // so a long tail never lags more than ~1.2s behind the raw stream.
  const TYPED_INTERVAL_MS = 28;
  const TYPED_MIN_CHARS_PER_TICK = 2;
  const TYPED_QUEUE_TARGET_MS = 900;

  const sendToAI = useCallback(
    async (consultantId: string, content: string, handlers: SendToAIHandlers | ((acc: string) => void), retryCount = 0, isOpener = false) => {
      const onDelta = typeof handlers === "function" ? handlers : handlers.onDelta;
      const onFiller = typeof handlers === "function" ? undefined : handlers.onFiller;
      const onBilling = typeof handlers === "function" ? undefined : handlers.onBilling;
      const onStage = typeof handlers === "function" ? undefined : handlers.onStage;
      const onStageDone = typeof handlers === "function" ? undefined : handlers.onStageDone;
      const onSuggestions = typeof handlers === "function" ? undefined : handlers.onSuggestions;
      const onProfileUpdated = typeof handlers === "function" ? undefined : handlers.onProfileUpdated;

      const trimmed = content.trim();
      if ((!trimmed && !isOpener) || !conversationId || !consultantId) return;

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (!isOpener) {
        const optimistic: ChatMessage = {
          id: tempId,
          conversationId,
          senderId: currentUserId,
          content: trimmed,
          type: "text",
          createdAt: new Date().toISOString(),
          _optimistic: true,
        };
        setMessages((prev) => [...prev, optimistic]);
      }
      setIsSending(true);
      setError(null);

      const MAX_RETRIES = 2;
      const abortCtrl = new AbortController();

      // ─── Typewriter pacing ─────────────────────────────────────────────
      // Providers emit chunky bursts (Groq can drop a whole sentence in one
      // frame). We buffer deltas and reveal them at a fixed cadence so the
      // bubble "types" instead of teleporting. Adaptive drain keeps lag under
      // ~1.2s even on long outputs. Everything is flushed synchronously before
      // `sendToAI` resolves so callers never see a half-typed tail.
      const queue: string[] = [];
      let revealed = "";
      let revealTimer: ReturnType<typeof setInterval> | null = null;
      const startReveal = () => {
        if (revealTimer) return;
        revealTimer = setInterval(() => {
          if (queue.length === 0) return;
          const drain = queue.length > 8 ? Math.ceil(queue.length / 4) : 1;
          for (let i = 0; i < drain && queue.length; i++) revealed += queue.shift();
          onDelta(revealed);
        }, 24);
      };
      const flushReveal = () => {
        if (revealTimer) { clearInterval(revealTimer); revealTimer = null; }
        if (queue.length) {
          for (const c of queue) revealed += c;
          queue.length = 0;
          onDelta(revealed);
        }
      };

      try {
        let lastEventId = "";
        let progressed = false;

        const attempt = async (): Promise<void> => {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (lastEventId) headers["Last-Event-ID"] = lastEventId;

          const res = await fetch(`/api/chat/ai/${consultantId}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ conversationId, content: trimmed, opener: isOpener }),
            signal: abortCtrl.signal,
          });
          if (!res.ok || !res.body) {
            const body = await res.json().catch(() => ({})) as {
              error?: string; code?: string; required?: number; available?: number;
            };
            if (body?.code === "insufficient_balance" && onBilling) {
              onBilling({
                success: false,
                error: "insufficient_balance",
                required: body.required,
                available: body.available,
              });
            }
            const httpErr = new Error(body?.error || `HTTP ${res.status}`) as Error & { httpStatus?: number };
            httpErr.httpStatus = res.status;
            throw httpErr;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let acc = "";
          let finalMessage: ChatMessage | null = null;
          let gotDoneEvent = false;
          let wasTruncated = false;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("id: ")) { lastEventId = line.slice(4); continue; }
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data) as {
                  delta?: string;
                  filler?: string;
                  userMessageId?: string;
                  billing?: BillingInfo;
                  stage?: StageEvent;
                  stageDone?: boolean;
                  done?: boolean;
                  message?: ChatMessage | null;
                  fullText?: string;
                  truncated?: boolean;
                  suggestions?: Suggestion[];
                  profileUpdated?: ProfileUpdate;
                };
                if (parsed.userMessageId) {
                  progressed = true;
                  seenIds.current.add(parsed.userMessageId);
                  setMessages((prev) => prev.map((m) =>
                    m.id === tempId ? { ...m, id: parsed.userMessageId!, _optimistic: false } : m,
                  ));
                }
                if (parsed.billing && onBilling) onBilling(parsed.billing);
                if (parsed.profileUpdated && onProfileUpdated) onProfileUpdated(parsed.profileUpdated);
                if (parsed.filler && !acc) onFiller?.(parsed.filler);
                if (parsed.stage && onStage) onStage(parsed.stage);
                if (parsed.stageDone && onStageDone) onStageDone();
                if (parsed.delta) {
                  progressed = true;
                  acc += parsed.delta;
                  queue.push(parsed.delta);
                  startReveal();
                }
                if (parsed.done) {
                  gotDoneEvent = true;
                  wasTruncated = !!parsed.truncated;
                  if (parsed.message) finalMessage = parsed.message;
                  if (onSuggestions && Array.isArray(parsed.suggestions) && parsed.suggestions.length) {
                    onSuggestions(parsed.suggestions);
                  }
                }
              } catch { /* malformed chunk — skip */ }
            }
          }
          flushReveal();

          if (wasTruncated && acc) {
            onDelta(revealed + "\n\n_(Response was cut short — tap send again to continue)_");
          }

          if (finalMessage?.id) {
            mergeIncoming(finalMessage);
          } else if (acc) {
            setTimeout(() => setReloadKey((k) => k + 1), 500);
          } else if (!gotDoneEvent && !progressed) {
            onDelta("Connection dropped before the response started. Please try again.");
          }
        };

        for (let attempt_num = 0; attempt_num <= MAX_RETRIES; attempt_num++) {
          try {
            await attempt();
            break;
          } catch (err) {
            if ((err as { name?: string }).name === "AbortError") break;
            const status = (err as { httpStatus?: number }).httpStatus;
            const retryable =
              !progressed &&
              (status === undefined || status === 408 || status === 429 || status >= 500);
            if (retryable && attempt_num < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, (attempt_num + 1) * 1000));
              continue;
            }
            if (progressed) {
              setTimeout(() => setReloadKey((k) => k + 1), 500);
              break;
            }
            const msg = status === 401
              ? "Reconnecting — your session is refreshing."
              : status === 402 ? "Insufficient balance for this session."
              : status === 429 ? "Too many messages — wait a moment and try again."
              : status && status >= 500 ? "AI service is busy — please try again in a few seconds."
              : "I'm having trouble connecting right now. Please try again in a moment.";
            flushReveal();
            onDelta(msg);
            // A 401 from the proxy is almost always a transient @supabase/ssr
            // cookie hydration issue on Vercel's route handlers, not a real
            // logout — the user just sent a message, they *are* signed in.
            // Nudge the client to refresh, then retry once silently.
            if (status === 401 && attempt_num < MAX_RETRIES) {
              try { await fetch("/api/users/me/profile", { cache: "no-store" }); } catch { /* ignore */ }
              await new Promise((r) => setTimeout(r, 400));
              progressed = false;
              revealed = "";
              queue.length = 0;
              continue;
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(err instanceof Error ? err.message : "AI chat failed");
      } finally {
        if (revealTimer) { clearInterval(revealTimer); revealTimer = null; }
        setIsSending(false);
      }
    },
    [conversationId, currentUserId, mergeIncoming],
  );

  // ─── Load-older pagination (human rooms) ──────────────────────────────────
  // Fetches the page strictly older than the oldest held message and prepends
  // it. The caller restores scroll offset so history scrolls in place.
  const loadOlder = useCallback(async (): Promise<boolean> => {
    if (!conversationId || isLoadingOlder || messages.length === 0) return false;
    const oldest = messages[0];
    if (!oldest || oldest._optimistic) return false;
    setIsLoadingOlder(true);
    try {
      const r = await fetch(
        `/api/chat/${conversationId}/messages?limit=${pageSize}&before=${encodeURIComponent(oldest.createdAt)}`,
        { cache: "no-store" },
      );
      if (!r.ok) return false;
      const data = (await r.json()) as { messages?: ChatMessage[]; hasMore?: boolean };
      const older = (data.messages ?? []).filter((m) => m.id && !seenIds.current.has(m.id));
      older.forEach((m) => seenIds.current.add(m.id));
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
      }
      setHasMore(!!data.hasMore && older.length > 0);
      return older.length > 0;
    } catch {
      return false;
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, isLoadingOlder, messages, pageSize]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  return { messages, isLoading, isSending, error, hasMore, isLoadingOlder, loadOlder, send, sendToAI, retry };
}
