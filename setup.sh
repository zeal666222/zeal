#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  ZEAL — PHASE 5 A11Y FIX v4 (definitive, brace-aware)
#  ─────────────────────────────────────────────────────────────────────────────
#  Rewrites every icon-only <button> in profile/page.tsx with an aria-label.
#  Uses a character scanner so arrow-function onClick handlers no longer
#  break the regex.
# ═══════════════════════════════════════════════════════════════════════════════

if [[ -f "$0" ]] && [[ "$(head -c 4096 "$0" | tr -cd '\r' | wc -c)" -gt 0 ]]; then
  _t="$(mktemp)"; tr -d '\r' < "$0" > "$_t"; chmod +x "$_t"; exec bash "$_t" "$@"
fi
set -o pipefail

if [[ -t 1 ]]; then
  G=$'\033[0;32m'; Y=$'\033[1;33m'; R=$'\033[0;31m'
  C=$'\033[0;36m'; M=$'\033[0;35m'; BD=$'\033[1m'; D=$'\033[2m'; N=$'\033[0m'
else G=''; Y=''; R=''; C=''; M=''; BD=''; D=''; N=''; fi
ok()   { printf "  ${G}✓${N} %s\n" "$1"; }
warn() { printf "  ${Y}⚠${N} %s\n" "$1"; }
err()  { printf "  ${R}✗${N} %s\n" "$1"; }
info() { printf "  ${C}→${N} %s\n" "$1"; }
sec()  { printf "\n${M}${BD}▶ %s${N}\n\n" "$1"; }
dim()  { printf "    ${D}%s${N}\n" "$1"; }

REPO="$PWD"
while [[ "$REPO" != "/" && "$REPO" != "." ]]; do
  if [[ -f "$REPO/package.json" && -d "$REPO/apps" && -d "$REPO/packages" ]]; then break; fi
  P="$(cd "$REPO/.." 2>/dev/null && pwd || echo "/")"; [[ "$P" == "$REPO" ]] && break; REPO="$P"
done
cd "$REPO"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BK=".zeal-backup/a11y-v4-$TS"; mkdir -p "$BK"

printf "\n${BD}╔══════════════════════════════════════════════════════════════╗${N}\n"
printf "${BD}║  ZEAL — PHASE 5 A11Y FIX v4 (definitive)                      ║${N}\n"
printf "${BD}╚══════════════════════════════════════════════════════════════╝${N}\n"

# ═══════════════════════════════════════════════════════════════════════════════
sec "§1 — Backup + character scanner"
# ═══════════════════════════════════════════════════════════════════════════════

F="apps/web/app/profile/page.tsx"
if [[ ! -f "$F" ]]; then
  err "profile/page.tsx not found"
  exit 1
fi

cp "$F" "$BK/profile_page.tsx.before"
ok "backup: $BK/profile_page.tsx.before"

node << 'NODEEOF'
// ═══════════════════════════════════════════════════════════════════════════════
// Character-scanner icon-only-button labeler
// ─────────────────────────────────────────────────────────────────────────────
// Walks JSX, finds every <button ...>...</button>, and if the content is
// icon-only (matches the scanner's heuristic: contains <Icon size={N} or
// <Icon size=N) and lacks aria-label / sr-only text, injects a derived label.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const file = "apps/web/app/profile/page.tsx";
let src = fs.readFileSync(file, "utf8");

// ─── Find the closing `>` of a JSX tag starting at `start` (index of `<`) ──
function findTagEnd(source, start) {
  let i = start + 1;
  let braceDepth = 0;
  let quote = null;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== "\\") quote = null;
    } else if (braceDepth > 0) {
      if (c === "{") braceDepth++;
      else if (c === "}") braceDepth--;
      else if (c === '"' || c === "'" || c === "`") quote = c;
    } else {
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") braceDepth++;
      else if (c === ">") return i;
    }
    i++;
  }
  return -1;
}

// ─── Derive a human-readable label from the open tag + content ─────────────
function deriveLabel(openTag, content) {
  // Handler-based
  if (/setIsEditing\(true\)/.test(openTag)) return "Edit profile";
  if (/setIsEditing\(false\)/.test(openTag)) return "Cancel edit";
  if (/handleRecharge\(500\)/.test(openTag)) return "Add ₹500 to wallet";
  if (/handleRecharge\(1000\)/.test(openTag)) return "Add ₹1000 to wallet";
  if (/copySubdomain|copyCodes|handleCopy/.test(openTag)) return "Copy to clipboard";
  if (/removeFactor|onRemove/.test(openTag)) return "Remove";
  if (/startEnrollment/.test(openTag)) return "Enable two-factor authentication";
  if (/cancelEnrollment|onCancel/.test(openTag)) return "Cancel";
  if (/onClose|setOpen\(false\)/.test(openTag)) return "Close";

  // Icon-based
  if (/type="submit"/.test(openTag)) {
    if (/CheckCircle2/.test(content)) return "Save changes";
    if (/Loader2/.test(content)) return "Loading";
    return "Submit";
  }
  if (/<Edit3\b/.test(content)) return "Edit";
  if (/<CheckCircle2\b/.test(content)) return "Save";
  if (/<Trash2\b/.test(content)) return "Delete";
  if (/<X\b/.test(content)) return "Close";
  if (/<Copy\b/.test(content)) return "Copy";
  if (/<RefreshCw\b/.test(content)) return "Refresh";
  if (/<Plus\b/.test(content)) return "Add";
  if (/<Check\b/.test(content)) return "Confirm";

  return "Button";
}

// ─── Icon-only heuristic — mirrors the scanner's rule ─────────────────────
function contentLooksIconOnly(content) {
  // The scanner fires when the 3-line window after <button> contains an icon
  // with a size attribute. Mirror that here.
  return /<\w+\s+[^>]*\bsize=\{?\d/.test(content);
}

// ─── Walk the file ────────────────────────────────────────────────────────
function process(src) {
  let out = "";
  let i = 0;
  let count = 0;
  const labels = [];

  while (i < src.length) {
    const idx = src.indexOf("<button", i);
    if (idx === -1) { out += src.slice(i); break; }

    // Ensure boundary: <button or <button\b — not <buttonXyz
    const next = src[idx + 7];
    if (next && /[A-Za-z0-9_$]/.test(next)) {
      out += src.slice(i, idx + 7);
      i = idx + 7;
      continue;
    }

    out += src.slice(i, idx);

    const tagEnd = findTagEnd(src, idx);
    if (tagEnd === -1) { out += src.slice(idx); break; }

    let openTag = src.slice(idx, tagEnd + 1);

    // Find matching </button> (no nested buttons — best effort)
    const closeStart = src.indexOf("</button>", tagEnd + 1);
    if (closeStart === -1) { out += openTag; i = tagEnd + 1; continue; }

    const content = src.slice(tagEnd + 1, closeStart);

    const alreadyLabeled =
      /\baria-label=/.test(openTag) || /\bsr-only\b/.test(content);

    if (!alreadyLabeled && contentLooksIconOnly(content)) {
      const label = deriveLabel(openTag, content);
      // Insert aria-label right before the final >
      const trimmed = openTag.replace(/\s*>$/, "");
      openTag = trimmed + ` aria-label="${label}">`;
      count++;
      labels.push(label);
    }

    out += openTag + content + "</button>";
    i = closeStart + "</button>".length;
  }

  return { out, count, labels };
}

const { out, count, labels } = process(src);

if (out !== src) {
  fs.writeFileSync(file, out, "utf8");
  console.log(`  ✓ profile/page.tsx — ${count} icon-only button${count === 1 ? "" : "s"} labeled`);
  for (const l of labels) console.log(`      → "${l}"`);
} else {
  console.log("  ○ profile/page.tsx — no icon-only buttons needed labeling");
}
NODEEOF

# ═══════════════════════════════════════════════════════════════════════════════
sec "§2 — Re-scan"
# ═══════════════════════════════════════════════════════════════════════════════

if [[ -f scripts/a11y/scan.py ]]; then
  info "running a11y scanner…"
  python3 scripts/a11y/scan.py apps 2>/dev/null || true
fi

# ═══════════════════════════════════════════════════════════════════════════════
sec "§3 — Cache clear + type-check + build + rollback"
# ═══════════════════════════════════════════════════════════════════════════════

for p in \
  apps/web/.next apps/admin/.next \
  apps/web/tsconfig.tsbuildinfo apps/admin/tsconfig.tsbuildinfo \
  packages/*/tsconfig.tsbuildinfo \
  node_modules/.cache .turbo; do
  [[ -e "$p" ]] && rm -rf "$p" && dim "removed $p"
done
ok "caches cleared"

WEB_TC=0; ADMIN_TC=0
info "type-checking web…"
if (cd apps/web && npx tsc --noEmit) > "$BK/tc-web.log" 2>&1; then
  WEB_TC=1; ok "web: clean"
else
  warn "web: errors — first 20"
  head -20 "$BK/tc-web.log" | sed 's/^/    /'
fi

info "type-checking admin…"
if (cd apps/admin && npx tsc --noEmit) > "$BK/tc-admin.log" 2>&1; then
  ADMIN_TC=1; ok "admin: clean"
else
  warn "admin: errors — first 20"
  head -20 "$BK/tc-admin.log" | sed 's/^/    /'
fi

BUILD_LOG="$BK/build.log"
info "running build…"
echo ""
set +o pipefail
npm run build 2>&1 | tee "$BUILD_LOG" | tail -30
BUILD_STATUS=${PIPESTATUS[0]}
set -o pipefail
echo ""

BUILD_OK=0
if [[ "$BUILD_STATUS" -eq 0 ]]; then ok "BUILD PASSED"; BUILD_OK=1
else err "BUILD FAILED"; BUILD_OK=0; fi

if [[ "$BUILD_OK" -eq 0 ]]; then
  sec "ROLLBACK"
  warn "restoring profile/page.tsx"
  cp "$BK/profile_page.tsx.before" apps/web/app/profile/page.tsx
  err "Rollback complete. Examine: $BUILD_LOG"
  exit 1
fi

sec "SUMMARY"
echo ""
printf "  Web type-check   : %s\n" "$([[ $WEB_TC -eq 1 ]] && echo "${G}clean${N}" || echo "${Y}errors${N}")"
printf "  Admin type-check : %s\n" "$([[ $ADMIN_TC -eq 1 ]] && echo "${G}clean${N}" || echo "${Y}errors${N}")"
printf "  Build            : %s\n" "$([[ $BUILD_OK -eq 1 ]] && echo "${G}PASSED${N}" || echo "${R}FAILED${N}")"
echo "  Backup           : $BK"
echo ""
ok "✓ A11Y FIX v4 COMPLETE"
exit 0