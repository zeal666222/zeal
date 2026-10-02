#!/usr/bin/env bash
# fix-and-push.sh
# Purpose:
#   1. Remove a hardcoded GitHub PAT from setup.sh
#   2. Purge the secret from git history (all commits)
#   3. Push to origin using a freshly prompted PAT (never stored)
#
# Usage:
#   ./fix-and-push.sh [REPO_DIR] [REMOTE] [BRANCH] [GIT_USER]
# Defaults:
#   REPO_DIR=/d/zeal  REMOTE=origin  BRANCH=main  GIT_USER=zeal666222

set -Eeuo pipefail

# ---------- Config ----------
REPO_DIR="${1:-/d/zeal}"
REMOTE="${2:-origin}"
BRANCH="${3:-main}"
GIT_USER="${4:-zeal666222}"

# The literal secret leaked into setup.sh:17 (from GitHub push protection).
LEAKED_PAT="REMOVED_TOKEN"

# Files that may contain the leak.
TARGET_FILE="setup.sh"

# ---------- Pretty logging ----------
C_RESET=$'\033[0m'; C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'
C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'
log()  { printf '%s[fix]%s %s\n'  "$C_BLUE"   "$C_RESET" "$*"; }
ok()   { printf '%s[ ok]%s %s\n'  "$C_GREEN"  "$C_RESET" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()  { printf '%s[fail]%s %s\n' "$C_RED"    "$C_RESET" "$*" >&2; exit 1; }

# ---------- Pre-flight ----------
command -v git >/dev/null || die "git not found in PATH"
[[ -d "$REPO_DIR/.git" ]] || die "Not a git repo: $REPO_DIR"

cd "$REPO_DIR"

log "Repo dir : $REPO_DIR"
log "Remote   : $REMOTE"
log "Branch   : $BRANCH"
log "Git user : $GIT_USER"
echo

# ---------- Ensure remote is correct ----------
if git remote get-url "$REMOTE" >/dev/null 2>&1; then
  current_url="$(git remote get-url "$REMOTE")"
  log "Current $REMOTE URL: $current_url"
else
  log "Adding remote $REMOTE"
  git remote add "$REMOTE" "https://github.com/zeal666222/zeal.git"
fi

# ---------- 0) Fail-fast if not a worktree ----------
git rev-parse --is-inside-work-tree >/dev/null || die "Not inside a work tree"

# ---------- 1) Backup ----------
BACKUP_DIR="../zeal-backup-$(date +%Y%m%d-%H%M%S)"
log "Creating backup at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
git bundle create "$BACKUP_DIR/repo.bundle" --all >/dev/null
cp -f "$TARGET_FILE" "$BACKUP_DIR/${TARGET_FILE}.bak" 2>/dev/null || true
ok "Backup created"
echo

# ---------- 2) Sanitize setup.sh ----------
if [[ -f "$TARGET_FILE" ]]; then
  if grep -q "$LEAKED_PAT" "$TARGET_FILE" 2>/dev/null || grep -q 'ghp_' "$TARGET_FILE" 2>/dev/null; then
    log "Scrubbing $TARGET_FILE"
    # Replace any ghp_... token literal with a runtime prompt
    # 1) Kill any line assigning a hardcoded ghp_ token
    sed -i -E 's/(REMOVED_TOKEN)/REMOVED_TOKEN/g' "$TARGET_FILE"
    # 2) If the file used GIT_PAT="..." or token="...", convert to a safe prompt line
    if grep -qE '^[[:space:]]*(export[[:space:]]+)?(GIT_PAT|GITHUB_PAT|TOKEN)=' "$TARGET_FILE"; then
      # remove any hardcoded assignment
      sed -i -E '/^[[:space:]]*(export[[:space:]]+)?(GIT_PAT|GITHUB_PAT|TOKEN)=/d' "$TARGET_FILE"
      # ensure there is a safe prompt
      if ! grep -q 'read -r -s -p' "$TARGET_FILE"; then
        printf '\n# Injected by fix-and-push.sh: safe PAT prompt\n' >> "$TARGET_FILE"
        printf 'read -r -s -p "GitHub PAT for %s: " GIT_PAT; echo\n' "$GIT_USER" >> "$TARGET_FILE"
        printf 'export GIT_PAT\n' >> "$TARGET_FILE"
      fi
    fi
    ok "Scrubbed $TARGET_FILE"
  else
    ok "$TARGET_FILE already clean"
  fi
else
  warn "$TARGET_FILE not found — skipping file scrub"
fi
echo

# ---------- 3) Purge secret from history ----------
log "Purging secret from git history"

# 3a) Prefer git-filter-repo
if command -v git-filter-repo >/dev/null 2>&1; then
  log "Using git-filter-repo"
  REPLACE_FILE="$(mktemp)"
  # Replace literal token and any ghp_ pattern with REMOVED
  printf '%s==>REMOVED_TOKEN\n' "$LEAKED_PAT" >  "$REPLACE_FILE"
  printf 'REMOVED_TOKEN==>REMOVED_TOKEN\n' >> "$REPLACE_FILE"

  git filter-repo --force \
    --replace-text "$REPLACE_FILE" \
    --replace-message "$REPLACE_FILE" >/dev/null

  rm -f "$REPLACE_FILE"

  # filter-repo drops the remote; re-add
  git remote remove "$REMOTE" 2>/dev/null || true
  git remote add "$REMOTE" "https://github.com/zeal666222/zeal.git"
  ok "History rewritten with git-filter-repo"
else
  warn "git-filter-repo not installed — using git filter-branch fallback"
  warn "(install it later with: pipx install git-filter-repo  — much faster)"
  FILTER_BRANCH_SQUELCH_WARNING=1 \
  git filter-branch --force --index-filter \
    "git ls-files -z | xargs -0 -I{} sh -c 'grep -Il \"$LEAKED_PAT\" \"{}\" >/dev/null 2>&1 && sed -i \"s/$LEAKED_PAT/REMOVED_TOKEN/g\" \"{}\" && git add \"{}\"' || true" \
    --prune-empty --tag-name-filter cat -- --all >/dev/null 2>&1 || true

  # Belt-and-suspenders: replace whole blob for setup.sh across all commits
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch $TARGET_FILE" \
    --prune-empty --tag-name-filter cat -- --all >/dev/null 2>&1 || true

  # Re-add current clean version
  if [[ -f "$TARGET_FILE" ]]; then
    git add "$TARGET_FILE"
    if ! git diff --cached --quiet; then
      git commit -m "chore: remove leaked PAT from setup.sh" >/dev/null
    fi
  fi

  # Clean up filter-branch backup refs and reflog
  rm -rf .git/refs/original
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive >/dev/null 2>&1 || true
  ok "History rewritten with filter-branch"
fi

# 3b) Ensure origin still exists
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  git remote add "$REMOTE" "https://github.com/zeal666222/zeal.git"
fi
echo

# ---------- 4) Verify no secrets remain ----------
log "Verifying no ghp_ tokens remain in history"
if git log -p --all -- . | grep -a 'ghp_' >/dev/null 2>&1; then
  warn "A ghp_ token still appears somewhere in history."
  warn "Run: git log -p --all -- . | grep -a 'ghp_'  and inspect."
else
  ok "No ghp_ tokens in git history"
fi

log "Verifying working tree"
if grep -RIn --exclude-dir=.git 'ghp_' . >/dev/null 2>&1; then
  warn "A ghp_ token still appears in working tree files."
  grep -RIn --exclude-dir=.git 'ghp_' . || true
else
  ok "No ghp_ tokens in working tree"
fi
echo

# ---------- 5) Prompt for fresh PAT ----------
read -r -s -p "New GitHub PAT for ${GIT_USER}: " GIT_PAT
echo
[[ -n "$GIT_PAT" ]] || die "Empty PAT — aborting"

cleanup() {
  unset GIT_PAT GIT_ASKPASS GIT_ASKPASS_REQUIRE GIT_TERMINAL_PROMPT
  [[ -n "${ASKPASS_FILE:-}" && -f "$ASKPASS_FILE" ]] && rm -f "$ASKPASS_FILE"
}
trap cleanup EXIT

ASKPASS_FILE="$(mktemp "${TMPDIR:-/tmp}/git-askpass.XXXXXX")"
cat >"$ASKPASS_FILE" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  *Username*|*username*) printf '%s\n' "$GIT_USER" ;;
  *Password*|*password*) printf '%s\n' "$GIT_PAT" ;;
  *) exit 1 ;;
esac
EOF
chmod 700 "$ASKPASS_FILE"
export GIT_USER GIT_PAT
export GIT_ASKPASS="$ASKPASS_FILE"
export GIT_ASKPASS_REQUIRE=force
export GIT_TERMINAL_PROMPT=0

# ---------- 6) Force-push rewritten history ----------
log "Pushing rewritten $BRANCH to $REMOTE"
git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
    push "$REMOTE" "$BRANCH" --force-with-lease

ok "Push complete 🎉"
echo
warn "Reminder: revoke the OLD token now: https://github.com/settings/tokens"
warn "Leaked token was: ${LEAKED_PAT:0:8}... (already public, must be revoked)"