// ZEAL_PHASE2_FIX1
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// startChatFlow — single canonical chat entry-point across the platform
// ─────────────────────────────────────────────────────────────────────────────
// Callers pass `useRouter()` from next/navigation directly:
//
//   await startChatFlow(consultantId, { router, onLowBalance, onError });
//
// The `router` option is typed structurally so both AppRouterInstance and a
// mock in tests satisfy it without importing Next internals.
//
// Flow (in order):
//   1. Auth              → redirect to /login
//   2. Consultant lookup → /api/consultants/{id}/status
//   3. Online check      → humans must be online; AI bypasses
//   4. Wallet gate       → balance >= perMinuteRate
//   5. Conversation      → POST /api/chat/conversations (idempotent RPC)
//   6. Navigation        → /chat/{conversationId}
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimal structural type — matches Next's AppRouterInstance without importing it. */
export interface RouterLike {
  push: (href: string) => void;
}

export interface LowBalanceInfo {
  balance: number;
  required: number;
  consultantName: string;
  consultantId: string;
}

export interface OfflineInfo {
  consultantName: string;
}

export interface StartChatOptions {
  /** Router — pass the object returned by useRouter() directly. */
  router: RouterLike;
  /** Called when balance < rate. Caller opens WalletGateDialog. */
  onLowBalance?: (info: LowBalanceInfo) => void;
  /** Called on any non-gating failure (network, 404, 500). */
  onError?: (message: string) => void;
  /** Called when the consultant is a human who is currently offline. */
  onOffline?: (info: OfflineInfo) => void;
  /** Called around the entire flow — wire to button disabled/spinner state. */
  onLoading?: (loading: boolean) => void;
}

export type StartChatReason =
  | "auth"
  | "not_found"
  | "offline"
  | "low_balance"
  | "network"
  | "conversation_failed";

export type StartChatResult =
  | { ok: true; conversationId: string }
  | { ok: false; reason: StartChatReason };

export async function startChatFlow(
  consultantId: string,
  options: StartChatOptions,
): Promise<StartChatResult> {
  const { router, onLowBalance, onError, onOffline, onLoading } = options;
  onLoading?.(true);

  try {
    // ─── 1. Auth ──────────────────────────────────────────────────────────
    const meRes = await fetch("/api/users/me/profile", { cache: "no-store" });
    // 401 → genuinely unauth → redirect. Anything else → retryable error.
    if (meRes.status === 401) {
      const redirect =
        typeof window !== "undefined" ? window.location.pathname : "/explore";
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
      return { ok: false, reason: "auth" };
    }
    if (!meRes.ok) {
      onError?.(`Could not load your profile (HTTP ${meRes.status}). Please retry.`);
      return { ok: false, reason: "network" };
    }

    // ─── 2. Consultant ────────────────────────────────────────────────────
    const cRes = await fetch(`/api/consultants/${consultantId}/status`, {
      cache: "no-store",
    });
    if (!cRes.ok) {
      onError?.(
        cRes.status === 404 ? "Consultant unavailable" : "Could not load consultant",
      );
      return { ok: false, reason: "not_found" };
    }
    const consultant = (await cRes.json()) as {
      id: string;
      userId: string;
      name: string;
      is_online: boolean;
      perMinuteRate: number;
      isAI: boolean;
    };

    // ─── 3. Offline gate (AI bypasses) ────────────────────────────────────
    if (!consultant.is_online && !consultant.isAI) {
      onOffline?.({ consultantName: consultant.name });
      return { ok: false, reason: "offline" };
    }

    // ─── 4. Wallet gate ───────────────────────────────────────────────────
    const wRes = await fetch("/api/wallet/balance", { cache: "no-store" });
    if (!wRes.ok) {
      onError?.("Could not load wallet");
      return { ok: false, reason: "network" };
    }
    const walletData = (await wRes.json()) as { wallet?: { balance: number } };
    const balance = walletData.wallet?.balance ?? 0;
    const required = consultant.perMinuteRate;

    if (balance < required) {
      onLowBalance?.({
        balance,
        required,
        consultantName: consultant.name,
        consultantId,
      });
      return { ok: false, reason: "low_balance" };
    }

    // ─── 5. Conversation (idempotent) ─────────────────────────────────────
    const convRes = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: consultant.userId }),
    });
    if (!convRes.ok) {
      onError?.("Could not start conversation");
      return { ok: false, reason: "conversation_failed" };
    }
    const conv = (await convRes.json()) as { conversationId?: string };
    if (!conv.conversationId) {
      onError?.("No conversation returned");
      return { ok: false, reason: "conversation_failed" };
    }

    // ─── 6. Navigate ──────────────────────────────────────────────────────
    router.push(`/chat/${conv.conversationId}`);
    return { ok: true, conversationId: conv.conversationId };
  } catch (e) {
    onError?.(e instanceof Error ? e.message : "Network error");
    return { ok: false, reason: "network" };
  } finally {
    onLoading?.(false);
  }
}
