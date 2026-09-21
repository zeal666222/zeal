#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — FIX ADMIN BUILD (server-only leak)
# ═══════════════════════════════════════════════════════════════════════════════
# Idempotent. Backs up every touched file.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$REPO/package.json" && -d "$REPO/apps" ]] || {
  echo "✗ Run from the Zeal repo root."
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BK="$REPO/.zeal-backup/build-fix-$STAMP"
mkdir -p "$BK"

if [[ -t 1 ]]; then
  G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; N='\033[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
ok()   { echo -e "${G}✓${N} $1"; }
warn() { echo -e "${Y}○${N} $1"; }
fail() { echo -e "${R}✗${N} $1"; }
info() { echo -e "${B}→${N} $1"; }

backup() {
  [[ -f "$1" ]] || return 0
  local rel="${1#$REPO/}"
  local dst="$BK/$rel"
  mkdir -p "$(dirname "$dst")"
  cp "$1" "$dst"
}

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ZEAL — FIX ADMIN BUILD"
echo "  Backup: .zeal-backup/build-fix-$STAMP"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Remove `import "server-only"` from session.ts and api-guard.ts
# ─────────────────────────────────────────────────────────────────────────────
info "Step 1/5 — removing server-only tripwire from new DB helpers"

for f in \
  "$REPO/packages/database/src/session.ts" \
  "$REPO/packages/database/src/api-guard.ts"
do
  if [[ -f "$f" ]]; then
    if grep -q '^import "server-only";' "$f"; then
      backup "$f"
      # Remove the line (and any following blank line)
      perl -i -0pe 's/^import "server-only";\n\n?//m' "$f"
      ok "removed server-only import: ${f#$REPO/}"
    else
      warn "no server-only import: ${f#$REPO/}"
    fi
  else
    warn "missing: ${f#$REPO/}"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Also remove it from the old api-guard in apps/web (if present)
# ─────────────────────────────────────────────────────────────────────────────
info "Step 2/5 — checking for any other server-only leaks in app code"

LEAKS=$(grep -rn 'import "server-only"' \
  "$REPO/apps" \
  "$REPO/packages" \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules || true)

if [[ -n "$LEAKS" ]]; then
  echo "$LEAKS" | while read -r line; do
    echo "  $line"
  done
else
  ok "no server-only imports remain"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Verify no client file imports from @zeal/database/session or /api-guard
# ─────────────────────────────────────────────────────────────────────────────
info "Step 3/5 — scanning for client-side imports of server-only subpaths"

VIOLATIONS=0

while IFS= read -r file; do
  # Only check files that start with "use client"
  if head -n 3 "$file" | grep -q '"use client"'; then
    if grep -qE 'from "(@zeal/database/session|@zeal/database/api-guard)"|from "@/lib/auth/dal"|from "@/lib/auth/api-guard"' "$file" 2>/dev/null; then
      fail "client file imports server-only subpath: ${file#$REPO/}"
      VIOLATIONS=$((VIOLATIONS+1))
    fi
  fi
done < <(find "$REPO/apps" -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.next/*")

if [[ $VIOLATIONS -eq 0 ]]; then
  ok "no client files import server-only subpaths"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Nuke caches (Next.js 16 caches module graphs aggressively)
# ─────────────────────────────────────────────────────────────────────────────
info "Step 4/5 — clearing Next.js + webpack caches"

rm -rf "$REPO/apps/admin/.next" 2>/dev/null && ok "removed apps/admin/.next" || warn "apps/admin/.next already gone"
rm -rf "$REPO/apps/web/.next" 2>/dev/null && ok "removed apps/web/.next" || warn "apps/web/.next already gone"
rm -rf "$REPO/node_modules/.cache" 2>/dev/null && ok "removed node_modules/.cache" || warn "node_modules/.cache already gone"
find "$REPO" -maxdepth 3 -name "tsconfig.tsbuildinfo" -type f -delete 2>/dev/null && ok "removed stale tsbuildinfo files" || true

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Verify
# ─────────────────────────────────────────────────────────────────────────────
info "Step 5/5 — verification"

ERRORS=0

for f in \
  "$REPO/packages/database/src/session.ts" \
  "$REPO/packages/database/src/api-guard.ts"
do
  if [[ -f "$f" ]]; then
    if grep -q '^import "server-only";' "$f"; then
      fail "still has server-only: ${f#$REPO/}"
      ERRORS=$((ERRORS+1))
    else
      ok "clean: ${f#$REPO/}"
    fi
  fi
done

echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${G}✓ ALL FIXES APPLIED${N}"
  echo ""
  echo -e "${B}Now run:${N}"
  echo "  npm run build --workspace=admin"
  echo ""
  echo -e "${B}If it still fails, run:${N}"
  echo "  bash fix-build.sh --diagnose"
  echo ""
else
  echo -e "${R}✗ $ERRORS file(s) still have server-only${N}"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Optional diagnostic mode
# ─────────────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--diagnose" ]]; then
  echo ""
  echo -e "${B}=== DIAGNOSTIC ===${N}"
  echo ""
  echo "Files importing @zeal/database/session:"
  grep -rln '@zeal/database/session' "$REPO/apps" "$REPO/packages" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | sed "s|$REPO/|  |" || echo "  (none)"
  echo ""
  echo "Files importing @zeal/database/api-guard:"
  grep -rln '@zeal/database/api-guard' "$REPO/apps" "$REPO/packages" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | sed "s|$REPO/|  |" || echo "  (none)"
  echo ""
  echo "Client files under apps/admin/app/(dashboard):"
  find "$REPO/apps/admin/app/(dashboard)" -name "*.tsx" -type f 2>/dev/null | while read -r f; do
    if head -n 3 "$f" | grep -q '"use client"'; then
      echo "  [client] ${f#$REPO/}"
    else
      echo "  [server] ${f#$REPO/}"
    fi
  done
fi

echo ""
echo -e "${B}Backup:${N} .zeal-backup/build-fix-$STAMP"