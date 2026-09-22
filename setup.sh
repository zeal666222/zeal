#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — Fix Tag icon import + full-stack verification
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd)"
cd "$REPO_ROOT"

[[ -f package.json ]] || { echo "✗ Run from repo root"; exit 1; }

if [[ -t 1 ]]; then
  G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; N='\033[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
ok()   { printf "${G}  ✓${N} %s\n" "$*"; }
warn() { printf "${Y}  ○${N} %s\n" "$*"; }
fail() { printf "${R}  ✗${N} %s\n" "$*"; }
head_() { printf "\n${B}▸ %s${N}\n" "$*"; }

TS=$(date +%Y%m%d-%H%M%S)
BK=".zeal-backup/fix-tag-$TS"
mkdir -p "$BK"

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 1 — Fix Tag import in AdminSidebar"

SIDEBAR="apps/admin/components/layout/AdminSidebar.tsx"

if [[ ! -f "$SIDEBAR" ]]; then
  fail "$SIDEBAR not found"
  exit 1
fi

mkdir -p "$BK/$(dirname "$SIDEBAR")"
cp "$SIDEBAR" "$BK/$SIDEBAR"

node - "$SIDEBAR" <<'NODE_FIX'
const fs = require("fs");
const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");

// Find the lucide-react import line (any of these shapes)
const importRe = /^import\s*\{([^}]+)\}\s*from\s*"lucide-react";\s*$/m;
const match = src.match(importRe);

if (!match) {
  console.error("✗ Could not find lucide-react import line");
  process.exit(1);
}

// Parse existing imports into a Set
const existing = new Set(
  match[1].split(",").map((s) => s.trim()).filter(Boolean),
);

// Ensure Tag is in the set
existing.add("Tag");

// Sort alphabetically (case-insensitive), then re-emit
const sorted = Array.from(existing).sort((a, b) =>
  a.toLowerCase().localeCompare(b.toLowerCase()),
);

const newImport = `import { ${sorted.join(", ")} } from "lucide-react";`;
src = src.replace(importRe, newImport);
fs.writeFileSync(file, src, "utf8");

console.log("✓ Import now: " + newImport);
NODE_FIX

ok "Fixed $SIDEBAR"

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 2 — Verify the NAV entry is well-formed"

if grep -q 'label: "Pricing".*href: "/pricing-requests"' "$SIDEBAR"; then
  ok "Pricing NAV entry present"
else
  warn "Pricing entry not found — check the file manually"
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 3 — Scan for other missing lucide icons in admin"

# Extract all `icon: X` references from NAV arrays
ICONS=$(
  grep -ho 'icon: [A-Z][A-Za-z0-9]*' apps/admin/components/layout/AdminSidebar.tsx \
    apps/admin/components/consultant/AppShell.tsx \
    2>/dev/null \
    | awk '{print $2}' \
    | sort -u
)

if [[ -z "$ICONS" ]]; then
  warn "No icons found in NAV arrays"
else
  ok "Icons referenced: $(echo "$ICONS" | tr '\n' ' ')"
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 4 — Report"

printf "\n"
printf "  Backup: %s\n" "$BK"
printf "\n"
printf "  Next: npm run build\n"
printf "\n"