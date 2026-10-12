#!/usr/bin/env bash
# setup.sh — scan, commit, push /d/kalkicore to its GitHub origin.
# No secrets are stored in this file. The PAT is prompted silently at runtime.
#
# Usage:  ./setup.sh
# Env:    COMMIT_MSG="..."   override commit message
#         YES=1              skip confirmations
#         NO_COMMIT=1        push only, do not commit
#         BRANCH=main        target branch (default: current branch)
#         GIT_USER=...       GitHub username for Basic auth (auto-detected from remote URL)

# -----------------------------------------------------------------------------
# Shell strict mode:
#   -E  ERR trap inherits into functions/subshells
#   -e  exit on any command that returns non-zero (unless in a condition)
#   -u  error on unset variable expansion
#   -o pipefail  a pipeline fails if any stage fails, not just the last
# -----------------------------------------------------------------------------
set -Eeuo pipefail

# -----------------------------------------------------------------------------
# Resolve this script's directory so the script works from any CWD.
#   BASH_SOURCE[0]  path of this script
#   dirname         strip the filename
#   cd ... && pwd   absolute, symlink-resolved path
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

# -----------------------------------------------------------------------------
# Configuration with safe defaults, overridable via environment.
#   ${VAR:-default}  use $VAR if set and non-empty, else default
# -----------------------------------------------------------------------------
REPO_DIR="${REPO_DIR:-$SCRIPT_DIR}"                 # repo root = this script's dir
REMOTE="${REMOTE:-origin}"                          # git remote name
BRANCH="${BRANCH:-$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
COMMIT_MSG="${COMMIT_MSG:-chore: sync $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
YES="${YES:-0}"                                     # 1 = skip prompts
NO_COMMIT="${NO_COMMIT:-0}"                         # 1 = do not auto-commit

# -----------------------------------------------------------------------------
# ANSI colors. Using $'...' so \033 is interpreted once, at assignment.
# -----------------------------------------------------------------------------
C_RESET=$'\033[0m'
C_BLUE=$'\033[1;34m'
C_GREEN=$'\033[1;32m'
C_YELLOW=$'\033[1;33m'
C_RED=$'\033[1;31m'

# -----------------------------------------------------------------------------
# Logging helpers. printf (not echo) so escape codes are portable.
# All output to stdout except die(), which goes to stderr.
# -----------------------------------------------------------------------------
log()  { printf '%s[INFO]%s %s\n' "$C_BLUE"   "$C_RESET" "$*"; }
ok()   { printf '%s[ OK ]%s %s\n' "$C_GREEN"  "$C_RESET" "$*"; }
warn() { printf '%s[WARN]%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()  { printf '%s[FAIL]%s %s\n' "$C_RED"    "$C_RESET" "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# confirm "message" -> returns 0 if user types y/Y, 1 otherwise.
# Skips the prompt entirely when YES=1.
# -----------------------------------------------------------------------------
confirm() {
  if [[ "$YES" == "1" ]]; then
    return 0
  fi
  local answer=""
  read -r -p "$1 [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

# -----------------------------------------------------------------------------
# Global cleanup trap. Runs on EXIT (success or failure).
# Wipes secrets from memory and removes the temp askpass script.
# shellcheck disable=SC2317  # called via trap, not directly
# -----------------------------------------------------------------------------
cleanup() {
  unset GIT_PAT GIT_ASKPASS GIT_ASKPASS_REQUIRE GIT_TERMINAL_PROMPT
  if [[ -n "${ASKPASS_FILE:-}" && -f "${ASKPASS_FILE:-}" ]]; then
    rm -f -- "$ASKPASS_FILE"
  fi
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# ERR trap: print the failing line and command before exiting.
# -----------------------------------------------------------------------------
on_error() {
  local exit_code=$?
  local line_no=${1:-?}
  local cmd=${2:-?}
  printf '%s[ERR ]%s line %s: %s (exit %s)\n' \
    "$C_RED" "$C_RESET" "$line_no" "$cmd" "$exit_code" >&2
  exit "$exit_code"
}
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

# =============================================================================
# STEP 1 — Pre-flight checks
# =============================================================================

command -v git >/dev/null 2>&1 || die "git not found in PATH"
[[ -d "$REPO_DIR/.git" ]]      || die "not a git repository: $REPO_DIR"

cd -- "$REPO_DIR"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "not inside a work tree"
git symbolic-ref -q HEAD >/dev/null 2>&1 \
  || die "detached HEAD — checkout a branch first"

# Ensure branch exists locally; create if missing.
if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  log "creating branch '$BRANCH'"
  git checkout -b "$BRANCH"
elif [[ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]]; then
  log "switching to branch '$BRANCH'"
  git checkout "$BRANCH"
fi

# -----------------------------------------------------------------------------
# Derive GIT_USER from the remote URL if not already exported.
# Handles both HTTPS (github.com/user/repo.git) and SSH (git@github.com:user/repo.git).
# -----------------------------------------------------------------------------
REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
[[ -n "$REMOTE_URL" ]] || die "remote '$REMOTE' has no URL"

if [[ -z "${GIT_USER:-}" ]]; then
  case "$REMOTE_URL" in
    https://github.com/*)
      # Strip prefix and trailing /.git and path after user
      GIT_USER="${REMOTE_URL#https://github.com/}"
      GIT_USER="${GIT_USER%%/*}"
      ;;
    git@github.com:*)
      GIT_USER="${REMOTE_URL#git@github.com:}"
      GIT_USER="${GIT_USER%%/*}"
      ;;
    *)
      die "cannot derive GIT_USER from remote URL: $REMOTE_URL (set GIT_USER=...)"
      ;;
  esac
fi
export GIT_USER

log "repo    : $REPO_DIR"
log "remote  : $REMOTE -> $REMOTE_URL"
log "branch  : $BRANCH"
log "user    : $GIT_USER"
printf '\n'

# =============================================================================
# STEP 2 — Secret scan (tracked + untracked + staged)
# Refuses to proceed if any pattern matches. Adjust PATTERNS as needed.
# =============================================================================

PATTERNS=(
  'ghp_[A-Za-z0-9]{20,}'                          # GitHub PAT (classic)
  'github_pat_[A-Za-z0-9_]{20,}'                  # GitHub PAT (fine-grained)
  'gho_[A-Za-z0-9]{20,}'                          # GitHub OAuth
  'ghs_[A-Za-z0-9]{20,}'                          # GitHub server-to-server
  'ghr_[A-Za-z0-9]{20,}'                          # GitHub refresh
  'AKIA[0-9A-Z]{16}'                              # AWS access key
  'sk-[A-Za-z0-9]{20,}'                           # OpenAI / Stripe-style
  'xox[baprs]-[A-Za-z0-9-]{10,}'                  # Slack
  '-----BEGIN (RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----'
)
SECRET_RE="$(IFS='|'; printf '%s' "${PATTERNS[*]}")"
export SECRET_RE

# Scan a NUL-delimited list of files from stdin; echo offending paths.
scan_files() {
  local f
  while IFS= read -r -d '' f; do
    [[ -f "$f" ]] || continue
    if grep -IlE -- "$SECRET_RE" -- "$f" >/dev/null 2>&1; then
      printf '%s\n' "$f"
    fi
  done
}

log "scanning for secrets..."

# 2a) tracked files
mapfile -t TRACKED_HITS < <(git ls-files -z | scan_files || true)

# 2b) untracked files (respect .gitignore)
mapfile -t UNTRACKED_HITS < <(git ls-files --others --exclude-standard -z | scan_files || true)

# 2c) staged diff (secret added in staging even if file is new)
STAGED_HIT=0
if git diff --cached --no-color 2>/dev/null | grep -E -- "$SECRET_RE" >/dev/null 2>&1; then
  STAGED_HIT=1
fi

if (( ${#TRACKED_HITS[@]} > 0 )); then
  warn "tracked files with secret patterns:"
  printf '    %s\n' "${TRACKED_HITS[@]}"
fi
if (( ${#UNTRACKED_HITS[@]} > 0 )); then
  warn "untracked files with secret patterns:"
  printf '    %s\n' "${UNTRACKED_HITS[@]}"
fi
if (( STAGED_HIT == 1 )); then
  warn "staged diff contains a secret pattern"
fi

if (( ${#TRACKED_HITS[@]} > 0 || ${#UNTRACKED_HITS[@]} > 0 || STAGED_HIT == 1 )); then
  die "secrets detected — refusing to commit or push"
fi
ok "no obvious secrets detected"
printf '\n'

# =============================================================================
# STEP 3 — Summarize the working tree
# =============================================================================

UNTRACKED=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
MODIFIED=$(git ls-files -m | wc -l | tr -d ' ')
DELETED=$(git ls-files -d | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

log "staged=$STAGED  modified=$MODIFIED  deleted=$DELETED  untracked=$UNTRACKED"

if (( UNTRACKED > 0 )); then
  log "untracked (first 40):"
  git ls-files --others --exclude-standard | head -n 40 | sed 's/^/    /'
  if (( UNTRACKED > 40 )); then
    printf '    ... (%d more)\n' "$((UNTRACKED - 40))"
  fi
fi
printf '\n'

# =============================================================================
# STEP 4 — Stage & commit
# =============================================================================

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
      git diff --cached --name-status | sed 's/^/    /'
      printf '\n'
      if confirm "commit these changes as: \"$COMMIT_MSG\" ?"; then
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
# STEP 5 — Show what will be pushed
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
# STEP 6 — Prompt for PAT (silent) and prepare askpass
# =============================================================================

read -r -s -p "GitHub PAT for ${GIT_USER}: " GIT_PAT
printf '\n'
[[ -n "$GIT_PAT" ]] || die "empty PAT — aborting"

# ASKPASS helper: git calls this with "Username for ..." and "Password for ...".
# We answer with $GIT_USER and $GIT_PAT respectively. File is 0700 and removed
# by the EXIT trap.
ASKPASS_FILE="$(mktemp "${TMPDIR:-/tmp}/git-askpass.XXXXXX")"
cat >"$ASKPASS_FILE" <<'ASKPASS'
#!/usr/bin/env bash
prompt="${1:-}"
case "$prompt" in
  *Username*|*username*) printf '%s\n' "$GIT_USER" ;;
  *Password*|*password*) printf '%s\n' "$GIT_PAT"  ;;
  *) exit 1 ;;
esac
ASKPASS
chmod 700 -- "$ASKPASS_FILE"

export GIT_PAT
export GIT_ASKPASS="$ASKPASS_FILE"
export GIT_ASKPASS_REQUIRE=force         # force askpass even with a TTY
export GIT_TERMINAL_PROMPT=0             # never prompt interactively

# =============================================================================
# STEP 7 — Push
# -----------------------------------------------------------------------------
# Notes:
#   -c credential.helper=  disables any cached credential helper for this call
#   -c core.askPass=...    points git at our ephemeral helper
# --force-with-lease is NOT used here (this is a normal push).
# =============================================================================

log "pushing $BRANCH -> $REMOTE ..."
if git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
      push -u "$REMOTE" "$BRANCH"; then
  ok "push complete 🎉"
  printf '\n'
  ok "done."
  exit 0
fi

# -----------------------------------------------------------------------------
# Push failed: try fetching + rebasing, then push again.
# -----------------------------------------------------------------------------
warn "push failed — trying fetch + rebase then retry"
git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
    fetch "$REMOTE" || true

if git rev-parse --verify --quiet "$REMOTE/$BRANCH" >/dev/null; then
  git rebase "$REMOTE/$BRANCH" \
    || die "rebase failed — resolve conflicts and re-run"
fi

git -c credential.helper= -c core.askPass="$ASKPASS_FILE" \
    push -u "$REMOTE" "$BRANCH" \
  || die "push failed (403? PAT lacks write access to $REMOTE_URL?)"

ok "push complete after rebase 🎉"
printf '\n'
ok "done."