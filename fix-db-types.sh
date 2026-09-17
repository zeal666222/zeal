#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — packages/database cleanup (v2)
# ═══════════════════════════════════════════════════════════════════════════════
# Precise dead-code detection:
#   • External imports: only matches @zeal/database/<name> (scoped)
#   • Internal imports: only from packages/database/src/*.ts
#   • Never false-positives on @/lib/<name> or unrelated paths
#
# Idempotent. Safe to re-run.
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /d/zeal)" || exit 1

R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'
B=$'\033[0;34m'; M=$'\033[0;35m'; D=$'\033[2m'; BOLD=$'\033[1m'; N=$'\033[0m'
[[ ! -t 1 ]] && { R=''; G=''; Y=''; B=''; M=''; D=''; BOLD=''; N=''; }

PASS=0; FAIL=0; SKIP=0; FIXED=0
pass() { PASS=$((PASS+1)); printf "%s[OK]%s      %s\n" "$G" "$N" "$1"; }
fail() { FAIL=$((FAIL+1)); printf "%s[ERR]%s     %s\n" "$R" "$N" "$1"; }
skip() { SKIP=$((SKIP+1)); printf "%s[SKIP]%s    %s\n" "$Y" "$N" "$1"; }
did()  { FIXED=$((FIXED+1)); printf "%s[FIXED]%s   %s\n" "$M" "$N" "$1"; }
sect() { printf "\n%s═══ %s ═══%s\n" "$BOLD" "$1" "$N"; }

TS=$(date +%Y%m%d-%H%M%S)
BACKUP="_archive/db-cleanup-${TS}"
mkdir -p "$BACKUP"

printf "\n%s╔═══════════════════════════════════════════════════════════════╗%s\n" "$BOLD" "$N"
printf "%s║   ZEAL — packages/database cleanup v2                          ║%s\n" "$BOLD" "$N"
printf "%s╚═══════════════════════════════════════════════════════════════╝%s\n" "$BOLD" "$N"

[[ -d "packages/database/src" ]] || { fail "Not at repo root"; exit 1; }
pass "Repo: $(pwd)"

cp -r "packages/database/src" "$BACKUP/src" 2>/dev/null && pass "Backed up to $BACKUP"

# ─────────────────────────────────────────────────────────────────────────────
# PRECISE DEAD-CODE CHECK
# ─────────────────────────────────────────────────────────────────────────────
_is_dead() {
  local rel_path="$1"                    # e.g. packages/database/src/services
  local basename                      # e.g. services or admin
  basename="$(basename "$rel_path" .ts)"

  # 1. External: scoped package import @zeal/database/<basename>
  #    Only matches when preceded by @zeal/database/ — NOT @/lib/
  if grep -rqE "['\"]@zeal/database/${basename}(['\"]|/)" \
       apps packages --include="*.ts" --include="*.tsx" 2>/dev/null; then
    return 1  # alive
  fi

  # 2. Internal relative imports from packages/database/src/*.ts
  #    (top-level files only — excludes the target's own directory)
  local top
  for top in packages/database/src/*.ts; do
    [[ -f "$top" ]] || continue
    if grep -qE "['\"]\./${basename}(['\"]|/)" "$top" 2>/dev/null; then
      return 1  # alive
    fi
  done

  return 0  # dead
}

# ─────────────────────────────────────────────────────────────────────────────
sect "Step 1 — Delete dead code (precise detection)"
# ─────────────────────────────────────────────────────────────────────────────
for target in \
  "packages/database/src/admin.ts" \
  "packages/database/src/helpers" \
  "packages/database/src/queries" \
  "packages/database/src/services" \
  "packages/database/src/auth-sync.ts" \
  "packages/database/src/schemas.ts" \
  "packages/database/src/models.ts"; do

  if [[ ! -e "$target" ]]; then
    skip "$target — not present"
    continue
  fi

  if _is_dead "$target"; then
    cp -r "$target" "$BACKUP/$(basename "$target")" 2>/dev/null || true
    rm -rf "$target"
    did "Deleted $target (dead code)"
  else
    skip "$target — actually used elsewhere"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
sect "Step 2 — Ensure types.ts has enum exports"
# ─────────────────────────────────────────────────────────────────────────────
if [[ -f packages/database/src/types.ts ]]; then
  if grep -q 'export type Role' packages/database/src/types.ts && \
     grep -q 'export type ConsultantStatus' packages/database/src/types.ts; then
    pass "types.ts already exports Role + ConsultantStatus"
  else
    cat > packages/database/src/types.ts << 'TYPES_EOF'
// packages/database/src/types.ts
// Canonical type aliases for the Zeal database layer.
import type { Database, Json } from "@zeal/types";

export type { Database, Json };

export type Role =
  | "USER" | "CLIENT_ADMIN" | "SUPPORT" | "ADMIN"
  | "SUPER_ADMIN" | "VIEWER" | "AI";

export type ConsultantStatus =
  | "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";

export type ConsultantCategory =
  | "ASTROLOGER" | "PSYCHOLOGIST" | "TAROT" | "NUMEROLOGIST"
  | "PALMIST" | "VASTU" | "REIKI" | "LIFE_COACH"
  | "MOTIVATIONAL_SPEAKER" | "SPIRITUAL_GUIDE"
  | "YOGA_INSTRUCTOR" | "HEALER";

export type Faith =
  | "HINDU" | "ISLAM" | "CHRISTIAN" | "BUDDHIST"
  | "JEWISH" | "SIKH" | "OTHER";

export type BookingStatus =
  | "PENDING" | "CONFIRMED" | "IN_PROGRESS"
  | "COMPLETED" | "CANCELLED" | "MISSED" | "DISPUTED";

export type CallStatus =
  | "INITIATED" | "CONNECTED" | "ENDED" | "RECORDING_READY";

export type TransactionType =
  | "TOPUP" | "PAYMENT" | "REFUND"
  | "PAYOUT" | "FEE" | "COMMISSION";
TYPES_EOF
    did "Rewrote types.ts"
  fi
else
  fail "types.ts missing"
fi

# ─────────────────────────────────────────────────────────────────────────────
sect "Step 3 — Clean stale imports in server.ts"
# ─────────────────────────────────────────────────────────────────────────────
if [[ -f packages/database/src/server.ts ]]; then
  # Remove dangling re-exports
  for stale in auth-sync admin helpers queries services schemas models; do
    if grep -qE "from \"\./${stale}\"" packages/database/src/server.ts 2>/dev/null; then
      sed -i "/from \"\.\/${stale}/d" packages/database/src/server.ts
      did "Removed stale import: ./${stale}"
    fi
  done
  pass "server.ts cleaned"
fi

# ─────────────────────────────────────────────────────────────────────────────
sect "Step 4 — Type-check packages/database"
# ─────────────────────────────────────────────────────────────────────────────
TC_LOG="/tmp/zeal-db-tc-${TS}.log"
pushd packages/database >/dev/null
if npx --no-install tsc --noEmit --pretty false > "$TC_LOG" 2>&1; then
  pass "packages/database type-checks clean"
  TC_OK=1
else
  ERR=$(grep -c 'error TS' "$TC_LOG" 2>/dev/null || echo 0)
  ERR="${ERR//[[:space:]]/}"; [[ -z "$ERR" ]] && ERR=0
  fail "packages/database: $ERR errors"
  echo ""
  grep 'error TS' "$TC_LOG" | head -25 | sed 's/^/    /'
  [[ "$ERR" -gt 25 ]] && echo "    ... and $((ERR - 25)) more"
  TC_OK=0
fi
popd >/dev/null

# ─────────────────────────────────────────────────────────────────────────────
sect "SUMMARY"
# ─────────────────────────────────────────────────────────────────────────────
printf "  %sPassed:%s   %d\n" "$G" "$N" "$PASS"
printf "  %sFixed:%s    %d\n" "$M" "$N" "$FIXED"
printf "  %sSkipped:%s  %d\n" "$Y" "$N" "$SKIP"
[[ $FAIL -gt 0 ]] && printf "  %sFailed:%s   %d\n" "$R" "$N" "$FAIL" || printf "  %sFailed:   0%s\n" "$D" "$N"
printf "\n  %sBackups:%s  %s\n\n" "$BOLD" "$N" "$BACKUP"

[[ "${TC_OK:-0}" == "1" ]] && exit 0 || exit 1
