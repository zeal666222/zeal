#!/usr/bin/env bash
# setup.sh — clean remote, scan, commit, push /d/zeal to zeal666222/zeal.
# No secrets stored. PAT prompted silently.

# -----------------------------------------------------------------------------
# Strict mode
#   -E  ERR trap inherits into functions
#   -e  exit on any non-zero command (outside conditionals)
#   -u  error on unset variables
#   -o pipefail  pipeline fails if any stage fails
# -----------------------------------------------------------------------------
set -Eeuo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_DIR="${REPO_DIR:-$SCRIPT_DIR}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
REMOTE_URL="${REMOTE_URL:-https://github.com/zeal666222/zeal.git}"
GIT_USER="${GIT_USER:-zeal666222}"
COMMIT_MSG="${COMMIT_MSG:-chore: sync $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
YES="${YES:-0}"
NO_COMMIT="${NO_COMMIT:-0}"

# -----------------------------------------------------------------------------
# Colors
# -----------------------------------------------------------------------------
C_R=$'\033[0m'
C_B=$'\033[1;34m'
C_G=$'\033[1;32m'
C_Y=$'\033[1;33m'
C_E=$'\033[1;31m'

log()  { printf '%s[>]%s %s\n' "$C_B" "$C_R" "$*"; }
ok()   { printf '%s[ok]%s %s\n' "$C_G" "$C_R" "$*"; }
warn() { printf '%s[!]%s %s\n'  "$C_Y" "$C_R" "$*"; }
die()  { printf '%s[x]%s %s\n'  "$C_E" "$C_R" "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# confirm "msg"  -> 0 if y/Y, 1 otherwise. Skipped when YES=1.
# -----------------------------------------------------------------------------
confirm() {
  if [[ "$YES" == "1" ]]; then
    return 0
  fi
  local a=""
  read -r -p "$1 [y/N] " a
  [[ "$a" =~ ^[Yy]$ ]]
}

# -----------------------------------------------------------------------------
# cleanup: wipe secrets from memory, delete temp askpass. Runs on EXIT.
# -----------------------------------------------------------------------------
cleanup() {
  unset GIT_PAT GIT_ASKPASS GIT_ASKPASS_REQUIRE GIT_TERMINAL_PROMPT
  if [[ -n "${ASKPASS_FILE:-}" && -f "${ASKPASS_FILE:-}" ]]; then
    rm -f -- "$ASKPASS_FILE"
  fi
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# on_err: print failing line + command. Runs on any ERR.
# -----------------------------------------------------------------------------
on_err() {
  local ec=$?
  printf '%s[ERR]%s line %s: %s (exit %s)\n' \
    "$C_E" "$C_R" "${1:-?}" "${2:-?}" "$ec" >&2
  exit "$ec"
}
trap 'on_err "$LINENO" "$BASH_COMMAND"' ERR

# =============================================================================
# STEP 1 — pre-flight
# =============================================================================

command -v git >/dev/null 2>&1 || die "git not found in PATH"
[[ -d "$REPO_DIR/.git" ]]       || die "not a git repository: $REPO_DIR"

cd -- "$REPO_DIR"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "not inside a work tree"
git symbolic-ref -q HEAD >/dev/null 2>&1 \
  || die "detached HEAD — checkout a branch first"

# Ensure target branch exists locally
if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  log "creating branch '$BRANCH'"
  git checkout -b "$BRANCH"
fi

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]]; then
  log "switching to branch '$BRANCH'"
  git checkout "$BRANCH"
fi

# ---- STEP 2 — strip any embedded credentials from the remote URL ----
CURRENT_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"

if [[ -n "$CURRENT_URL" ]]; then
  if [[ "$CURRENT_URL" == *"@"* ]]; then
    warn "remote URL contains embedded credentials — cleaning"
    warn "  was: ${CURRENT_URL%%@*}@..."
  fi
  git remote set-url "$REMOTE" "$REMOTE_URL"
else
  log "adding remote $REMOTE"
  git remote add "$REMOTE" "$REMOTE_URL"
fi

# ---- STEP 3 — clear any cached github.com credentials ----
printf 'protocol=https\nhost=github.com\n\n' | git credential reject 2>/dev/null || true

log "repo    : $REPO_DIR"
log "remote  : $REMOTE -> $(git remote get-url "$REMOTE")"
log "branch  : $BRANCH"
log "user    : $GIT_USER"
printf '\n'

# =============================================================================
# STEP 4 — fast secret scan
#   Uses git grep (single process) instead of per-file grep.
#   Scans staged diff first; falls back to tracked tree.
# =============================================================================

SECRET_RE='ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|ghr_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----'

log "scanning for secrets..."

STAGED_HITS=""
if ! git diff --cached --quiet 2>/dev/null; then
  STAGED_HITS="$(git diff --cached -U0 --no-color 2>/dev/null \
                  | grep -E -- "$SECRET_RE" \
                  | head -n 20 || true)"
fi

TRACKED_HITS=""
if [[ -z "$STAGED_HITS" ]]; then
  TRACKED_HITS="$(git grep -nE -- "$SECRET_RE" -- . 2>/dev/null | head -n 20 || true)"
fi

if [[ -n "$STAGED_HITS" ]]; then
  warn "secret pattern in staged changes:"
  printf '%s\n' "$STAGED_HITS" | sed 's/^/    /'
  die "refusing to commit — remove the secret or unstage"
fi

if [[ -n "$TRACKED_HITS" ]]; then
  warn "secret pattern in tracked files:"
  printf '%s\n' "$TRACKED_HITS" | sed 's/^/    /'
  die "refusing to commit — remove the secret before proceeding"
fi

ok "no secrets detected"
printf '\n'

# =============================================================================
# STEP 5 — summarize / stage / commit
# =============================================================================

UNTRACKED=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
MODIFIED=$(git ls-files -m | wc -l | tr -d ' ')
DELETED=$(git ls-files -d | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

log "staged=$STAGED  modified=$MODIFIED  deleted=$DELETED  untracked=$UNTRACKED"

if [[ "$NO_COMMIT" != "1" ]]; then
  if (( STAGED == 0 && MODIFIED == 0 && DELETED == 0 && UNTRACKED == 0 )); then
    ok "nothing to commit — working tree clean"
  else
    log "staging all changes (respecting .gitignore)"
    git add -A

    if git diff --cached --quiet; then
      ok "nothing staged after 'git add -A'"
    else
      log "staged files:"
      git diff --cached --name-status | head -n 40 | sed 's/^/    /'
      printf '\n'

      if confirm "commit as: \"$COMMIT_MSG\" ?"; then
        git commit -m "$COMMIT_MSG" >/dev/null
        ok "committed: $(git rev-parse --short HEAD)"
      else
        warn "commit skipped"
      fi
    fi
  fi
fi
printf '\n'

# =============================================================================
# STEP 6 — preview push
# =============================================================================

if git rev-parse --verify --quiet "$REMOTE/$BRANCH" >/dev/null; then
  AHEAD=$(git rev-list --count "$REMOTE/$BRANCH"..HEAD 2>/dev/null || echo 0)
  BEHIND=$(git rev-list --count HEAD.."$REMOTE/$BRANCH" 2>/dev/null || echo 0)
  log "vs $REMOTE/$BRANCH : ahead=$AHEAD  behind=$BEHIND"
  if (( AHEAD > 0 )); then
    log "commits to push:"
    git --no-pager log --oneline "$REMOTE/$BRANCH"..HEAD | sed 's/^/    /'
  fi
else
  AHEAD=$(git rev-list --count HEAD 2>/dev/null || echo 0)
  warn "remote branch not present locally — will be created"
  log "commits on branch: $AHEAD"
fi
printf '\n'

if (( ${AHEAD:-0} == 0 )); then
  warn "nothing new to push"
fi

# =============================================================================
# STEP 7 — prompt for PAT and build ephemeral askpass
# =============================================================================

echo "PAT must belong to '$GIT_USER' or an account with Write access to the repo."
echo

read -r -s -p "GitHub PAT for ${GIT_USER}: " GIT_PAT
printf '\n'
[[ -n "$GIT_PAT" ]] || die "empty PAT — aborting"

ASKPASS_FILE="$(mktemp "${TMPDIR:-/tmp}/git-askpass.XXXXXX")"

# Write helper without using any { } braces.
cat >"$ASKPASS_FILE" <<'ASKPASS'
#!/usr/bin/env bash
case "${1:-}" in
  *Username*|*username*) printf '%s\n' "$GIT_USER" ;;
  *Password*|*password*) printf '%s\n' "$GIT_PAT"  ;;
  *) exit 1 ;;
esac
ASKPASS

chmod 700 -- "$ASKPASS_FILE"

export GIT_PAT
export GIT_USER
export GIT_ASKPASS="$ASKPASS_FILE"
export GIT_ASKPASS_REQUIRE=force
export GIT_TERMINAL_PROMPT=0

# =============================================================================
# STEP 8 — push, with fetch+rebase fallback
# =============================================================================

log "pushing $BRANCH -> $REMOTE ..."

if git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
      push -u "$REMOTE" "$BRANCH"; then
  ok "push complete 🎉"
  exit 0
fi

warn "push failed — fetch + rebase + retry"

git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
    fetch "$REMOTE" || true

if git rev-parse --verify --quiet "$REMOTE/$BRANCH" >/dev/null; then
  git rebase "$REMOTE/$BRANCH" || die "rebase failed — resolve conflicts and re-run"
fi

git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
    push -u "$REMOTE" "$BRANCH" \
  || die "push failed (403? PAT belongs to wrong account or lacks write access)"

ok "push complete after rebase 🎉"