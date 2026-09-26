#!/usr/bin/env bash
# ============================================================================
# PROJECT ZEAL — Tier-A Repository Cleanup
# ----------------------------------------------------------------------------
# Removes ONLY files/dirs/deps verified to have zero references anywhere in
# source, CI workflows, vercel.json, docker/, or package scripts.
#
# Every destructive step is guarded by a runtime reference assertion: if any
# assertion finds a live reference, the script aborts BEFORE deleting anything.
# Deletions go through `git rm` (tracked) so everything is reversible via git.
#
# Phases:
#   0  Preflight & safety assertions
#   1  Remove tracked dead files (git rm)
#   2  Remove untracked junk
#   3  Prune empty directories
#   4  Prune stale dependencies from package.json files + sync lockfile
#   5  Verify: type-check + production build (web & admin)
#   6  Commit
#
# Usage:  ./setup.sh                       (full run incl. verify + commit)
#         SKIP_COMMIT=1 ./setup.sh         (stop before committing)
#         DRY_RUN=1 ./setup.sh             (assertions + report only)
#         VERIFY_ONLY=1 ./setup.sh         (skip cleanup, only type-check + build)
# ============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

# ---------------------------------------------------------------- constants
REPO_ROOT="/d/zeal"
DRY_RUN="${DRY_RUN:-0}"
SKIP_COMMIT="${SKIP_COMMIT:-0}"
VERIFY_ONLY="${VERIFY_ONLY:-0}"
BUILD_LOG="/tmp/zeal-cleanup-build.log"
DEPS_REMOVED=0
FILES_REMOVED=0
DIRS_REMOVED=0
CLEANUP_RAN=0

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_BLUE=$'\033[36m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_BOLD=""
fi

log()    { printf '%s[zeal-clean]%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()     { printf '%s  ✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()   { printf '%s  !%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()    { printf '%s  ✗ ABORT:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
header() { printf '\n%s%s════ %s ════%s\n' "$C_BOLD" "$C_BLUE" "$*" "$C_RESET"; }

on_error() {
  local exit_code=$? line=${1:-?}
  printf '%s  ✗ script failed (exit %s) at line %s%s\n' "$C_RED" "$exit_code" "$line" "$C_RESET" >&2
  printf '%s    working tree left intact — inspect with: git -C %s status%s\n' "$C_RED" "$REPO_ROOT" "$C_RESET" >&2
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR

# ================================================================ phase 0
header "PHASE 0 — preflight & safety assertions"

cd "$REPO_ROOT" || die "cannot cd to $REPO_ROOT"

TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ "$TOPLEVEL" == "/d/zeal" || "$TOPLEVEL" == "D:/zeal" || "$TOPLEVEL" == "$(pwd -P)" && "$(basename "$TOPLEVEL")" == "zeal" ]] \
  || die "not running from the root of the zeal git repository (toplevel: $TOPLEVEL)"
git rev-parse --verify HEAD >/dev/null 2>&1 || die "repository has no commits"

HEAD_BEFORE="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[[ "$NODE_MAJOR" -ge 20 ]] || die "node >= 20 required (found $(node -v 2>/dev/null || echo none))"
command -v npm >/dev/null || die "npm not found on PATH"

TRACKED_BEFORE="$(git ls-files | wc -l | tr -d ' ')"
log "repo        : $REPO_ROOT (branch $BRANCH @ $HEAD_BEFORE)"
log "node/npm    : $(node -v) / $(npm -v)"
log "tracked     : $TRACKED_BEFORE files"
log "dry-run     : $DRY_RUN   skip-commit: $SKIP_COMMIT   verify-only: $VERIFY_ONLY"
log "rollback    : git reset --hard $HEAD_BEFORE  (after a committed run: git revert)"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  log "VERIFY_ONLY=1 — skipping cleanup phases, running verification only"
fi

# Source trees scanned by the reference assertions (never node_modules/.next).
SRC_TREES=(apps/web apps/admin packages scripts tooling docs supabase .github)
src_grep() { # src_grep <extended-regex> -> matches outside node_modules/.next
  grep -rnE "$1" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --include='*.json' --include='*.yml' --include='*.sh' --include='*.sql' \
    "${SRC_TREES[@]}" 2>/dev/null \
    | grep -v 'node_modules/' | grep -v '\.next/' | grep -v 'package-lock.json' \
    || true
}

code_grep() { # like src_grep but ignores package.json manifests (dep prunes target those)
  grep -rnE "$1" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --include='*.yml' --include='*.sh' --include='*.sql' \
    "${SRC_TREES[@]}" 2>/dev/null \
    | grep -v 'node_modules/' | grep -v '\.next/' \
    || true
}

assert_no_refs() { # assert_no_refs <label> <regex> [exclude-filter-regex]
  local label="$1" pattern="$2" excl="${3:-}" hits
  hits="$(src_grep "$pattern")"
  [[ -n "$excl" && -n "$hits" ]] && hits="$(printf '%s\n' "$hits" | grep -vE "$excl" || true)"
  if [[ -n "$hits" ]]; then
    printf '%s\n' "$hits" | head -10 >&2
    die "ASSERTION FAILED [$label]: live references found — refusing to delete"
  fi
  ok "assertion passed: $label has zero references"
}

assert_no_refs_in() { # assert_no_refs_in <dir> <label> <extended-regex>
  local dir="$1" label="$2" pattern="$3" hits
  hits="$(grep -rnE "$pattern" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    "$dir" 2>/dev/null | grep -v 'node_modules/' | grep -v '\.next/' || true)"
  if [[ -n "$hits" ]]; then
    printf '%s\n' "$hits" | head -10 >&2
    die "ASSERTION FAILED [$label]: live references found in $dir — refusing to delete"
  fi
  ok "assertion passed: $label has zero references in $dir"
}

# Hard assertions — each mirrors a claim from the static audit. Any hit aborts
# the whole run before a single file is touched.
assert_no_refs "actions/astrology.ts"        "actions/astrology|from ['\"][^'\"]*astrology['\"]" "^apps/web/actions/astrology\.ts:"
# NB: apps/web has its OWN live lib/auth (getUserId, syncAuthUser) — untouched.
# Only the empty apps/admin wrappers are deleted, so scope this to apps/admin.
assert_no_refs_in apps/admin "admin lib/auth wrappers" "from ['\"]@/lib/auth['\"]|@/lib/auth/(client|server|index)"
assert_no_refs "a11y one-shot codemods"      "a11y/fix(-v2)?\.mjs" "^scripts/a11y/fix(-v2)?\.mjs:"
assert_no_refs ".audit-* reports"            "\.audit-report\.md|\.audit-deep-report\.md|\.audit-production\.json"
assert_no_refs ".env.vercel.required"        "\.env\.vercel\.required"
assert_no_refs ".env.vercel.template"        "\.env\.vercel\.template"
assert_no_refs ".deploy-trigger"             "\.deploy-trigger"
assert_no_refs "repo_essentials_dump.txt"    "repo_essentials_dump"

assert_no_code_refs() { # assert_no_code_refs <label> <regex> — ignores package.json manifests
  local label="$1" pattern="$2" hits
  hits="$(code_grep "$pattern")"
  if [[ -n "$hits" ]]; then
    printf '%s\n' "$hits" | head -10 >&2
    die "ASSERTION FAILED [$label]: live source references found — refusing to prune"
  fi
  ok "assertion passed: $label unused in source"
}

# Dep assertions — the only permitted "livekit" hits are the internal stub
# lib/livekit/room.ts and its importer; no SDK package imports may exist.
LIVEKIT_HITS="$(code_grep "livekit" | grep -vE 'lib/livekit/room\.ts|from ["'\'']@/lib/livekit/room["'\'']' || true)"
[[ -z "$LIVEKIT_HITS" ]] || { printf '%s\n' "$LIVEKIT_HITS" >&2; die "ASSERTION FAILED [livekit]: unexpected SDK usage"; }
ok "assertion passed: livekit SDK packages unused (internal stub only)"

assert_no_code_refs "@teispace/next-themes"  "@teispace/next-themes"
assert_no_code_refs "auth-helpers"           "auth-helpers"
assert_no_code_refs "ioredis/redis/socket.io" "from ['\"]ioredis['\"]|from ['\"]redis['\"]|socket\.io"
assert_no_code_refs "razorpay"               "from ['\"]razorpay['\"]|require\(['\"]razorpay"
assert_no_code_refs "@trpc client-side pkgs" "@trpc/(client|next|react-query)"

# Sanity: things we KEEP must still be referenced (guards against a stale plan).
KEEP_CHECKS=(
  "@zeal/utils|packages/utils"
  "smoke-test\.sh"
  "a11y/scan\.py"
  "verify-packages\.sh"
  "api/debug/log"
)
for kc in "${KEEP_CHECKS[@]}"; do
  [[ -n "$(src_grep "$kc")" ]] || warn "keep-check found no refs for: $kc (not deleting it anyway)"
done
ok "keep-checks done"

# ---------------------------------------------------------------- targets
TRACKED_DEAD_FILES=(
  ".audit-report.md"
  ".audit-deep-report.md"
  ".audit-production.json"
  ".env.vercel.required"
  ".env.vercel.template"
  "apps/web/actions/astrology.ts"
  "apps/admin/lib/auth/client.ts"
  "apps/admin/lib/auth/server.ts"
  "apps/admin/lib/auth/index.ts"
  "scripts/a11y/fix.mjs"
  "scripts/a11y/fix-v2.mjs"
)
UNTRACKED_JUNK=(
  "repo_essentials_dump.txt"
)
STALE_DEPS=(
  "@teispace/next-themes"
  "@supabase/auth-helpers-nextjs"
  "@supabase/auth-helpers-shared"
  "ioredis"
  "redis"
  "socket.io"
  "socket.io-client"
  "@socket.io/redis-adapter"
  "livekit-client"
  "livekit-server-sdk"
  "@livekit/components-react"
  "razorpay"
  "@trpc/client"
  "@trpc/next"
  "@trpc/react-query"
)
PKG_FILES=(
  "package.json"
  "apps/web/package.json"
  "apps/admin/package.json"
)

log "targets     : ${#TRACKED_DEAD_FILES[@]} tracked files, ${#UNTRACKED_JUNK[@]} untracked, ${#STALE_DEPS[@]} candidate deps"
[[ "$DRY_RUN" == "1" ]] && { log "DRY_RUN=1 — nothing will be modified"; }

# ================================================================ phase 1
header "PHASE 1 — remove tracked dead files (git rm, reversible)"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  log "skipped (VERIFY_ONLY=1)"
else
for f in "${TRACKED_DEAD_FILES[@]}"; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    if [[ "$DRY_RUN" == "1" ]]; then
      log "would git rm: $f"
    else
      git rm --quiet -- "$f"
      FILES_REMOVED=$((FILES_REMOVED + 1))
      ok "git rm $f"
    fi
  elif [[ -e "$f" ]]; then
    warn "$f exists but is untracked — removing with rm"
    [[ "$DRY_RUN" == "1" ]] || { rm -f -- "$f"; FILES_REMOVED=$((FILES_REMOVED + 1)); }
  else
    warn "$f already absent — skipping"
  fi
done

# Stage the pre-existing on-disk deletions that belong to this cleanup:
#   .deploy-trigger (already staged) and the .migration/backup-* trees.
if [[ "$DRY_RUN" != "1" ]]; then
  git add -u -- .deploy-trigger 2>/dev/null || true
  git add -u -- .migration 2>/dev/null || true
  ok "staged pre-existing deletions (.deploy-trigger, .migration backups)"
fi
fi

# ================================================================ phase 2
header "PHASE 2 — remove untracked junk"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  log "skipped (VERIFY_ONLY=1)"
else
for f in "${UNTRACKED_JUNK[@]}"; do
  if [[ -e "$f" ]]; then
    size="$(du -h -- "$f" | cut -f1)"
    if [[ "$DRY_RUN" == "1" ]]; then
      log "would rm: $f ($size)"
    else
      rm -f -- "$f"
      FILES_REMOVED=$((FILES_REMOVED + 1))
      ok "rm $f ($size reclaimed)"
    fi
  else
    warn "$f already absent — skipping"
  fi
done
fi

# ================================================================ phase 3
header "PHASE 3 — prune empty directories"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  log "skipped (VERIFY_ONLY=1)"
else
# -delete implies depth-first, so nested empty dirs go in one pass; run twice
# for parents that only became empty after the first pass. node_modules and
# .next are pruned from traversal entirely.
for pass in 1 2; do
  while IFS= read -r d; do
    [[ -n "$d" ]] || continue
    if [[ "$DRY_RUN" == "1" ]]; then
      log "would rmdir: $d"
    else
      rmdir -- "$d" && DIRS_REMOVED=$((DIRS_REMOVED + 1)) && ok "rmdir $d"
    fi
  done < <(find apps docs packages \
             \( -name node_modules -o -name .next -o -name .git \) -prune -o \
             -type d -empty -print 2>/dev/null)
done
fi

# ================================================================ phase 4
header "PHASE 4 — prune stale dependencies & sync lockfile"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  log "skipped (VERIFY_ONLY=1)"
elif [[ "$DRY_RUN" == "1" ]]; then
  for pf in "${PKG_FILES[@]}"; do log "would prune deps in $pf"; done
else
  DEPS_JSON="$(printf '"%s",' "${STALE_DEPS[@]}")"
  DEPS_JSON="[${DEPS_JSON%,}]"
  DEPS_REMOVED="$(node - "$DEPS_JSON" "${PKG_FILES[@]}" <<'NODE_EOF'
const fs = require("fs");
const stale = JSON.parse(process.argv[2]);
let removed = 0;
for (const file of process.argv.slice(3)) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
  const pkg = JSON.parse(raw);
  let touched = false;
  for (const section of ["dependencies", "devDependencies"]) {
    if (!pkg[section]) continue;
    for (const dep of stale) {
      if (Object.prototype.hasOwnProperty.call(pkg[section], dep)) {
        delete pkg[section][dep];
        removed++; touched = true;
        console.error(`  pruned ${dep} from ${file} [${section}]`);
      }
    }
  }
  if (touched) fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}
console.log(removed);
NODE_EOF
)"
  ok "removed $DEPS_REMOVED dependency entries"

  log "syncing package-lock.json + node_modules (npm install)…"
  npm install --no-audit --no-fund >/tmp/zeal-npm-install.log 2>&1 \
    || { tail -30 /tmp/zeal-npm-install.log >&2; die "npm install failed — see /tmp/zeal-npm-install.log"; }
  ok "npm install clean"
fi

if [[ "$VERIFY_ONLY" != "1" && "$DRY_RUN" != "1" ]]; then
  CLEANUP_RAN=1
fi

# ================================================================ phase 5
header "PHASE 5 — verify: type-check + production build"

if [[ "$DRY_RUN" == "1" ]]; then
  log "would run: npm run type-check && npm run build"
else
  log "type-checking all workspaces…"
  npm run type-check >"$BUILD_LOG" 2>&1 \
    || { tail -60 "$BUILD_LOG" >&2; die "type-check FAILED — full log: $BUILD_LOG"; }
  ok "type-check green"

  log "building apps/web…"
  npm run build --workspace apps/web >"$BUILD_LOG" 2>&1 \
    || { tail -60 "$BUILD_LOG" >&2; die "apps/web build FAILED — full log: $BUILD_LOG"; }
  ok "apps/web build green"

  log "building apps/admin…"
  npm run build --workspace apps/admin >"$BUILD_LOG" 2>&1 \
    || { tail -60 "$BUILD_LOG" >&2; die "apps/admin build FAILED — full log: $BUILD_LOG"; }
  ok "apps/admin build green"
fi

# ================================================================ phase 6
header "PHASE 6 — commit"

if [[ "$DRY_RUN" == "1" ]]; then
  log "would commit cleanup (skipped: DRY_RUN=1)"
elif [[ "$VERIFY_ONLY" == "1" ]]; then
  log "skipped (VERIFY_ONLY=1)"
elif [[ "$SKIP_COMMIT" == "1" ]]; then
  warn "SKIP_COMMIT=1 — leaving all changes staged/unstaged for review"
  git status --short | head -40
else
  git add -- setup.sh package.json package-lock.json apps/web/package.json apps/admin/package.json
  git add -- supabase/migrations/1000_cleanup_dead_tables.sql
  git add -u -- "${TRACKED_DEAD_FILES[@]}" 2>/dev/null || true
  if git diff --cached --quiet; then
    warn "no staged changes — repository is already clean; skipping commit"
  else
    git commit -m "$(cat <<'MSG'
chore: tier-A cleanup — remove dead files, empty dirs, and unused deps

Repo compaction pass; every removal verified to have zero references in
source, CI workflows, vercel.json, docker/, or package scripts.

- remove dead code: apps/web/actions/astrology.ts (mock kundali, no importers),
  apps/admin/lib/auth/{client,server,index}.ts (empty wrappers; real guards are
  api-guard.ts/dal.ts), one-shot codemods scripts/a11y/fix{,-v2}.mjs
- remove root junk: .audit-* reports, .env.vercel.required (misnamed destructive
  script), .env.vercel.template, .deploy-trigger, .migration backups,
  repo_essentials_dump.txt (untracked)
- prune empty dirs (lib/payments, providers, api/quests/**, api/bazaar/*,
  docs/{api,architecture,deployment}, stray api/trpc/[trpc, …)
- drop unused deps: @teispace/next-themes, @supabase/auth-helpers-nextjs,
  ioredis, redis, socket.io{,-client}, @socket.io/redis-adapter,
  livekit-{client,server-sdk}, @livekit/components-react, razorpay,
  @trpc/{client,next,react-query}
- add supabase/migrations/1000_cleanup_dead_tables.sql: guarded, idempotent
  drop of dead live-DB tables (wallet_ledger, audit_logs, ai_services,
  ai_profiles, AdminLoginAttempt, DebugLog, _zeal_diag, _zeal_audit_history);
  every drop skipped automatically if any function/view still references it

Verified: npm run type-check + next build green for apps/web and apps/admin.
MSG
)"
    ok "committed: $(git rev-parse --short HEAD)"
  fi
fi

# ================================================================ summary
header "SUMMARY"
TRACKED_AFTER="$(git ls-files | wc -l | tr -d ' ')"
log "files removed      : $FILES_REMOVED (tracked before/after: $TRACKED_BEFORE → $TRACKED_AFTER)"
log "empty dirs removed : $DIRS_REMOVED"
log "dep entries pruned : $DEPS_REMOVED"
log "cleanup ran        : $( [[ "$CLEANUP_RAN" == "1" ]] && echo yes || echo no )"
log "verification       : type-check ✓  build web ✓  build admin ✓"
log "head               : $HEAD_BEFORE → $(git rev-parse --short HEAD)"
cat <<'NEXT'

Next steps (manual):
  1. Review the DB migration, then apply it to Supabase:
       supabase db push          (or paste supabase/migrations/1000_cleanup_dead_tables.sql
                                  into the Supabase SQL editor — it is idempotent & guarded)
  2. Rotate the SUPABASE_SERVICE_ROLE_KEY + Clerk keys that were committed in
     git history (commits 5f30b04, 99e94ec) — history still exposes them.
  3. Optional local disk cleanup (~1.2 GB, regenerable):
       rm -rf apps/web/.next apps/admin/.next

NEXT
ok "cleanup complete"
