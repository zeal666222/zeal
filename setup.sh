#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 2 TYPE-FIX
# ═══════════════════════════════════════════════════════════════════════════════
# Root cause: start-chat-flow.ts on disk is the v1 signature (accepts an
# AppRouterInstance), but every caller was upgraded to the v2 options-object
# signature. This script force-rewrites start-chat-flow.ts with the correct
# v2 contract and bumps the marker to ZEAL_PHASE2_FIX1 so the fix is itself
# idempotent.
#
# After this, run:  npm run type-check --workspace=apps/web
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
IFS=$'\n\t'

# ─── Colors ──────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  R=$'\033[0m'; B=$'\033[1m'; D=$'\033[2m'
  RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'
  CYN=$'\033[36m'; GLD=$'\033[38;5;179m'
else
  R=""; B=""; D=""; RED=""; GRN=""; YEL=""; CYN=""; GLD=""
fi

# ─── Locate repo root ───────────────────────────────────────────────────────
detect_root() {
  if command -v git >/dev/null 2>&1; then
    local g; g="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [ -n "$g" ] && [ -f "$g/package.json" ] && [ -d "$g/apps/web" ]; then
      printf '%s' "$g"; return 0
    fi
  fi
  local dir; dir="$(pwd)"
  while [ "$dir" != "/" ] && [ -n "$dir" ]; do
    if [ -f "$dir/package.json" ] && [ -d "$dir/apps/web" ]; then
      printf '%s' "$dir"; return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

ROOT="$(detect_root || true)"
[ -n "$ROOT" ] || { printf '%s✗ Not inside a Zeal monorepo%s\n' "$RED" "$R" >&2; exit 1; }
cd "$ROOT"

TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/.zeal-backup/phase2-fix-$TS"
mkdir -p "$BK"
LOG="$BK/fix.log"
touch "$LOG"

say()  { printf '%s\n' "$*" | tee -a "$LOG"; }
ok()   { printf '%s✓%s %s\n' "$GRN" "$R" "$*" | tee -a "$LOG"; }
info() { printf '%s▸%s %s\n' "$CYN" "$R" "$*" | tee -a "$LOG"; }
warn() { printf '%s⚠%s %s\n' "$YEL" "$R" "$*" | tee -a "$LOG"; }
err()  { printf '%s✗%s %s\n' "$RED" "$R" "$*" | tee -a "$LOG" >&2; }
die()  { err "$*"; exit 1; }

say ""
say "${B}════════════════════════════════════════════════════════════${R}"
say "${B}${GLD}  ZEAL — PHASE 2 TYPE-FIX${R}"
say "${B}════════════════════════════════════════════════════════════${R}"
say "  Repo   : ${CYN}$ROOT${R}"
say "  Backup : ${CYN}$BK${R}"
say "  Log    : ${CYN}$LOG${R}"
say ""

# ═══════════════════════════════════════════════════════════════════════════════
info "▸ Pre-flight"
# ═══════════════════════════════════════════════════════════════════════════════

command -v node >/dev/null 2>&1 || die "node missing"
command -v npm  >/dev/null 2>&1 || die "npm missing"

TARGET="apps/web/lib/chat/start-chat-flow.ts"
FULL="$ROOT/$TARGET"
[ -f "$FULL" ] || die "target file missing: $TARGET"

# Detect current signature (report only — we overwrite regardless)
if grep -q "AppRouterInstance" "$FULL" 2>/dev/null; then
  warn "detected v1 signature (AppRouterInstance) — will be replaced"
else
  info "current file does not reference AppRouterInstance"
fi
if grep -q "LowBalanceInfo" "$FULL" 2>/dev/null; then
  info "LowBalanceInfo already present — will still verify signature"
else
  warn "LowBalanceInfo missing — will be added"
fi

# Skip if already fixed (marker check)
if head -3 "$FULL" | grep -q "ZEAL_PHASE2_FIX1" 2>/dev/null; then
  ok "$TARGET already contains ZEAL_PHASE2_FIX1 — skipping rewrite"
else
  # ═══════════════════════════════════════════════════════════════════════════
  info "▸ Rewriting $TARGET"
  # ═══════════════════════════════════════════════════════════════════════════

  # Backup
  cp -p "$FULL" "$BK/${TARGET//\//__}" 2>/dev/null || true

  STAGE="$BK/stage-start-chat-flow.ts"
  cat > "$STAGE" <<'ZEOF'
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
    if (!meRes.ok) {
      const redirect =
        typeof window !== "undefined" ? window.location.pathname : "/explore";
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
      return { ok: false, reason: "auth" };
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
ZEOF

  cp "$STAGE" "$FULL"
  ok "wrote $TARGET (ZEAL_PHASE2_FIX1)"

  # ─── Verify contract ────────────────────────────────────────────────────
  for pattern in "LowBalanceInfo" "RouterLike" "StartChatOptions" "ZEAL_PHASE2_FIX1"; do
    grep -q "$pattern" "$FULL" || die "verification failed: $TARGET missing '$pattern'"
  done
  ok "contract verified (LowBalanceInfo, RouterLike, StartChatOptions)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
info "▸ Type-check apps/web"
# ═══════════════════════════════════════════════════════════════════════════════

cd "$ROOT/apps/web"
if npm run --silent type-check 2>&1 | tee -a "$LOG"; then
  ok "type-check passed"
else
  err "type-check still failing — inspect $LOG"
  err "Restore: cp $BK/* $ROOT/apps/web/lib/chat/  (if needed)"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
say ""
say "${B}${GLD}════════════════════════════════════════════════════════════${R}"
say "${B}${GRN}  ✓ PHASE 2 TYPE-FIX COMPLETE${R}"
say "${B}${GLD}════════════════════════════════════════════════════════════${R}"
say ""
say "  Next steps"
say "  ──────────────────────────────────────────────────────────"
say "  1. Verify locally:"
say "       ${CYN}npm run dev --workspace=apps/web${R}"
say "  2. Smoke test workflows:"
say "       ${D}•${R} Homepage → click any consultant → profile renders"
say "       ${D}•${R} Profile → Chat (rich wallet) → lands in chat"
say "       ${D}•${R} Profile → Chat (empty wallet) → WalletGateDialog"
say "       ${D}•${R} Services → Ask Zeal → 2-3 consultant cards appear → click"
say "  3. Commit:"
say "       ${CYN}git add -A && git commit -m 'phase2-fix: startChatFlow v2 signature'${R}"
say ""