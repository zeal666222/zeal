#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — TYPECHECK DIAGNOSTIC (v2 — fixed path resolution)
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || { echo "Not in a git repo"; exit 1; }

REPO_ROOT="$PWD"

if [[ -t 1 ]]; then
  R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'
  B=$'\033[0;34m'; D=$'\033[2m'; BOLD=$'\033[1m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; D=''; BOLD=''; N=''
fi

TS=$(date +%Y%m%d-%H%M%S)
LOGDIR="${REPO_ROOT}/_archive/typecheck-${TS}"
mkdir -p "$LOGDIR"

printf "\n%s╔═══════════════════════════════════════════════════════════════════════╗%s\n" "$BOLD" "$N"
printf "%s║   ZEAL — TYPECHECK DIAGNOSTIC                                         ║%s\n" "$BOLD" "$N"
printf "%s╚═══════════════════════════════════════════════════════════════════════╝%s\n" "$BOLD" "$N"

WORKSPACES=(
  "packages/types"
  "packages/utils"
  "packages/ui"
  "packages/database"
  "apps/web"
  "apps/admin"
)

FAILED=()
PASSED=()
SKIPPED=()

for ws in "${WORKSPACES[@]}"; do
  printf "\n%s═══ %s ═══%s\n" "$BOLD" "$ws" "$N"

  WS_ABS="${REPO_ROOT}/${ws}"
  LOGFILE="${LOGDIR}/$(echo "$ws" | tr '/' '_').log"

  if [[ ! -d "$WS_ABS" ]]; then
    printf "%s[SKIP]%s Directory not present\n" "$Y" "$N"
    SKIPPED+=("$ws")
    continue
  fi
  if [[ ! -f "${WS_ABS}/tsconfig.json" ]]; then
    printf "%s[SKIP]%s No tsconfig.json\n" "$Y" "$N"
    SKIPPED+=("$ws")
    continue
  fi

  # Verify tsc is available
  if ! (cd "$WS_ABS" && npx --no-install tsc --version >/dev/null 2>&1); then
    printf "%s[SKIP]%s tsc not installed in workspace\n" "$Y" "$N"
    SKIPPED+=("$ws")
    continue
  fi

  printf "%s[INFO]%s Running tsc --noEmit...\n" "$B" "$N"
  start=$(date +%s)

  # Run tsc inside subshell — absolute log path, no pushd needed
  if (cd "$WS_ABS" && npx --no-install tsc --noEmit --pretty false) > "$LOGFILE" 2>&1; then
    elapsed=$(($(date +%s) - start))
    printf "%s[PASS]%s %s (%ds)\n" "$G" "$N" "$ws" "$elapsed"
    PASSED+=("$ws")
  else
    elapsed=$(($(date +%s) - start))
    err_count=$(grep -c 'error TS' "$LOGFILE" 2>/dev/null || echo 0)
    err_count="${err_count//[[:space:]]/}"
    [[ -z "$err_count" ]] && err_count=0

    printf "%s[FAIL]%s %s (%s errors, %ds)\n" "$R" "$N" "$ws" "$err_count" "$elapsed"
    FAILED+=("$ws")

    # Show first 30 errors
    if [[ "$err_count" -gt 0 ]]; then
      printf "\n  %sErrors:%s\n" "$BOLD" "$N"
      grep 'error TS' "$LOGFILE" 2>/dev/null | head -30 | while IFS= read -r line; do
        printf "    %s\n" "$line"
      done
      if [[ "$err_count" -gt 30 ]]; then
        printf "    %s... and %d more%s\n" "$D" "$((err_count - 30))" "$N"
      fi
    else
      # Non-TS error (build crash, missing dep, etc.) — show raw tail
      printf "\n  %sNon-TS failure — last 15 lines of output:%s\n" "$BOLD" "$N"
      tail -15 "$LOGFILE" 2>/dev/null | while IFS= read -r line; do
        printf "    %s\n" "$line"
      done
    fi
  fi
done

# ─── Summary ─────────────────────────────────────────────────────────────────
printf "\n%s╔═══════════════════════════════════════════════════════════════════════╗%s\n" "$BOLD" "$N"
printf "%s║   SUMMARY                                                             ║%s\n" "$BOLD" "$N"
printf "%s╚═══════════════════════════════════════════════════════════════════════╝%s\n" "$BOLD" "$N"

if [[ ${#PASSED[@]} -gt 0 ]]; then
  printf "\n%sPassed (%d):%s\n" "$G" "${#PASSED[@]}" "$N"
  for ws in "${PASSED[@]}"; do printf "  %s✓%s %s\n" "$G" "$N" "$ws"; done
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  printf "\n%sSkipped (%d):%s\n" "$Y" "${#SKIPPED[@]}" "$N"
  for ws in "${SKIPPED[@]}"; do printf "  %s○%s %s\n" "$Y" "$N" "$ws"; done
fi

if [[ ${#FAILED[@]} -gt 0 ]]; then
  printf "\n%sFailed (%d):%s\n" "$R" "${#FAILED[@]}" "$N"
  for ws in "${FAILED[@]}"; do printf "  %s✗%s %s\n" "$R" "$N" "$ws"; done
fi

printf "\n%sLogs: %s%s\n\n" "$D" "$LOGDIR" "$N"

[[ ${#FAILED[@]} -eq 0 ]] && exit 0 || exit 1
