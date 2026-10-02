#!/usr/bin/env bash
# purge-and-push.sh
# Complete, self-contained script to purge leaked GitHub PATs from all history
# and force-push the cleaned repository.
#
# Usage: ./purge-and-push.sh [REPO_DIR] [REMOTE] [BRANCH] [GIT_USER]
# Defaults: REPO_DIR=/d/zeal  REMOTE=origin  BRANCH=main  GIT_USER=zeal666222
#
# Requirements:
#   - git
#   - git-filter-repo (auto-installed via pip if missing)
#   - A fresh GitHub PAT with repo scope (will be prompted silently)
#
# What it does:
#   1. Backs up the repository as a bundle.
#   2. Removes any local scripts that contain the literal tokens.
#   3. Installs git-filter-repo if needed.
#   4. Rewrites ALL history, replacing both known tokens and any ghp_ pattern.
#   5. Removes the origin remote (filter-repo does this), re-adds it.
#   6. Expires reflog and runs aggressive garbage collection.
#   7. Prompts for a fresh PAT and force-pushes with --force-with-lease.
#   8. Verifies no secrets remain in history or the working tree.

set -Eeuo pipefail

# ---------- Configuration ----------
REPO_DIR="${1:-/d/zeal}"
REMOTE="${2:-origin}"
BRANCH="${3:-main}"
GIT_USER="${4:-zeal666222}"

# The two leaked PATs we know about.
LEAKED_PAT_1="REMOVED_TOKEN"
LEAKED_PAT_2="REMOVED_TOKEN"

# Files that may contain the secrets (will be removed from the working tree).
SUSPECT_FILES=( "fix-and-push.sh" "purge-pat.sh" "push-pat.sh" "purge.sh" "push.sh" )

# ---------- Colors & Logging ----------
C_RESET=$'\033[0m'
C_BLUE=$'\033[1;34m'
C_GREEN=$'\033[1;32m'
C_YELLOW=$'\033[1;33m'
C_RED=$'\033[1;31m'

log()  { printf '%s[INFO]%s %s\n'  "$C_BLUE"   "$C_RESET" "$*"; }
ok()   { printf '%s[ OK ]%s %s\n'  "$C_GREEN"  "$C_RESET" "$*"; }
warn() { printf '%s[WARN]%s %s\n'  "$C_YELLOW" "$C_RESET" "$*"; }
die()  { printf '%s[FAIL]%s %s\n'  "$C_RED"    "$C_RESET" "$*" >&2; exit 1; }

# ---------- Pre-flight ----------
command -v git >/dev/null 2>&1 || die "git not found in PATH"
[[ -d "$REPO_DIR/.git" ]] || die "Not a git repository: $REPO_DIR"

cd "$REPO_DIR"
log "Repository : $REPO_DIR"
log "Remote     : $REMOTE"
log "Branch     : $BRANCH"
log "Git user   : $GIT_USER"
echo

# ---------- Ensure origin exists ----------
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  log "Adding remote $REMOTE -> https://github.com/zeal666222/zeal.git"
  git remote add "$REMOTE" "https://github.com/zeal666222/zeal.git"
fi

# ---------- Backup ----------
BACKUP_DIR="/d/zeal-backup-$(date +%Y%m%d-%H%M%S)"
log "Creating backup at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
git bundle create "$BACKUP_DIR/repo.bundle" --all >/dev/null 2>&1
ok "Backup created: $BACKUP_DIR/repo.bundle"
echo

# ---------- Step 1: Remove suspect scripts from working tree ----------
log "Removing suspect scripts from working tree..."
for f in "${SUSPECT_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    git rm -f --cached "$f" >/dev/null 2>&1 || true
    rm -f "$f"
    log "Removed $f"
  fi
done

# Scrub setup.sh if it exists
if [[ -f "setup.sh" ]]; then
  log "Scrubbing setup.sh"
  sed -i -E "s/${LEAKED_PAT_1}/REMOVED_TOKEN/g" setup.sh 2>/dev/null || true
  sed -i -E "s/${LEAKED_PAT_2}/REMOVED_TOKEN/g" setup.sh 2>/dev/null || true
  sed -i -E 's/REMOVED_TOKEN/REMOVED_TOKEN/g' setup.sh 2>/dev/null || true
fi

# Commit working-tree changes so they enter history cleanup
git add -A >/dev/null 2>&1 || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "chore: drop scripts containing leaked tokens" >/dev/null 2>&1 || true
fi

# Verify working tree is clean of ghp_ patterns
if grep -RIn --exclude-dir=.git -E 'REMOVED_TOKEN' . >/dev/null 2>&1; then
  warn "Working tree still contains ghp_ patterns:"
  grep -RIn --exclude-dir=.git -E 'REMOVED_TOKEN' . || true
else
  ok "Working tree clean of ghp_ patterns"
fi
echo

# ---------- Step 2: Ensure git-filter-repo is available ----------
if ! command -v git-filter-repo >/dev/null 2>&1; then
  warn "git-filter-repo not found. Attempting to install via pip..."
  if command -v pip >/dev/null 2>&1; then
    pip install git-filter-repo >/dev/null 2>&1 || true
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install git-filter-repo >/dev/null 2>&1 || true
  elif command -v python >/dev/null 2>&1; then
    python -m pip install git-filter-repo >/dev/null 2>&1 || true
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m pip install git-filter-repo >/dev/null 2>&1 || true
  fi

  if ! command -v git-filter-repo >/dev/null 2>&1; then
    # Try to locate the module and create a shim
    PYTHON_BIN=""
    for p in python python3 py; do
      if command -v "$p" >/dev/null 2>&1; then
        if "$p" -c "import git_filter_repo" >/dev/null 2>&1; then
          PYTHON_BIN="$p"
          break
        fi
      fi
    done
    if [[ -n "$PYTHON_BIN" ]]; then
      FILTER_REPO_SHIM="$(mktemp)"
      cat > "$FILTER_REPO_SHIM" <<EOF
#!/usr/bin/env bash
exec "$PYTHON_BIN" -m git_filter_repo "\$@"
EOF
      chmod +x "$FILTER_REPO_SHIM"
      export PATH="$(dirname "$FILTER_REPO_SHIM"):$PATH"
      # Replace the command with a function to use the shim
      git-filter-repo() { "$FILTER_REPO_SHIM" "$@"; }
      export -f git-filter-repo 2>/dev/null || true
      warn "Using shim: $FILTER_REPO_SHIM"
    else
      die "Could not install git-filter-repo. Install manually: pip install git-filter-repo"
    fi
  fi
fi

log "git-filter-repo is available"
echo

# ---------- Step 3: Build replacement rules ----------
RULES_FILE="$(mktemp)"
{
  printf '%s==>REMOVED_TOKEN\n' "$LEAKED_PAT_1"
  printf '%s==>REMOVED_TOKEN\n' "$LEAKED_PAT_2"
  printf 'REMOVED_TOKEN==>REMOVED_TOKEN\n'
} > "$RULES_FILE"

log "Replacement rules:"
cat "$RULES_FILE"
echo

# ---------- Step 4: Rewrite history with git-filter-repo ----------
log "Running git-filter-repo (this may take a moment)..."
# Use --force to bypass "not a fresh clone" and other safety checks.
# --replace-text rewrites blob contents.
# --replace-message also scrubs commit messages.
if git filter-repo --force \
    --replace-text "$RULES_FILE" \
    --replace-message "$RULES_FILE" >/dev/null 2>&1; then
  ok "git-filter-repo completed"
else
  die "git-filter-repo failed. Check output above."
fi
rm -f "$RULES_FILE"

# git-filter-repo removes the origin remote as a safety measure.
# Re-add it.
log "Re-adding remote $REMOTE"
git remote add "$REMOTE" "https://github.com/zeal666222/zeal.git" 2>/dev/null || \
  git remote set-url "$REMOTE" "https://github.com/zeal666222/zeal.git"
log "Origin URL: $(git remote get-url "$REMOTE")"
echo

# ---------- Step 5: Expire reflog and garbage-collect ----------
log "Expiring reflog and running garbage collection..."
git reflog expire --expire=now --all >/dev/null 2>&1 || true
git gc --prune=now --aggressive >/dev/null 2>&1 || true
ok "Local repository cleaned"
echo

# ---------- Step 6: Verify no secrets remain in history ----------
log "Verifying history for ghp_ tokens..."
if git log -p --all -- . | grep -a -E 'REMOVED_TOKEN' >/dev/null 2>&1; then
  warn "A ghp_ token still appears in history. Showing matches:"
  git log -p --all -- . | grep -a -B2 -A2 'ghp_' || true
  die "History still contains secrets. Aborting."
else
  ok "No ghp_ tokens found in history"
fi

log "Verifying working tree for ghp_ tokens..."
if grep -RIn --exclude-dir=.git -E 'REMOVED_TOKEN' . >/dev/null 2>&1; then
  warn "Working tree still contains ghp_ patterns:"
  grep -RIn --exclude-dir=.git -E 'REMOVED_TOKEN' . || true
  die "Working tree still contains secrets. Aborting."
else
  ok "No ghp_ tokens found in working tree"
fi
echo

# ---------- Step 7: Prompt for fresh PAT ----------
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

# ---------- Step 8: Force-push rewritten history ----------
log "Force-pushing rewritten $BRANCH to $REMOTE ..."
if git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
    push "$REMOTE" "$BRANCH" --force-with-lease 2>&1; then
  ok "Push succeeded! 🎉"
else
  # If --force-with-lease fails because the remote ref moved, fall back to --force
  warn "Force-with-lease failed. Trying --force ..."
  git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
      push "$REMOTE" "$BRANCH" --force 2>&1 || die "Push failed. Check credentials and remote permissions."
  ok "Push succeeded with --force."
fi

echo
ok "All done."
warn "Reminder: Revoke the old tokens now: https://github.com/settings/tokens"
warn "Leaked tokens were: ${LEAKED_PAT_1:0:8}... and ${LEAKED_PAT_2:0:8}..."