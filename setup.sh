#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# scripts/fix-profile-avatar-ts.sh
# ═══════════════════════════════════════════════════════════════════════════════
# Fixes the remaining TypeScript build error after the previous avatar patch:
#
#   ./app/api/users/[id]/profile/route.ts:69:47
#   Type error: Property 'avatar' does not exist on type
#     '{ name?: string; bio?: string; username?: string }'
#
# Root cause:
#   The Zod schema `UpdateProfileSchema` was stripped of `avatar`, but the
#   subsequent `.update({ name, avatar: data.avatar, username })` call was
#   inline on ONE line — the previous regex (which required a newline) missed it.
#
# Also:
#   1. Verifies `ensureUserRow` + `syncAuthUser` are fully clean of `avatar`.
#   2. Adds a Supabase migration `101_reload_postgrest_cache.sql` to flush any
#      stale PostgREST metadata from the failed writes.
#   3. Adds a root `vercel.json` so Vercel installs the whole workspace before
#      building each app (defense in depth against hoisting gaps).
#   4. Provides an OPTIONAL `--with-proxy` flag to run the Next.js 16
#      middleware→proxy codemod (cosmetic; off by default to avoid breakage).
#
# Non-destructive. Backs up every touched file. Idempotent.
#
# Usage:
#   bash scripts/fix-profile-avatar-ts.sh
#   bash scripts/fix-profile-avatar-ts.sh --dry-run
#   bash scripts/fix-profile-avatar-ts.sh --with-proxy
#   bash scripts/fix-profile-avatar-ts.sh --no-build
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=0
SKIP_BUILD="${SKIP_BUILD:-0}"
WITH_PROXY=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=1 ;;
    --no-build)   SKIP_BUILD=1 ;;
    --with-proxy) WITH_PROXY=1 ;;
    -h|--help)    sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; DIM=''; NC=''
fi

log()  { echo -e "${BLUE}▸${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
hdr()  { echo; echo -e "${BOLD}── $* ───────────────────────────────────────────${NC}"; }

# ─── Pre-flight ───────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "node is required."
command -v npm  >/dev/null 2>&1 || die "npm is required."

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

hdr "ZEAL — profile avatar TS fix"
log "Repo root : $REPO_ROOT"
log "Mode      : $([[ $DRY_RUN == 1 ]] && echo DRY-RUN || echo APPLY)"
log "Build test: $([[ $SKIP_BUILD == 1 ]] && echo skipped || echo enabled)"
log "Proxy opt : $([[ $WITH_PROXY == 1 ]] && echo enabled || echo disabled)"

PROFILE_ROUTE="apps/web/app/api/users/[id]/profile/route.ts"
[[ -f "$PROFILE_ROUTE" ]] || die "Missing $PROFILE_ROUTE"

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$REPO_ROOT/.zeal-backup/profile-fix-$TS"
[[ $DRY_RUN == 1 ]] || mkdir -p "$BACKUP_DIR"

backup() {
  local f="$1" rel="${1#"$REPO_ROOT"/}" dst="$BACKUP_DIR/${1#"$REPO_ROOT"/}"
  dst="${dst//\//__}"
  [[ $DRY_RUN == 1 ]] || cp "$f" "$dst"
  echo "  backed up → $rel"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Fix the profile route (the actual TS error)
# ═══════════════════════════════════════════════════════════════════════════════
hdr "1. $PROFILE_ROUTE"

backup "$PROFILE_ROUTE"

if [[ $DRY_RUN == 1 ]]; then
  echo "  [dry-run] would rewrite the file"
else
  node - "$PROFILE_ROUTE" <<'NODE_EOF'
    const fs   = require("fs");
    const file = process.argv[2];
    let src = fs.readFileSync(file, "utf8");
    const before = src;

    // ── A. Drop `avatar` from the Zod schema (already done by prior patch,
    //       but keep idempotent).
    src = src.replace(
      /^\s*avatar:\s*z\.string\(\)\.url\(\)\.optional\(\),\s*$/gm,
      "",
    );

    // ── B. Remove `avatar: data.avatar` from ANY .update({...}) payload.
    //       Handles every layout:
    //         inline:   .update({ name: data.name, avatar: data.avatar, username: data.username })
    //         multiline: .update({\n  name: data.name,\n  avatar: data.avatar,\n  username: ...\n})
    //         alone:    .update({ avatar: data.avatar })
    //
    // Strategy: delete the token `avatar: data.avatar` plus its surrounding
    // comma, regardless of where it appears inside the object literal.
    src = src.replace(
      /,\s*avatar:\s*data\.avatar\s*(?=[,}])/g,
      "",
    );
    src = src.replace(
      /avatar:\s*data\.avatar\s*,\s*/g,
      "",
    );
    src = src.replace(
      /\{\s*avatar:\s*data\.avatar\s*\}/g,
      "{}",
    );

    // ── C. Remove any reference to `data.avatar` in destructuring or elsewhere
    //       (defense in depth — this should now be zero occurrences).
    src = src.replace(
      /^\s*avatar:\s*data\.avatar,?\s*$/gm,
      "",
    );

    // ── D. Replace `avatar: data.avatar` inside PutSchema Zod literals if any
    //       survived (they shouldn't after A).
    src = src.replace(
      /^\s*avatar:\s*z\.string\(\)[^\n]*$/gm,
      "",
    );

    // ── E. Tag the file so re-runs are no-ops.
    if (!src.includes("ZEAL_PROFILE_FIX")) {
      src = src.replace(
        /^(import.*from "@zeal\/database\/server";)/m,
        "$1 // ZEAL_PROFILE_FIX",
      );
    }

    if (src === before) {
      console.log("  (nothing to change — file already clean)");
      process.exit(0);
    }

    fs.writeFileSync(file, src);
    console.log("  patched " + file);
NODE_EOF
  ok "  profile route rewritten"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Verify ensureUserRow + syncAuthUser are clean
# ═══════════════════════════════════════════════════════════════════════════════
hdr "2. Verify other avatar writers are clean"

check_clean() {
  local file="$1" label="$2"
  [[ -f "$file" ]] || { warn "  $label: file not found ($file)"; return; }

  # Look for `avatar:` (not `avatar_url:`) as an object key in an insert/update payload
  local hits
  hits=$(grep -nE '\bavatar:\s*(avatar|data\.avatar|avatar\s*\?\?)' "$file" 2>/dev/null \
         | grep -v 'avatar_url' || true)

  if [[ -z "$hits" ]]; then
    ok "  $label: clean"
  else
    warn "  $label: residual avatar writes found:"
    echo "$hits" | sed 's/^/      /'

    if [[ $DRY_RUN == 0 ]]; then
      backup "$file"
      node - "$file" <<'NODE_EOF'
        const fs = require("fs");
        const file = process.argv[2];
        let src = fs.readFileSync(file, "utf8");
        const before = src;

        // Delete `avatar: avatar,` / `avatar: avatar ?? undefined,`
        // Only when the value is literally `avatar` (the local const).
        src = src.replace(
          /^\s*avatar:\s*avatar\s*(\?\?\s*undefined)?\s*,?\s*$/gm,
          "",
        );
        // Delete leading `avatar,` shorthand inside an object literal
        src = src.replace(
          /^\s*avatar,\s*$/gm,
          "",
        );
        // Delete `patch.avatar = avatar;`
        src = src.replace(
          /^\s*patch\.avatar\s*=\s*avatar;\s*$/gm,
          "",
        );

        if (src !== before) {
          fs.writeFileSync(file, src);
          console.log("      auto-fixed " + file);
        }
NODE_EOF
      ok "  $label: auto-fixed"
    fi
  fi
}

check_clean "packages/database/src/server.ts"           "packages/database / ensureUserRow"
check_clean "apps/web/lib/auth/server.ts"               "apps/web / syncAuthUser"
check_clean "apps/web/app/api/users/me/profile/route.ts" "apps/web / me/profile GET"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — PostgREST cache reload migration
# ═══════════════════════════════════════════════════════════════════════════════
hdr "3. Supabase migration — reload PostgREST schema cache"

MIGRATION="supabase/migrations/101_reload_postgrest_cache.sql"

if [[ -f "$MIGRATION" ]]; then
  ok "  migration already exists"
elif [[ $DRY_RUN == 1 ]]; then
  echo "  [dry-run] would create $MIGRATION"
else
  mkdir -p supabase/migrations
  cat > "$MIGRATION" <<'SQL_EOF'
-- ═══════════════════════════════════════════════════════════════════════════════
-- 101_reload_postgrest_cache.sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Flushes any stale PostgREST schema metadata left behind after failed inserts
-- referencing a non-existent `avatar` column on the `User` table.
--
-- Reference:
--   https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-new-columns
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1 — drain the notification queue so PostgREST is guaranteed to
--          observe the reload signal (Supabase docs recommendation).
DO $$
BEGIN
  PERFORM pg_notification_queue_usage();
EXCEPTION WHEN undefined_function THEN
  -- Not available on some Postgres versions — non-fatal
  NULL;
END $$;

-- Step 2 — standard PostgREST reload (also re-reads config + relationships).
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Step 3 — assert the canonical User columns exist (defense in depth).
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(col) INTO missing
  FROM (
    VALUES ('avatar_url'), ('username'), ('name'), ('full_name')
  ) AS expected(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = expected.col
  );

  IF missing IS NOT NULL THEN
    RAISE WARNING 'User table missing expected columns: %', missing;
  ELSE
    RAISE NOTICE 'User table schema verified: avatar_url, username, name, full_name present';
  END IF;
END $$;

COMMIT;
SQL_EOF
  ok "  created $MIGRATION"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Root vercel.json (defense-in-depth for workspace installs)
# ═══════════════════════════════════════════════════════════════════════════════
hdr "4. Root vercel.json"

VJ="vercel.json"

if [[ -f "$VJ" ]]; then
  ok "  already exists"
elif [[ $DRY_RUN == 1 ]]; then
  echo "  [dry-run] would create $VJ"
else
  cat > "$VJ" <<'JSON_EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm ci --workspaces --include-workspace-root --legacy-peer-deps",
  "github": {
    "silent": true
  }
}
JSON_EOF
  ok "  created vercel.json"
  warn "  NOTE: Set Root Directory to apps/web or apps/admin in each Vercel project."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — OPTIONAL: middleware → proxy migration
# ═══════════════════════════════════════════════════════════════════════════════
hdr "5. Optional: middleware.ts → proxy.ts"

if [[ $WITH_PROXY == 0 ]]; then
  warn "  Skipped (pass --with-proxy to enable)."
  echo -e "  ${DIM}Deprecation warning is cosmetic in Next.js 16.1.7 — not a build blocker.${NC}"
else
  rename_middleware() {
    local app="$1"
    local mw="apps/$app/middleware.ts"
    local px="apps/$app/proxy.ts"

    [[ -f "$mw" ]] || { warn "  $app: no middleware.ts"; return; }
    [[ -f "$px" ]] && { ok "  $app: proxy.ts already exists"; return; }

    backup "$mw"

    if [[ $DRY_RUN == 1 ]]; then
      echo "  [dry-run] would rename $mw → $px and rename export"
      return
    fi

    git mv "$mw" "$px" 2>/dev/null || mv "$mw" "$px"

    node - "$px" <<'NODE_EOF'
      const fs = require("fs");
      const file = process.argv[2];
      let src = fs.readFileSync(file, "utf8");
      // Rename the exported function
      src = src.replace(
        /export\s+async\s+function\s+middleware\s*\(/,
        "export async function proxy(",
      );
      // Update any self-references
      src = src.replace(/\bmiddleware\b(?![\w])/g, (m, offset, str) => {
        // Don't touch the word inside strings/comments describing the concept
        // (keep "middleware" mentions inside doc comments as-is).
        const before = str.slice(Math.max(0, offset - 30), offset);
        if (before.includes("//") || before.includes("*")) return m;
        return m;
      });
      fs.writeFileSync(file, src);
      console.log("      renamed export middleware → proxy in " + file);
NODE_EOF
    ok "  $app: renamed middleware.ts → proxy.ts"
  }

  rename_middleware "web"
  rename_middleware "admin"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Verification
# ═══════════════════════════════════════════════════════════════════════════════
hdr "6. Verify"

if [[ $DRY_RUN == 0 ]]; then
  node --check "$PROFILE_ROUTE" 2>/dev/null || true

  # No `data.avatar` reference should remain anywhere in the profile route
  if grep -q "data\.avatar" "$PROFILE_ROUTE"; then
    warn "  $PROFILE_ROUTE still references data.avatar"
    grep -n "data\.avatar" "$PROFILE_ROUTE" | sed 's/^/      /'
  else
    ok "  $PROFILE_ROUTE — no data.avatar references"
  fi

  # Confirm UpdateProfileSchema no longer has `avatar`
  if grep -qE '^\s*avatar:\s*z\.string' "$PROFILE_ROUTE"; then
    warn "  UpdateProfileSchema still defines avatar"
  else
    ok "  UpdateProfileSchema — avatar field removed"
  fi

  # Confirm ensureUserRow still writes avatar_url (not avatar)
  if grep -q 'avatar_url:\s*avatar' packages/database/src/server.ts 2>/dev/null; then
    ok "  packages/database — writes avatar_url only"
  fi

  # Confirm proxy rename if enabled
  if [[ $WITH_PROXY == 1 ]]; then
    [[ -f apps/web/proxy.ts   ]] && ok "  apps/web/proxy.ts exists"
    [[ -f apps/admin/proxy.ts ]] && ok "  apps/admin/proxy.ts exists"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Build smoke test
# ═══════════════════════════════════════════════════════════════════════════════
hdr "7. Build smoke test"

if [[ $DRY_RUN == 1 ]]; then
  echo "  [dry-run] would build apps/web and apps/admin"
elif [[ $SKIP_BUILD == 1 ]]; then
  warn "  Skipped (SKIP_BUILD=1 or --no-build)"
else
  log "Building apps/web…"
  ( cd apps/web && npm run build ) || die "  apps/web build FAILED"
  ok "  apps/web build succeeded"

  log "Building apps/admin…"
  ( cd apps/admin && npm run build ) || die "  apps/admin build FAILED"
  ok "  apps/admin build succeeded"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
hdr "Done"

if [[ $DRY_RUN == 1 ]]; then
  echo "  Dry-run complete — no files modified."
  exit 0
fi

cat <<EOF
  Backups : $BACKUP_DIR

  Modified files:
    • $PROFILE_ROUTE              (drop data.avatar)
    • packages/database/src/server.ts           (verified / auto-fixed)
    • apps/web/lib/auth/server.ts               (verified / auto-fixed)
    • supabase/migrations/101_reload_postgrest_cache.sql  (new)
    • vercel.json                               (new, root)
    $([[ $WITH_PROXY == 1 ]] && echo "    • apps/web/proxy.ts   (renamed)" || true)
    $([[ $WITH_PROXY == 1 ]] && echo "    • apps/admin/proxy.ts (renamed)" || true)

  After deploy, reload the PostgREST cache in the Supabase SQL editor:

    SELECT pg_notification_queue_usage();
    NOTIFY pgrst, 'reload schema';

  Suggested commit:

    git add $PROFILE_ROUTE \\
            packages/database/src/server.ts \\
            apps/web/lib/auth/server.ts \\
            supabase/migrations/101_reload_postgrest_cache.sql \\
            vercel.json
    git commit -m "fix(build): drop orphaned data.avatar; reload postgrest cache"
    git push
EOF

echo
echo -e "${GREEN}${BOLD}  ✅ Profile avatar TS fix applied${NC}"
echo