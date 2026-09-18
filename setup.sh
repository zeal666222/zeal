#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 2 BILLING FIX + ENTERPRISE WALLET/REALTIME
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

if [[ -t 1 ]]; then
  R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; B=$'\033[0;34m'
  M=$'\033[0;35m'; C=$'\033[0;36m'; D=$'\033[2m'; BOLD=$'\033[1m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; M=''; C=''; D=''; BOLD=''; N=''
fi
info() { printf "${B}[INFO]${N}    %s\n" "$1"; }
ok()   { printf "${G}[OK]${N}      %s\n" "$1"; }
warn() { printf "${Y}[WARN]${N}    %s\n" "$1"; }
err()  { printf "${R}[ERR]${N}     %s\n" "$1"; }
did()  { printf "${M}[FIXED]${N}   %s\n" "$1"; }
del()  { printf "${C}[DELETED]${N} %s\n" "$1"; }
sect() { printf "\n${BOLD}═══════════════════════════════════════════════════════════════${N}\n"; printf "${BOLD}  %s${N}\n" "$1"; printf "${BOLD}═══════════════════════════════════════════════════════════════${N}\n"; }

PASS=0; FAIL=0; FIXED=0; DELETED=0; TC_OK=1
pass()    { PASS=$((PASS+1)); ok "$1"; }
fail()    { FAIL=$((FAIL+1)); err "$1"; }
did_fix() { FIXED=$((FIXED+1)); did "$1"; }
did_del() { DELETED=$((DELETED+1)); del "$1"; }
to_int() { local v="${1:-0}"; v="$(printf '%s' "$v" | tr -d '[:space:]')"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { err "Not in a git repo"; exit 1; }
TS=$(date +%Y%m%d-%H%M%S)
BACKUP="_archive/phase2-billing-${TS}"
mkdir -p "$BACKUP"
backup() { [[ -f "$1" ]] && cp "$1" "$BACKUP/$(echo "$1" | sed 's|/|_|g').bak" 2>/dev/null || true; }

# ═══════════════════════════════════════════════════════════════════════════════
sect "1/6 — RESOLVE apps/web/components/billing/BillingHistory.tsx"
# ═══════════════════════════════════════════════════════════════════════════════

BH="apps/web/components/billing/BillingHistory.tsx"

if [[ -f "$BH" ]]; then
  # Re-verify: any live consumers?
  CONSUMERS=$(grep -rln "BillingHistory" apps/web \
    --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -v "$BH" | grep -v "_archive" || true)

  if [[ -z "$CONSUMERS" ]]; then
    # Truly orphan → delete (this is what the previous script INTENDED)
    rm -f "$BH"
    did_del "$BH (orphan — no consumers)"
  else
    # Some page uses it → rewrite with @zeal/realtime
    warn "BillingHistory is used by: $(echo "$CONSUMERS" | tr '\n' ' ')"
    backup "$BH"
    cat > "$BH" << 'BH_EOF'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// BillingHistory — wallet ledger viewer
// Realtime: subscribes to the full Wallet row (balance + escrow + pending*)
// Refetches ledger entries on any wallet mutation. Never trusts a stale balance.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Receipt, Loader2, Clock,
} from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

// Full Wallet row — subscribe to every field, not just balance
interface WalletRow {
  userId?: string;
  balance?: number;
  escrow?: number;
  pendingIn?: number;
  pendingOut?: number;
  blocked?: number;
}

export function BillingHistory({
  userId,
  walletId,
}: {
  userId: string;
  walletId: string;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/transactions?limit=20", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { transactions?: LedgerEntry[] };
        setEntries(data.transactions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!walletId) { setLoading(false); return; }
    void load();
  }, [walletId, load]);

  // Subscribe to the full Wallet row — balance, escrow, pending*, blocked
  // all update within the same transaction, so the UI stays consistent.
  useChannel<BroadcastChange<WalletRow>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: () => { void load(); },
  });

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-gray-500" /> Billing History
        </h3>
        <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
          Last 20 entries
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No ledger entries yet.
          </div>
        ) : (
          entries.map((e) => {
            const isCredit = ["CREDIT", "TOPUP", "EARNING", "REFUND", "COMMISSION"].includes(e.type);
            return (
              <div key={e.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${isCredit ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                    {isCredit ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{e.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Clock size={12} />
                      {new Date(e.createdAt).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isCredit ? "text-green-600" : "text-gray-900"}`}>
                    {isCredit ? "+" : "-"}₹{Math.abs(e.amount).toFixed(2)}
                  </p>
                  <p className="text-xs font-medium text-gray-400 mt-1">
                    Bal: ₹{e.balance.toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
BH_EOF
    did_fix "$BH rewritten (uses full-row subscription + @zeal/realtime)"
  fi
else
  pass "BillingHistory already removed"
fi

# ═══════════════════════════════════════════════════════════════════════════════
sect "2/6 — UPGRADE useWallet hook to expose full Wallet state"
# ═══════════════════════════════════════════════════════════════════════════════

WALLET_HOOK="apps/web/hooks/useWallet.ts"
backup "$WALLET_HOOK"

cat > "$WALLET_HOOK" << 'WALLET_EOF'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useWallet — Real-time wallet + ledger
// ─────────────────────────────────────────────────────────────────────────────
// Design invariants (enterprise-grade):
//   • Subscribe to the FULL Wallet row, not just balance. Balance, escrow,
//     pendingIn/pendingOut, blocked all update in the same transaction —
//     partial subscription causes visible UI inconsistency.
//   • Never accept optimistic balance — always refetch ledger from server.
//   • Refetch on any wallet broadcast (single source of truth = DB).
//   • Idempotency: the server-side RPC guarantees exactly-once mutation.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface WalletState {
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface WalletRow {
  userId?: string;
  balance?: number;
  escrow?: number;
  pendingIn?: number;
  pendingOut?: number;
  blocked?: number;
}

const EMPTY_WALLET: WalletState = {
  balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0,
};

export function useWallet(userId: string | null) {
  const [wallet, setWallet] = useState<WalletState>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/wallet/balance", { cache: "no-store" }),
        fetch("/api/wallet/transactions?limit=20", { cache: "no-store" }),
      ]);
      if (balRes.ok) {
        const b = await balRes.json();
        const w = b?.wallet;
        if (w) {
          setWallet({
            balance: Number(w.balance ?? 0),
            escrow: Number(w.escrow ?? 0),
            pendingIn: Number(w.pendingIn ?? 0),
            pendingOut: Number(w.pendingOut ?? 0),
            blocked: Number(w.blocked ?? 0),
          });
        }
      }
      if (txRes.ok) {
        const t = await txRes.json();
        if (Array.isArray(t?.transactions)) setTransactions(t.transactions);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, refresh]);

  // Full-row subscription — any field change triggers a refetch
  useChannel<BroadcastChange<WalletRow>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: () => { void refresh(); },
  });

  return {
    // Full state (preferred)
    wallet,
    // Backward-compatible scalar
    balance: wallet.balance,
    transactions,
    loading,
    refresh,
  };
}
WALLET_EOF
did_fix "useWallet upgraded (full Wallet state + refetch-on-broadcast)"

# ═══════════════════════════════════════════════════════════════════════════════
sect "3/6 — ADD RLS-safe broadcast for Transaction (ledger stream)"
# ═══════════════════════════════════════════════════════════════════════════════

mkdir -p supabase/migrations

cat > supabase/migrations/024_phase2_ledger_broadcast.sql << 'SQL_EOF'
-- ═══════════════════════════════════════════════════════════════════════════════
-- 024_phase2_ledger_broadcast.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Enterprise ledger realtime:
--   • REPLICA IDENTITY FULL on Wallet + Transaction (so DELETE/UPDATE carry
--     the previous row — clients need it for reconciliation).
--   • Broadcast Wallet changes to user:{uid}:wallet (already exists via 019).
--   • Broadcast Transaction inserts to user:{uid}:wallet:ledger so the UI can
--     append entries without a round-trip.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Replica identity FULL on financial tables ────────────────────────────
ALTER TABLE public."Wallet" REPLICA IDENTITY FULL;
ALTER TABLE public."Transaction" REPLICA IDENTITY FULL;

-- ─── 2. Broadcast new ledger entries to the wallet owner ─────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id text;
BEGIN
  -- Resolve the wallet owner
  SELECT "userId"::text INTO owner_id
  FROM public."Wallet"
  WHERE id = NEW."walletId";

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Broadcast the ledger entry to the owner's private channel
  PERFORM realtime.broadcast_changes(
    'user:' || owner_id || ':wallet:ledger',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_ledger_entry ON public."Transaction";
CREATE TRIGGER trg_broadcast_ledger_entry
  AFTER INSERT ON public."Transaction"
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_ledger_entry();

-- ─── 3. Idempotency index on Transaction.referenceId ─────────────────────────
-- (already exists per migration 000 but ensure it survives)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_reference_unique
  ON public."Transaction"("referenceId")
  WHERE "referenceId" IS NOT NULL;

-- ─── 4. Ensure Wallet + Transaction are in realtime publication ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'Wallet'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Wallet";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'Transaction'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Transaction";
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '  024_phase2_ledger_broadcast.sql — OK';
  RAISE NOTICE '  Replica identity FULL: Wallet, Transaction';
  RAISE NOTICE '  Broadcast: user:{uid}:wallet:ledger';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
SQL_EOF
did_fix "supabase/migrations/024_phase2_ledger_broadcast.sql"

# ═══════════════════════════════════════════════════════════════════════════════
sect "4/6 — SANITY: zero postgres_changes + BillingHistory gone"
# ═══════════════════════════════════════════════════════════════════════════════

PC=$(grep -rln "postgres_changes" apps packages \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "_archive" || true)
if [[ -z "$PC" ]]; then
  pass "Zero postgres_changes"
else
  warn "postgres_changes still in: $(echo "$PC" | tr '\n' ' ')"
fi

if [[ ! -f "apps/web/components/billing/BillingHistory.tsx" ]]; then
  pass "BillingHistory removed"
elif ! grep -q "providers/RealtimeProvider" "apps/web/components/billing/BillingHistory.tsx" 2>/dev/null; then
  pass "BillingHistory rewritten (no stale import)"
else
  fail "BillingHistory still imports the deleted provider"
fi

# ═══════════════════════════════════════════════════════════════════════════════
sect "5/6 — TYPECHECK GATE"
# ═══════════════════════════════════════════════════════════════════════════════

npm install --legacy-peer-deps >/dev/null 2>&1 || warn "npm install had issues"

for ws in packages/realtime packages/database apps/web apps/admin; do
  info "Type-checking $ws..."
  pushd "$ws" >/dev/null
  log="/tmp/zeal-p2bill-$(echo "$ws" | tr '/' '_').log"
  if npx --no-install tsc --noEmit --pretty false > "$log" 2>&1; then
    pass "$ws clean"
  else
    n=$(to_int "$(grep -c 'error TS' "$log")")
    fail "$ws: $n errors"
    grep 'error TS' "$log" | head -20 | sed 's/^/    /'
    TC_OK=0
  fi
  popd >/dev/null
done

# ═══════════════════════════════════════════════════════════════════════════════
sect "6/6 — COMMIT + PUSH"
# ═══════════════════════════════════════════════════════════════════════════════

git add -A 2>/dev/null
git reset -- _archive/ 2>/dev/null || true

SECRETS=$(git diff --cached --name-only -z 2>/dev/null \
  | grep -zv '\.sh$' | grep -zv '^_archive/' \
  | xargs -0 -r grep -lE \
      "eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{40,}" \
      2>/dev/null || true)
[[ -n "$SECRETS" ]] && { fail "SECRETS DETECTED: $SECRETS"; exit 1; }
pass "No secrets in staged content"

if [[ "$TC_OK" != "1" ]]; then
  fail "Type-check failed — NOT committed"
  echo "  Logs:"; echo "    /tmp/zeal-p2bill-apps_web.log"
  exit 1
fi

if git diff --cached --quiet; then
  pass "Nothing to commit — tree already clean"
  exit 0
fi

git commit -m "Phase 2 final: billing ledger + enterprise wallet realtime

BillingHistory.tsx:
- Previous script's orphan branch only printed a message for this file
  (did_del prints; rm was missing) → file remained, importing the
  deleted @/providers/RealtimeProvider.
- Now properly deleted (no live consumers) or rewritten with the full-row
  wallet subscription pattern.

useWallet.ts:
- Exposes full WalletState (balance, escrow, pendingIn, pendingOut, blocked)
- Subscribes to the FULL Wallet row, not just balance — all fields update
  in the same transaction and the UI must reflect them simultaneously.
- Refetches the ledger on any wallet broadcast; never trusts an optimistic
  client-side balance for financial state.

024_phase2_ledger_broadcast.sql:
- REPLICA IDENTITY FULL on Wallet + Transaction
  (clients receive old_record for UPDATE/DELETE reconciliation)
- New trigger: broadcast_ledger_entry → user:{uid}:wallet:ledger
- Ensures both tables are in supabase_realtime publication
- Idempotency index on Transaction.referenceId preserved" 2>&1 | tail -3

pass "Commit: $(git rev-parse --short HEAD)"
info "Pushing to origin/main..."
git push origin main 2>&1 | tail -5

sect "SUMMARY"
echo ""
printf "  ${G}Passed:${N}      %d\n" "$PASS"
printf "  ${M}Fixed:${N}       %d\n" "$FIXED"
printf "  ${C}Deleted:${N}     %d\n" "$DELETED"
[[ $FAIL -gt 0 ]] && printf "  ${R}Failed:${N}      %d\n" "$FAIL" || printf "  ${D}Failed:      0${N}\n"
printf "  ${BOLD}Type-check:${N}  %s\n" "$([[ $TC_OK -eq 1 ]] && echo PASS || echo FAIL)"
echo ""
exit $([[ $FAIL -eq 0 && $TC_OK -eq 1 ]] && echo 0 || echo 1)