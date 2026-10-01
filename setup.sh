#!/usr/bin/env bash
# =============================================================================
#  ZEAL REPO SYNC — pull → stage → commit → push
#  Token is embedded — do NOT commit this file
# =============================================================================

set -Eeuo pipefail

R="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$R"

ok()   { printf '\033[0;32m[OK]\033[0m   %s\n' "$1"; }
info() { printf '\033[0;36m[INFO]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$1"; }
err()  { printf '\033[0;31m[ERR]\033[0m  %s\n' "$1" >&2; }

TOKEN="REMOVED_TOKEN"
USER="zeal666222"
OWNER="zeal666222"
REPO="zeal"
BRANCH="main"
CLEAN_URL="https://github.com/${OWNER}/${REPO}.git"
AUTH_URL="https://${USER}:${TOKEN}@github.com/${OWNER}/${REPO}.git"

# Restore tokenless URL on any exit
restore() {
  git remote set-url origin "$CLEAN_URL" 2>/dev/null || true
}
trap restore EXIT INT TERM

# ── Verify repo ──────────────────────────────────────────────────────────
if [ ! -d "$R/.git" ]; then
  err "Not a git repo: $R"
  exit 1
fi

printf '\n\033[1;35m=== ZEAL SYNC ===\033[0m\n'
info "Repo:   $OWNER/$REPO"
info "Branch: $BRANCH"

# ── Attach token ─────────────────────────────────────────────────────────
git remote set-url origin "$AUTH_URL"
ok "Token attached"

# ── Fetch ────────────────────────────────────────────────────────────────
info "Fetching origin/$BRANCH"
if git fetch origin "$BRANCH" 2>&1 | tail -3; then
  ok "Fetched"
else
  warn "Fetch failed — origin/$BRANCH may not exist"
fi

# ── Integrate remote changes ─────────────────────────────────────────────
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  LOCAL="$(git rev-parse HEAD 2>/dev/null || echo '')"
  REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo '')"
  BASE="$(git merge-base HEAD "origin/$BRANCH" 2>/dev/null || echo '')"

  if [ "$LOCAL" = "$REMOTE" ]; then
    ok "Already up to date"
  elif [ "$LOCAL" = "$BASE" ]; then
    info "Fast-forwarding"
    git merge --ff-only "origin/$BRANCH"
    ok "Fast-forwarded"
  elif [ "$REMOTE" = "$BASE" ]; then
    ok "Local ahead — nothing to pull"
  else
    info "Diverged — rebasing local on origin"
    if git rebase "origin/$BRANCH" 2>&1 | tail -5; then
      ok "Rebased"
    else
      err "Rebase conflict"
      printf '\nResolve and continue:\n'
      printf '  git add <files>\n'
      printf '  git rebase --continue\n\n'
      printf 'Or abort:\n'
      printf '  git rebase --abort\n\n'
      exit 1
    fi
  fi
else
  info "Remote branch does not exist yet"
fi

# ── Stage ────────────────────────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  STAGED="$(git diff --cached --name-only | wc -l | tr -d ' ')"
  ok "Staged $STAGED file(s)"
else
  ok "Nothing to stage"
  STAGED=0
fi

# ── Commit ───────────────────────────────────────────────────────────────
if [ "$STAGED" -gt 0 ]; then
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "${USER}@users.noreply.github.com"
  fi
  if ! git config user.name >/dev/null 2>&1; then
    git config user.name "$USER"
  fi

  git commit -m "sync: $(date -u +%Y-%m-%dT%H:%M:%SZ)" 2>&1 | tail -2
  ok "Committed"
else
  info "No commit needed"
fi

# ── Push ─────────────────────────────────────────────────────────────────
LOCAL="$(git rev-parse HEAD 2>/dev/null || echo '')"
REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo '')"

if [ "$LOCAL" = "$REMOTE" ]; then
  ok "Nothing to push"
else
  info "Pushing to origin/$BRANCH"
  if git push origin "$BRANCH" 2>&1 | tail -5; then
    ok "Pushed"
  else
    warn "Normal push failed — trying force-with-lease"
    if git push --force-with-lease origin "$BRANCH" 2>&1 | tail -5; then
      ok "Force-pushed"
    else
      err "Push failed"
      printf '\nCheck:\n'
      printf '  1. Token valid: https://github.com/settings/tokens\n'
      printf '  2. Repo exists: https://github.com/%s/%s\n' "$OWNER" "$REPO"
      printf '  3. Token has repo scope\n\n'
      exit 1
    fi
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────
printf '\n\033[1;32m=== DONE ===\033[0m\n\n'
info "Local HEAD:  $(git log -1 --oneline)"
info "Remote HEAD: $(git log "origin/$BRANCH" -1 --oneline 2>/dev/null || echo 'unknown')"
printf '\n'
printf '\033[1;33mREMINDER: Revoke the token at https://github.com/settings/tokens\033[0m\n\n'

exit 0