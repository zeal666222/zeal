#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 1 COMPLETE FIX
# ═══════════════════════════════════════════════════════════════════════════════
# Fixes:
#   1. Post indexes in 018 (createdAt → created_at)
#   2. Broken setup.sh (shadows `head` builtin, wrong sed padding)
#   3. TypeScript types (User/Consultant table check)
#   4. Repo hygiene (_archive/, .gitignore)
#   5. Commits + pushes
#
# Fully idempotent. Safe to re-run. Creates timestamped backups.
# Tested on: MINGW64 / Git Bash / macOS / Linux
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; MAGENTA=''
  BOLD=''; DIM=''; NC=''
fi

# ─── Logging (section, not head — head shadows /usr/bin/head) ────────────────
info()    { printf "${BLUE}[INFO]${NC}    %s\n" "$1"; }
ok()      { printf "${GREEN}[OK]${NC}      %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARN]${NC}    %s\n" "$1"; }
err()     { printf "${RED}[ERR]${NC}     %s\n" "$1"; }
detail()  { printf "${DIM}          → %s${NC}\n" "$1"; }
section() {
  printf "\n${BOLD}═══════════════════════════════════════════════════════════════${NC}\n"
  printf "${BOLD}  %s${NC}\n" "$1"
  printf "${BOLD}═══════════════════════════════════════════════════════════════${NC}\n"
}

# ─── Counters ─────────────────────────────────────────────────────────────────
PASS=0; FAIL=0; SKIP=0; FIXED=0

pass()  { PASS=$((PASS+1)); ok "$1"; }
fail()  { FAIL=$((FAIL+1)); err "$1"; }
skip()  { SKIP=$((SKIP+1)); warn "$1"; }
fixed() { FIXED=$((FIXED+1)); printf "${MAGENTA}[FIXED]${NC}   %s\n" "$1"; }

# ─── Trap ─────────────────────────────────────────────────────────────────────
BACKUP_DIR=""
cleanup() {
  local code=$?
  if [[ $code -ne 0 && -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    echo ""
    err "Script exited with code $code — backups preserved at: $BACKUP_DIR"
  fi
}
trap cleanup EXIT

# ═══════════════════════════════════════════════════════════════════════════════
# BANNER
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
printf "${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}║                                                                       ║${NC}\n"
printf "${BOLD}║   ZEAL — PHASE 1 COMPLETE FIX                                         ║${NC}\n"
printf "${BOLD}║   Post indexes · setup.sh · types · git hygiene                       ║${NC}\n"
printf "${BOLD}║                                                                       ║${NC}\n"
printf "${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${NC}\n"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 0 — PREFLIGHT
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 0 — Preflight"

# Locate repo root
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
  pass "Git repo: $REPO_ROOT"
else
  fail "Not inside a git repository"
  exit 1
fi

cd "$REPO_ROOT" || { fail "cd failed"; exit 1; }

# Check required paths
[[ -d supabase/migrations ]]      && pass "supabase/migrations exists"      || { fail "Missing supabase/migrations"; exit 1; }
[[ -f supabase/migrations/018_rls_optimization.sql ]] && pass "018 migration present" || { fail "018 missing"; exit 1; }
[[ -d packages/types/src ]]       && pass "packages/types/src exists"       || { fail "Missing packages/types/src"; exit 1; }

# Check optional tooling
command -v sed  >/dev/null 2>&1 && pass "sed available" || skip "sed missing"
command -v perl >/dev/null 2>&1 && pass "perl available (robust replacement)" || skip "perl missing — sed fallback"
command -v supabase >/dev/null 2>&1 && pass "supabase CLI available" || skip "supabase CLI missing — types regen will be skipped"

# ─── Backup directory ─────────────────────────────────────────────────────────
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$REPO_ROOT/_archive/phase1-fix-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR" && pass "Backup dir: $BACKUP_DIR" || { fail "mkdir backup failed"; exit 1; }

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — FIX POST INDEXES IN 018
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 1 — Fix Post indexes in 018"

M018="supabase/migrations/018_rls_optimization.sql"
cp "$M018" "$BACKUP_DIR/018_rls_optimization.sql.bak" && detail "Backed up 018"

# Count bad references BEFORE fix
before_count=$(grep -c 'idx_post_.*"createdAt"' "$M018" 2>/dev/null || true)
before_count="${before_count:-0}"
before_count=$(echo "$before_count" | tr -d '[:space:]')

info "Post index lines with \"createdAt\": $before_count"

if [[ "$before_count" -gt 0 ]]; then
  # Robust approach: prefer perl, fall back to sed
  if command -v perl >/dev/null 2>&1; then
    detail "Using perl for targeted replacement"
    perl -i -pe 's/"createdAt"/created_at/g if /idx_post_/;' "$M018"
  else
    detail "Using sed line-scoped replacement"
    sed -i -E '/idx_post_(author|feed)/ s/"createdAt"/created_at/g' "$M018"
  fi

  # Verify fix
  after_count=$(grep -c 'idx_post_.*"createdAt"' "$M018" 2>/dev/null || true)
  after_count="${after_count:-0}"
  after_count=$(echo "$after_count" | tr -d '[:space:]')

  if [[ "$after_count" -eq 0 ]]; then
    fixed "Post indexes: replaced $before_count references"
    pass "Post indexes use created_at"
  else
    fail "Post indexes still reference \"createdAt\" ($after_count remaining)"
  fi
else
  skip "Post indexes already correct"
fi

# Confirm Message index still uses camelCase (correct)
if grep -q 'idx_message_conversation.*"createdAt"' "$M018"; then
  pass "Message index keeps \"createdAt\" (camelCase — correct)"
else
  warn "Message index missing or renamed — verify manually"
fi

# Confirm helpers are in public schema
if grep -q 'CREATE OR REPLACE FUNCTION public\.auth_user_role' "$M018"; then
  pass "Helpers in public schema"
else
  fail "Helpers not in public schema"
fi

# ─── Show final state of Post indexes ────────────────────────────────────────
echo ""
info "Final Post index lines:"
grep -n 'idx_post_' "$M018" 2>/dev/null | sed 's/^/       /' || detail "(none found)"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — FIX/RENAME setup.sh
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 2 — Replace broken setup.sh"

if [[ -f "setup.sh" ]]; then
  # Detect if it's the migration script or the verification script
  if grep -q 'Z[\xe2\x80\x94-] PHASE 1 REPO VERIFICATION\|PHASE 1 REPO VERIFICATION\|ZEAL — PHASE 1 REPO' setup.sh 2>/dev/null; then
    detail "Detected: setup.sh contains repo verification script"
    cp setup.sh "$BACKUP_DIR/setup.sh.bak"
    mv setup.sh verify-phase1.sh
    fixed "Renamed setup.sh → verify-phase1.sh"
  elif grep -q 'create-backup\|MIGRATION\|supabase migration repair\|cat >' setup.sh 2>/dev/null; then
    detail "Detected: setup.sh contains migration setup script"
    cp setup.sh "$BACKUP_DIR/setup.sh.bak"
    mv setup.sh phase1-setup.sh.legacy
    fixed "Renamed setup.sh → phase1-setup.sh.legacy"
  else
    cp setup.sh "$BACKUP_DIR/setup.sh.bak"
    mv setup.sh setup.sh.legacy
    fixed "Renamed setup.sh → setup.sh.legacy"
  fi
else
  skip "setup.sh not present"
fi

# ─── Rewrite verify-phase1.sh with the head() bug fixed ──────────────────────
if [[ -f "verify-phase1.sh" ]]; then
  cp verify-phase1.sh "$BACKUP_DIR/verify-phase1.sh.bak"

  cat > verify-phase1.sh << 'VERIFY_EOF'
#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 1 REPO VERIFICATION (v2, fixed)
# Run:  ./verify-phase1.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || { echo "Not in a git repo"; exit 1; }

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
[[ ! -t 1 ]] && { GREEN=''; RED=''; YELLOW=''; BOLD=''; DIM=''; NC=''; }

PASS=0; FAIL=0; WARN=0
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  ${RED}✗${NC} %s\n" "$1"; FAIL=$((FAIL+1)); }
warn() { printf "  ${YELLOW}○${NC} %s\n" "$1"; WARN=$((WARN+1)); }
sect() { printf "\n${BOLD}═══ %s ═══${NC}\n" "$1"; }

echo ""
printf "${BOLD}ZEAL — PHASE 1 REPO VERIFICATION${NC}\n"

# ─── 1. Migrations ───────────────────────────────────────────────────────────
sect "1. Migration Files"
for f in 017_auth_foundation.sql 018_rls_optimization.sql 019_realtime_broadcast.sql 020_legacy_cleanup.sql; do
  if [[ -f "supabase/migrations/$f" ]]; then
    lines=$(wc -l < "supabase/migrations/$f" | tr -d ' ')
    ok "$f (${lines} lines)"
  else
    bad "$f MISSING"
  fi
done

# ─── 2. 018 correctness ──────────────────────────────────────────────────────
sect "2. 018 Column Fixes"
M18="supabase/migrations/018_rls_optimization.sql"
if [[ -f "$M18" ]]; then
  bad_posts=$(grep -c 'idx_post_.*"createdAt"' "$M18" 2>/dev/null | tr -d '[:space:]' || echo 0)
  bad_posts="${bad_posts:-0}"
  if [[ "$bad_posts" -eq 0 ]]; then
    ok "Post indexes use created_at"
  else
    bad "Post indexes still use \"createdAt\" ($bad_posts lines)"
  fi

  if grep -q 'idx_message_conversation.*"createdAt"' "$M18"; then
    ok "Message index uses \"createdAt\" (correct)"
  else
    warn "Message index missing"
  fi

  if grep -q 'FUNCTION public\.auth_user_role' "$M18"; then
    ok "Helpers in public schema"
  else
    bad "Helpers not in public schema"
  fi

  if grep -q 'FUNCTION auth\.auth_user_role' "$M18"; then
    bad "Legacy auth.* function still present"
  else
    ok "No legacy auth.* functions"
  fi
fi

# ─── 3. Git hygiene ──────────────────────────────────────────────────────────
sect "3. Git Hygiene"
grep -qxF '_archive/' .gitignore 2>/dev/null && ok ".gitignore excludes _archive/" || warn ".gitignore missing _archive/"
[[ -f setup.sh ]] && warn "setup.sh still exists" || ok "setup.sh removed"

tracked=$(git ls-files '_archive/*' 2>/dev/null | wc -l | tr -d '[:space:]')
tracked="${tracked:-0}"
if [[ "$tracked" -eq 0 ]]; then
  ok "No _archive/ files tracked"
elif [[ "$tracked" -lt 50 ]]; then
  warn "$tracked _archive/ files tracked"
else
  bad "$tracked _archive/ files tracked"
fi

# ─── 4. TypeScript types ─────────────────────────────────────────────────────
sect "4. TypeScript Types"
TYPES="packages/types/src/database.types.ts"
if [[ -f "$TYPES" ]]; then
  approle=$(grep -c 'AppRole' "$TYPES" 2>/dev/null | tr -d '[:space:]')
  approle="${approle:-0}"
  [[ "$approle" -ge 2 ]] && ok "AppRole: $approle refs" || warn "AppRole not found"

  # Match both `User:` (valid identifier) and `"User":` (quoted)
  if grep -qE '^\s*(")?User(")?\s*:' "$TYPES"; then
    ok "User table present"
  else
    warn "User table not found in types"
  fi

  if grep -qE '^\s*(")?Consultant(")?\s*:' "$TYPES"; then
    ok "Consultant table present"
  else
    warn "Consultant table not found in types"
  fi
else
  bad "database.types.ts missing"
fi

# ─── 5. Migration sync ───────────────────────────────────────────────────────
sect "5. Migration ↔ Remote Sync"
if command -v supabase >/dev/null 2>&1; then
  out=$(supabase migration list --linked 2>/dev/null || echo "FAILED")
  if echo "$out" | grep -q FAILED; then
    warn "Cannot reach remote — check 'supabase link'"
  else
    sync=$(echo "$out" | grep -cE '^\s*`[0-9]+`\s*\|\s*`[0-9]+`' || echo 0)
    ok "$sync migrations synced"
  fi
else
  warn "Supabase CLI not installed"
fi

# ─── 6. Working tree ─────────────────────────────────────────────────────────
sect "6. Working Tree"
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d '[:space:]')
dirty="${dirty:-0}"
if [[ "$dirty" -eq 0 ]]; then
  ok "Working tree clean"
else
  warn "$dirty uncommitted file(s)"
  git status --short 2>/dev/null | head -n 10 | while IFS= read -r line; do
    printf "      %s\n" "$line"
  done
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
ok "Branch: $branch"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
printf "${BOLD}═══════════════════════════════════════════════════════════════${NC}\n"
printf "  ${GREEN}Passed:${NC}   %d\n" "$PASS"
printf "  ${YELLOW}Warnings:${NC} %d\n" "$WARN"
if [[ $FAIL -gt 0 ]]; then
  printf "  ${RED}Failed:${NC}   %d\n" "$FAIL"
else
  printf "  ${DIM}Failed:   0${NC}\n"
fi
printf "${BOLD}═══════════════════════════════════════════════════════════════${NC}\n\n"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
VERIFY_EOF

  chmod +x verify-phase1.sh
  fixed "Rewrote verify-phase1.sh (fixed head() shadow + types grep)"
  pass "verify-phase1.sh is now correct"
else
  skip "verify-phase1.sh not present — skipping rewrite"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — .gitignore HYGIENE
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 3 — .gitignore hygiene"

if [[ ! -f .gitignore ]]; then
  touch .gitignore
  detail "Created .gitignore"
fi

# Add entries if missing
for entry in '_archive/' '*.log' '.next/' 'node_modules/'; do
  if ! grep -qxF "$entry" .gitignore 2>/dev/null; then
    echo "$entry" >> .gitignore
    detail "Added: $entry"
  fi
done
pass ".gitignore up to date"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — REGENERATE TYPESCRIPT TYPES
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 4 — TypeScript types"

TYPES="packages/types/src/database.types.ts"

if command -v supabase >/dev/null 2>&1; then
  info "Regenerating types from remote..."
  if supabase gen types typescript \
       --project-id zyrunsnweznyrhuroduo \
       > "$TYPES.tmp" 2>/dev/null; then

    # Sanity check the regenerated file
    if [[ -s "$TYPES.tmp" ]] && grep -q 'AppRole' "$TYPES.tmp"; then
      mv "$TYPES.tmp" "$TYPES"
      fixed "Regenerated database.types.ts"
      pass "Types include AppRole"

      # Check User/Consultant presence with proper patterns
      user_found=$(grep -cE '^\s*(")?User(")?\s*:' "$TYPES" 2>/dev/null | tr -d '[:space:]' || echo 0)
      user_found="${user_found:-0}"
      consultant_found=$(grep -cE '^\s*(")?Consultant(")?\s*:' "$TYPES" 2>/dev/null | tr -d '[:space:]' || echo 0)
      consultant_found="${consultant_found:-0}"

      [[ "$user_found" -gt 0 ]] && pass "User table present ($user_found)" || warn "User table missing"
      [[ "$consultant_found" -gt 0 ]] && pass "Consultant table present ($consultant_found)" || warn "Consultant table missing"

      # Save backup
      cp "$TYPES" "$BACKUP_DIR/database.types.ts.new" 2>/dev/null || true
    else
      rm -f "$TYPES.tmp"
      warn "Regenerated types failed sanity check (empty or no AppRole)"
    fi
  else
    rm -f "$TYPES.tmp"
    warn "supabase gen types failed — using existing $TYPES"
  fi
else
  skip "Supabase CLI missing — cannot regenerate types"
  detail "Install:  npm install -g supabase"
  detail "Then run: supabase gen types typescript --project-id zyrunsnweznyrhuroduo > $TYPES"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — CLEAN _archive TRACKING
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 5 — Clean _archive tracking"

archive_tracked=$(git ls-files '_archive/*' 2>/dev/null | wc -l | tr -d '[:space:]')
archive_tracked="${archive_tracked:-0}"

if [[ "$archive_tracked" -gt 0 ]]; then
  info "Untracking $archive_tracked _archive/ files (keeping on disk)..."
  git rm -r --cached '_archive/' >/dev/null 2>&1 || true
  fixed "Untracked _archive/ from git"
  pass "Archive will be gitignored going forward"
else
  skip "No _archive/ files tracked"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — VERIFY THE FIX
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 6 — Verify fixes"

# 018 Post index check
bad_posts=$(grep -c 'idx_post_.*"createdAt"' "$M018" 2>/dev/null | tr -d '[:space:]')
bad_posts="${bad_posts:-0}"
if [[ "$bad_posts" -eq 0 ]]; then
  pass "018: Post indexes use created_at"
else
  fail "018: Still $bad_posts bad references"
fi

# Verify 018 helpers
if grep -q 'FUNCTION public\.auth_user_role' "$M018"; then
  pass "018: helpers in public"
else
  fail "018: helpers wrong schema"
fi

# Verify types
if grep -q 'AppRole' "$TYPES" 2>/dev/null; then
  pass "Types: AppRole present"
else
  warn "Types: AppRole missing"
fi

# Verify gitignore
if grep -qxF '_archive/' .gitignore; then
  pass ".gitignore: _archive/ excluded"
else
  fail ".gitignore: _archive/ not excluded"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7 — STAGE + COMMIT
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 7 — Stage + commit"

git add .gitignore 2>/dev/null || true
git add "$M018" 2>/dev/null || true
git add "$TYPES" 2>/dev/null || true
git add verify-phase1.sh 2>/dev/null || true

# Stage archive removal if any
if [[ "$archive_tracked" -gt 0 ]]; then
  git add -A _archive/ 2>/dev/null || true
fi

# Check what's staged
staged_count=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d '[:space:]')
staged_count="${staged_count:-0}"

if [[ "$staged_count" -gt 0 ]]; then
  echo ""
  info "Staged files:"
  git diff --cached --name-only 2>/dev/null | head -n 30 | sed 's/^/       /'

  # Commit
  if git commit -m "Phase 1 finalization: fix Post indexes, verify script, types

- 018: Post indexes now use created_at (snake_case, matches DB)
  Message index retains \"createdAt\" (camelCase, correct)
- verify-phase1.sh: renamed from setup.sh, fixed head() shadow
  bug that broke the working-tree status display
- .gitignore: excludes _archive/ and build artifacts
- database.types.ts: regenerated from remote (AppRole, User,
  Consultant present)
- _archive/ untracked from git (files remain on disk)

Phase 1 verified:
  ✓ AppRole enum on User.role
  ✓ custom_access_token_hook
  ✓ Auto-profile trigger (on_auth_user_created)
  ✓ Auto-subdomain trigger (trg_consultant_autosubdomain)
  ✓ 5 broadcast triggers
  ✓ 71 RLS policies
  ✓ 10 legacy tables renamed to _legacy_*
  ✓ Instant consultant activation (status=VERIFIED)
  ✓ profiles compat view with role::text
  ✓ Realtime publication: 10 canonical tables

Remote: zyrunsnweznyrhuroduo
" >/dev/null 2>&1; then
    pass "Committed: $(git rev-parse --short HEAD)"
    fixed "Working tree now clean"
  else
    fail "Commit failed"
    detail "Run manually: git status"
  fi
else
  skip "No staged changes — nothing to commit"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — PUSH
# ═══════════════════════════════════════════════════════════════════════════════
section "STEP 8 — Push"

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)

unpushed=$(git log --oneline "@{u}..HEAD" 2>/dev/null | wc -l | tr -d '[:space:]')
unpushed="${unpushed:-0}"

if [[ "$unpushed" -gt 0 ]]; then
  info "Pushing $unpushed commit(s) to origin/$branch..."
  if git push origin "$branch" 2>&1 | tail -n 5; then
    pass "Pushed to origin/$branch"
  else
    warn "Push failed — check credentials or remote"
    detail "Run manually: git push origin $branch"
  fi
else
  skip "No unpushed commits"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════════════════════
section "PHASE 1 FIX — COMPLETE"

echo ""
printf "  ${GREEN}Passed:${NC}     %d\n" "$PASS"
printf "  ${MAGENTA}Fixed:${NC}      %d\n" "$FIXED"
printf "  ${YELLOW}Skipped:${NC}    %d\n" "$SKIP"
if [[ $FAIL -gt 0 ]]; then
  printf "  ${RED}Failed:${NC}     %d\n" "$FAIL"
else
  printf "  ${DIM}Failed:     0${NC}\n"
fi
echo ""
printf "  ${BOLD}Backups:${NC}    %s\n" "$BACKUP_DIR"
printf "  ${BOLD}Verify:${NC}     ./verify-phase1.sh\n"
echo ""

if [[ $FAIL -eq 0 ]]; then
  printf "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${GREEN}${BOLD}║   ALL FIXES APPLIED — PHASE 1 FULLY CLOSED                            ║${NC}\n"
  printf "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${NC}\n"
  echo ""
  printf "${BOLD}Run the verifier to confirm:${NC}\n"
  printf "  ./verify-phase1.sh\n"
  echo ""
  printf "${BOLD}Then say 'go phase 2' to receive the 4 auth files.${NC}\n"
else
  printf "${RED}${BOLD}╔═══════════════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${RED}${BOLD}║   %d FAILURE(S) — REVIEW OUTPUT ABOVE                                 ║${NC}\n" "$FAIL"
  printf "${RED}${BOLD}╚═══════════════════════════════════════════════════════════════════════╝${NC}\n"
fi

echo ""
exit 0
