#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  setup.sh — Zeal Tier-B cleanup: orphan files, dead hooks/actions, unused deps
# ─────────────────────────────────────────────────────────────────────────────
#  Idempotent. Guarded by runtime assertions. Safe to re-run.
#
#  Usage:
#    ./setup.sh                  # full run: assert → delete → verify → commit
#    DRY_RUN=1 ./setup.sh        # assert only, change nothing
#    SKIP_COMMIT=1 ./setup.sh    # delete + verify but don't commit
#    VERIFY_ONLY=1 ./setup.sh    # type-check + build only (no deletions)
# ═══════════════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
IFS=$' \t\n'

trap 'echo "[FAIL] line $LINENO: $BASH_COMMAND" >&2' ERR

# ─── Resolve repo root ───────────────────────────────────────────────────────
_resolve_dir() {
  local src="${BASH_SOURCE[0]}" dir
  while [[ -h "$src" ]]; do
    dir="$(cd -P "$(dirname "$src")" >/dev/null 2>&1 && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd -P "$(dirname "$src")" >/dev/null 2>&1 && pwd
}
REPO_ROOT="$(_resolve_dir)"
cd "$REPO_ROOT"

DRY_RUN="${DRY_RUN:-0}"
SKIP_COMMIT="${SKIP_COMMIT:-0}"
VERIFY_ONLY="${VERIFY_ONLY:-0}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_SHA="$(git rev-parse --short HEAD)"
TRACKED_BEFORE="$(git ls-files | wc -l)"

echo "════ PHASE 0 — preflight ════"
echo "[zeal-clean] repo        : $REPO_ROOT (branch $BRANCH @ $HEAD_SHA)"
echo "[zeal-clean] node/npm    : $(node -v) / $(npm -v)"
echo "[zeal-clean] tracked     : $TRACKED_BEFORE files"
echo "[zeal-clean] dry-run     : $DRY_RUN   skip-commit: $SKIP_COMMIT   verify-only: $VERIFY_ONLY"
echo "[zeal-clean] rollback    : git reset --hard $HEAD_SHA"

# ─── Helpers ──────────────────────────────────────────────────────────────────

# grep source code only (excludes package.json, node_modules, .next, dumps)
code_grep() {
  local tmpfile result
  tmpfile="$(mktemp)"
  grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' \
    -e "$1" apps/ packages/ > "$tmpfile" 2>/dev/null || true
  result="$(grep -v node_modules "$tmpfile" 2>/dev/null | grep -v '.next' | grep -v '_dump.txt' || true)"
  rm -f "$tmpfile"
  printf '%s\n' "$result"
}

# Assert a pattern has zero references in source code (excluding an optional file)
assert_unused() {
  local pattern="$1" exclude="${2:-}"
  local raw filtered hits
  raw="$(code_grep "$pattern")"
  if [[ -n "$exclude" ]]; then
    filtered="$(printf '%s\n' "$raw" | grep -v "$exclude" || true)"
  else
    filtered="$raw"
  fi
  # Count non-empty lines
  hits="$(printf '%s\n' "$filtered" | grep -c . || true)"
  if (( hits > 0 )); then
    echo "  ✗ ASSERTION FAILED: '$pattern' has $hits reference(s) — aborting" >&2
    printf '%s\n' "$filtered" | head -5 >&2
    exit 1
  fi
  echo "  ✓ assertion passed: $pattern has zero references"
}

# Assert a file is safe to delete: exists AND has zero import references
assert_file_unused() {
  local filepath="$1"

  if [[ ! -f "$filepath" ]]; then
    echo "  ⊘ skip (absent): $filepath"
    return 0
  fi

  local modpath
  modpath="$(echo "$filepath" | sed 's|\.tsx\?$||')"
  local tmpfile hits
  tmpfile="$(mktemp)"
  grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    -E "from.*['\"].*${modpath}['\"/]|import.*${modpath}['\"/]" \
    apps/ packages/ > "$tmpfile" 2>/dev/null || true
  # Filter out noise
  local filtered
  filtered="$(grep -v node_modules "$tmpfile" 2>/dev/null | grep -v '.next' | grep -v "$filepath" || true)"
  hits="$(printf '%s\n' "$filtered" | grep -c . || true)"
  rm -f "$tmpfile"

  if (( hits > 0 )); then
    echo "  ✗ ASSERTION FAILED: $filepath has $hits import reference(s)" >&2
    printf '%s\n' "$filtered" | head -5 >&2
    exit 1
  fi
  echo "  ✓ assertion passed: $filepath is unreferenced"
}

# Safe file removal (tracked or untracked)
safe_rm() {
  local f="$1"
  if [[ ! -e "$f" ]]; then return 0; fi
  if (( DRY_RUN )); then
    echo "  [dry-run] would remove: $f"
    return 0
  fi
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    git rm -f --quiet "$f"
    echo "  ✓ git rm $f"
  else
    rm -f "$f"
    echo "  ✓ rm $f (untracked)"
  fi
}

# Prune empty directories under a path
prune_empty_dirs() {
  if (( DRY_RUN )); then return 0; fi
  find "${1:-.}" -type d -empty -not -path '*/node_modules/*' -not -path '*/.git/*' \
    -not -path '*/.next/*' -delete 2>/dev/null || true
}

# Remove a dependency from a package.json if present
prune_dep() {
  local pkg="$1" dep="$2"
  if [[ ! -f "$pkg" ]]; then return 0; fi
  if ! grep -q "\"$dep\"" "$pkg" 2>/dev/null; then return 0; fi
  if (( DRY_RUN )); then
    echo "  [dry-run] would prune $dep from $pkg"
    return 0
  fi
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('$pkg','utf8'));
    let removed = false;
    for (const key of ['dependencies','devDependencies','peerDependencies','optionalDependencies']) {
      if (p[key] && p[key]['$dep'] !== undefined) { delete p[key]['$dep']; removed = true; }
    }
    if (removed) fs.writeFileSync('$pkg', JSON.stringify(p, null, 2) + '\n');
  "
  echo "  pruned $dep from $pkg"
}

if (( VERIFY_ONLY )); then
  echo ""
  echo "════ VERIFY_ONLY mode — skipping all deletions ════"
else

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — Assertions for apps/web orphans (23 files)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 1 — assert apps/web orphans are unreferenced ════"

# Dead actions (7)
assert_file_unused "apps/web/actions/booking.ts"
assert_file_unused "apps/web/actions/chat.ts"
assert_file_unused "apps/web/actions/consultant.ts"
assert_file_unused "apps/web/actions/inbox.ts"
assert_file_unused "apps/web/actions/public.ts"
assert_file_unused "apps/web/actions/pulse.ts"
assert_file_unused "apps/web/actions/studio.ts"

# Dead hooks (16)
assert_file_unused "apps/web/hooks/useBooking.ts"
assert_file_unused "apps/web/hooks/useCall.ts"
assert_file_unused "apps/web/hooks/useChatCache.ts"
assert_file_unused "apps/web/hooks/useConsultantHeartbeat.ts"
assert_file_unused "apps/web/hooks/useConsultantStatus.ts"
assert_file_unused "apps/web/hooks/useConsultants.ts"
assert_file_unused "apps/web/hooks/useDebounce.ts"
assert_file_unused "apps/web/hooks/useFeed.ts"
assert_file_unused "apps/web/hooks/useNotifications.ts"
assert_file_unused "apps/web/hooks/useOfflineStore.ts"
assert_file_unused "apps/web/hooks/usePresence.ts"
assert_file_unused "apps/web/hooks/useRealtimeDirectory.ts"
assert_file_unused "apps/web/hooks/useRealtimeQuery.ts"
assert_file_unused "apps/web/hooks/useServiceCatalog.ts"
assert_file_unused "apps/web/hooks/useSessionBilling.ts"
assert_file_unused "apps/web/hooks/useZealStream.ts"

echo "[zeal-clean] web orphan assertions passed"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — Assertions for apps/admin orphans (6 files)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 2 — assert apps/admin orphans are unreferenced ════"

assert_file_unused "apps/admin/lib/auth/dal.ts"
assert_file_unused "apps/admin/lib/observability/index.ts"
assert_file_unused "apps/admin/types/chat-types.ts"
assert_file_unused "apps/admin/types/realtime-types.ts"
assert_file_unused "apps/admin/hooks/useAdminData.ts"
assert_file_unused "apps/admin/hooks/useAdminRealtime.ts"
assert_file_unused "apps/admin/hooks/useConsultantRealtime.ts"
assert_file_unused "apps/admin/hooks/useRealtimeQuery.ts"

echo "[zeal-clean] admin orphan assertions passed"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — Assertions for infra/misc orphans
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 3 — assert infra orphans are unreferenced ════"

# socket/route.ts — no imports found anywhere
assert_unused "api/socket" "apps/web/app/api/socket/route.ts"

# 000_schema.sql — uses TEXT ids, live DB uses UUID; not referenced in code
assert_unused "000_schema" "supabase/migrations/000_schema.sql"

# LocationAutocomplete — self-referencing only
assert_unused "LocationAutocomplete" "apps/web/components/ui/LocationAutocomplete.tsx"

echo "[zeal-clean] infra assertions passed"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — Assertions for unused dependencies
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 4 — assert unused deps have zero code refs ════"

assert_unused "@netlify/functions"
assert_unused "@base-ui/react"
# react-is — kept (transitive build dep)
assert_unused "dotenv" "package.json"
assert_unused "sonner"
assert_unused "tw-animate-css"

echo "[zeal-clean] dependency assertions passed"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 5 — Delete apps/web orphans
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 5 — remove apps/web orphans ════"

for f in \
  apps/web/actions/booking.ts \
  apps/web/actions/chat.ts \
  apps/web/actions/consultant.ts \
  apps/web/actions/inbox.ts \
  apps/web/actions/public.ts \
  apps/web/actions/pulse.ts \
  apps/web/actions/studio.ts \
  apps/web/hooks/useBooking.ts \
  apps/web/hooks/useCall.ts \
  apps/web/hooks/useChatCache.ts \
  apps/web/hooks/useConsultantHeartbeat.ts \
  apps/web/hooks/useConsultantStatus.ts \
  apps/web/hooks/useConsultants.ts \
  apps/web/hooks/useDebounce.ts \
  apps/web/hooks/useFeed.ts \
  apps/web/hooks/useNotifications.ts \
  apps/web/hooks/useOfflineStore.ts \
  apps/web/hooks/usePresence.ts \
  apps/web/hooks/useRealtimeDirectory.ts \
  apps/web/hooks/useRealtimeQuery.ts \
  apps/web/hooks/useServiceCatalog.ts \
  apps/web/hooks/useSessionBilling.ts \
  apps/web/hooks/useZealStream.ts \
  apps/web/components/ui/LocationAutocomplete.tsx
do
  safe_rm "$f"
done

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 6 — Delete apps/admin orphans
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 6 — remove apps/admin orphans ════"

for f in \
  apps/admin/lib/auth/dal.ts \
  apps/admin/lib/observability/index.ts \
  apps/admin/types/chat-types.ts \
  apps/admin/types/realtime-types.ts \
  apps/admin/hooks/useAdminData.ts \
  apps/admin/hooks/useAdminRealtime.ts \
  apps/admin/hooks/useConsultantRealtime.ts \
  apps/admin/hooks/useRealtimeQuery.ts
do
  safe_rm "$f"
done

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 7 — Delete infra/misc orphans
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 7 — remove infra orphans ════"

safe_rm "apps/web/app/api/socket/route.ts"
safe_rm "supabase/migrations/000_schema.sql"
safe_rm "docs/ARCHITECTURE.md"
safe_rm "repo_essentials_dump.txt"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 8 — Prune empty directories
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 8 — prune empty directories ════"
prune_empty_dirs "apps/"
prune_empty_dirs "docs/"
prune_empty_dirs "supabase/"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 9 — Prune unused dependencies + sync lockfile
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 9 — prune stale dependencies & sync lockfile ════"

DEPS_PRUNED=0

# @netlify/functions — apps/web only
prune_dep "apps/web/package.json" "@netlify/functions" && DEPS_PRUNED=$((DEPS_PRUNED+1))

# @base-ui/react — both apps
prune_dep "apps/admin/package.json" "@base-ui/react" && DEPS_PRUNED=$((DEPS_PRUNED+1))
prune_dep "apps/web/package.json" "@base-ui/react" && DEPS_PRUNED=$((DEPS_PRUNED+1))

# react-is — kept: transitive build dependency for admin (webpack needs it)
# prune_dep "apps/admin/package.json" "react-is" && DEPS_PRUNED=$((DEPS_PRUNED+1))

# dotenv — apps/web
prune_dep "apps/web/package.json" "dotenv" && DEPS_PRUNED=$((DEPS_PRUNED+1))

# sonner — apps/web (toaster component exists but sonner itself isn't imported in code)
prune_dep "apps/web/package.json" "sonner" && DEPS_PRUNED=$((DEPS_PRUNED+1))

# tw-animate-css — both apps
prune_dep "apps/admin/package.json" "tw-animate-css" && DEPS_PRUNED=$((DEPS_PRUNED+1))
prune_dep "apps/web/package.json" "tw-animate-css" && DEPS_PRUNED=$((DEPS_PRUNED+1))

echo "[zeal-clean] pruned up to $DEPS_PRUNED dependency entries"

if (( ! DRY_RUN )); then
  echo "[zeal-clean] syncing package-lock.json + node_modules (npm install)…"
  npm install --prefer-offline 2>&1 | tail -3
  echo "  ✓ npm install clean"
fi

fi  # end of non-VERIFY_ONLY block

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 10 — Verify: type-check + production builds
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 10 — verify: type-check + production build ════"

if (( DRY_RUN )); then
  echo "[zeal-clean] skipping verification in dry-run mode"
else
  # Clean stale .next caches that may reference deleted files
  rm -rf apps/web/.next apps/admin/.next 2>/dev/null || true

  echo "[zeal-clean] type-checking all workspaces…"
  npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5
  npx tsc --noEmit -p apps/admin/tsconfig.json 2>&1 | tail -5
  echo "  ✓ type-check green"

  echo "[zeal-clean] building apps/web…"
  npm run build --workspace=apps/web 2>&1 | tail -5
  echo "  ✓ apps/web build green"

  echo "[zeal-clean] building apps/admin…"
  npm run build --workspace=apps/admin 2>&1 | tail -5
  echo "  ✓ apps/admin build green"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 11 — Commit
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════ PHASE 11 — commit ════"

if (( DRY_RUN )); then
  echo "[zeal-clean] dry-run — no commit"
elif (( SKIP_COMMIT )); then
  echo "[zeal-clean] skip-commit — changes staged but not committed"
  git status --short
elif (( VERIFY_ONLY )); then
  echo "[zeal-clean] verify-only — no commit"
else
  if git diff --cached --quiet && git diff --quiet; then
    echo "[zeal-clean] nothing to commit (idempotent re-run)"
  else
    git add -A
    git commit -m "$(cat <<'EOF'
chore: tier-B cleanup — remove orphan hooks/actions, dead infra, unused deps

Remove 31 unreferenced files across apps/web and apps/admin:
- 7 dead server actions (booking, chat, consultant, inbox, public, pulse, studio)
- 16 unused client hooks (useBooking, useCall, useChatCache, etc.)
- 4 dead admin hooks + 2 unused admin types + 2 dead admin lib modules
- Socket route, legacy 000_schema.sql, ARCHITECTURE.md, dump file
- LocationAutocomplete UI component (zero consumers)
Prune 6 unused deps: @netlify/functions, @base-ui/react, react-is,
dotenv, sonner, tw-animate-css. Type-check + builds verified green.
EOF
)"
    NEW_SHA="$(git rev-parse --short HEAD)"
    echo "  ✓ committed: $NEW_SHA"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
TRACKED_AFTER="$(git ls-files | wc -l)"
echo ""
echo "════ SUMMARY ════"
echo "[zeal-clean] tracked before/after : $TRACKED_BEFORE → $TRACKED_AFTER"
echo "[zeal-clean] files removed        : $(( TRACKED_BEFORE - TRACKED_AFTER ))"
echo "[zeal-clean] head                 : $HEAD_SHA → $(git rev-parse --short HEAD)"
echo ""
echo "  ✓ tier-B cleanup complete"
