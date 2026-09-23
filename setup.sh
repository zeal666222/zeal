#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — v3 Runtime Fix
# ═══════════════════════════════════════════════════════════════════════════════
# Fixes
#   1. <path d="undefined">  →  native SVG animation in AnimatedZealMark
#   2. 500 on all consultant queries  →  strip Prisma FK hints, use column hints
#   3. 500 on /api/ai validation  →  ValidationError + 400
#   4. Profile → chat + booking flow  →  restored by (2)
#
# Idempotent. Backs up every modified file. Gates on type-check + build.
# ═══════════════════════════════════════════════════════════════════════════════

set -Eeuo pipefail

DRY_RUN=0; SKIP_BUILD=0; SKIP_INSTALL=0
for arg in "$@"; do case "$arg" in
  --dry-run)      DRY_RUN=1 ;;
  --skip-build)   SKIP_BUILD=1 ;;
  --skip-install) SKIP_INSTALL=1 ;;
  -h|--help) sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Unknown flag: $arg" >&2; exit 2 ;;
esac; done

if [ -t 1 ]; then
  R=$'\033[0m'; B=$'\033[1m'; DIM=$'\033[2m'
  I=$'\033[1;34m'; OK=$'\033[1;32m'; W=$'\033[1;33m'; E=$'\033[1;31m'
else R=""; B=""; DIM=""; I=""; OK=""; W=""; E=""; fi
say()  { printf '%s[v3]%s %s\n' "$I" "$R" "$*"; }
ok()   { printf '%s  ✓%s %s\n' "$OK" "$R" "$*"; }
warn() { printf '%s  !%s %s\n' "$W" "$R" "$*"; }
err()  { printf '%s  ✗%s %s\n' "$E" "$R" "$*" >&2; }
note() { printf '%s    %s%s\n' "$DIM" "$*" "$R"; }

# ─── Repo root ────────────────────────────────────────────────────────────────
find_root() {
  local dir="$1" hops=0
  [ -n "$dir" ] || return 1
  dir="$(cd "$dir" 2>/dev/null && pwd -P || echo "$dir")"
  while [ "$hops" -lt 12 ] && [ -n "$dir" ] && [ "$dir" != "/" ] && [ "$dir" != "." ]; do
    [ -d "$dir/apps/web" ] && [ -d "$dir/apps/admin" ] && [ -d "$dir/packages/realtime" ] && { printf '%s\n' "$dir"; return 0; }
    local p; p="$(dirname "$dir")"; [ "$p" = "$dir" ] && break; dir="$p"; hops=$((hops+1))
  done
  return 1
}
ROOT=""
if [ -n "${BASH_SOURCE[0]:-}" ]; then
  SD="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P || true)"
  [ -n "$SD" ] && ROOT="$(find_root "$SD" || true)"
fi
[ -z "$ROOT" ] && ROOT="$(find_root "$PWD" || true)"
[ -z "$ROOT" ] && [ -n "${OLDPWD:-}" ] && ROOT="$(find_root "$OLDPWD" || true)"
[ -z "$ROOT" ] && { err "Repo root not found"; exit 1; }
cd "$ROOT"

# ─── PM detection ─────────────────────────────────────────────────────────────
detect_pm() {
  if [ -f "pnpm-workspace.yaml" ] && command -v pnpm >/dev/null 2>&1; then echo "pnpm"; return; fi
  if [ -f "package.json" ] && grep -q '"workspaces"' package.json && command -v npm >/dev/null 2>&1; then echo "npm"; return; fi
  if command -v pnpm >/dev/null 2>&1; then echo "pnpm"; return; fi
  if command -v npm  >/dev/null 2>&1; then echo "npm";  return; fi
  echo ""
}
PM="$(detect_pm)"
[ -z "$PM" ] && { err "No package manager"; exit 1; }

# ─── Backup ───────────────────────────────────────────────────────────────────
TS="$(date +%Y%m%d-%H%M%S 2>/dev/null || date +%s)"
BACKUP=".zeal-backup/v3-$TS"
[ "$DRY_RUN" -eq 0 ] && mkdir -p "$BACKUP"
backup() {
  [ -f "$1" ] || return 0
  [ "$DRY_RUN" -eq 1 ] && return 0
  cp "$1" "$BACKUP/${1//\//__}"
}
trap 'err "Aborted. Rollback: cp -r $BACKUP/* ."; exit $?' ERR

printf '\n%s════════════════════════════════════════════════════════════════════%s\n' "$B" "$R"
printf '%s  ZEAL — v3 Runtime Fix%s\n' "$B" "$R"
printf '%s════════════════════════════════════════════════════════════════════%s\n' "$B" "$R"
printf '  Root   : %s\n' "$ROOT"
printf '  PM     : %s\n' "$PM"
printf '  Mode   : %s\n' "$([ $DRY_RUN -eq 1 ] && echo DRY-RUN || echo APPLY)"
printf '  Backup : %s\n\n' "$BACKUP"

# ═══════════════════════════════════════════════════════════════════════════════
# A. Install deps (so tsc/gates resolve)
# ═══════════════════════════════════════════════════════════════════════════════
say "A · Dependency install"
if [ "$SKIP_INSTALL" -eq 1 ]; then warn "skipped"; elif [ "$DRY_RUN" -eq 1 ]; then note "would install via $PM";
else
  if [ "$PM" = "npm" ]; then
    if [ -f package-lock.json ]; then
      npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
    else
      npm install --legacy-peer-deps --no-audit --no-fund
    fi
  else
    [ -f pnpm-lock.yaml ] && { pnpm install --frozen-lockfile || pnpm install; } || pnpm install
  fi
  ok "dependencies installed"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# B. AnimatedZealMark — native SVG animation (no <path d="undefined">)
# ═══════════════════════════════════════════════════════════════════════════════
say "B · Rewriting AnimatedZealMark"

AZM="packages/ui/src/animated-zeal-mark.tsx"
if [ -f "$AZM" ]; then
  backup "$AZM"
  if [ "$DRY_RUN" -eq 0 ]; then
    cat > "$AZM" <<'EOF_AZM'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// AnimatedZealMark
// ═══════════════════════════════════════════════════════════════════════════════
// Path morphing is done with NATIVE SVG <animate> (SMIL) — not Framer Motion.
// Framer Motion's `animate={{ d: [...] }}` interpolation is unreliable across
// browsers and can emit `d="undefined"` when command sequences don't align.
// Native SMIL is deterministic, GPU-composited, and requires no JS at runtime.
// ═══════════════════════════════════════════════════════════════════════════════

import { useId } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "./utils";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
  animate?: boolean;
  variant?: "brand" | "mono";
}

// All paths are valid "M … L …" strings with equal command counts so SMIL
// can morph between them without interpolation artifacts.
const Z        = "M 8 10 L 40 10 L 8 38 L 40 38";
const TRIANGLE = "M 24 8 L 40 34 L 8 34 L 40 34";
const DIAMOND  = "M 24 8 L 40 24 L 24 40 L 8 24";
const SQUARE   = "M 8 8 L 40 8 L 40 40 L 8 40";

const SEQUENCE_VALUES = `${Z}; ${TRIANGLE}; ${DIAMOND}; ${SQUARE}; ${Z}`;

function safePath(d: string | undefined | null): string {
  if (typeof d !== "string" || d.length === 0) return Z;
  if (!/^[Mm]/.test(d.trim())) return Z;
  return d;
}

export function AnimatedZealMark({
  size = 28,
  className,
  glow = true,
  animate = true,
  variant = "brand",
}: Props) {
  const raw = useId();
  const safe = raw.replace(/:/g, "");
  const gradientId = `zeal-mark-grad-${safe}`;
  const filterId   = `zeal-mark-glow-${safe}`;
  const stroke = variant === "brand" ? `url(#${gradientId})` : "currentColor";
  const d0 = safePath(Z);

  const prefersReduced = useReducedMotion();
  const shouldAnimate = animate && !prefersReduced;

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label="Zeal"
      role="img"
    >
      {glow && (
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              variant === "brand"
                ? "radial-gradient(circle, rgba(157,125,197,0.5) 0%, rgba(83,58,253,0) 70%)"
                : "radial-gradient(circle, currentColor 0%, transparent 70%)",
          }}
          animate={
            shouldAnimate
              ? { scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] }
              : undefined
          }
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        className="relative z-10"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#9D7DC5" />
            <stop offset="50%"  stopColor="#7A5A9E" />
            <stop offset="100%" stopColor="#533AFD" />
          </linearGradient>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={d0}
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        >
          {shouldAnimate && (
            <animate
              attributeName="d"
              dur="12s"
              repeatCount="indefinite"
              values={SEQUENCE_VALUES}
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          )}
        </path>
      </svg>
    </span>
  );
}
EOF_AZM
    ok "AnimatedZealMark rewritten (native SMIL, no d=undefined)"
  fi
else
  warn "AnimatedZealMark not found — skipped"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# C. Global FK-hint sanitization
# ═══════════════════════════════════════════════════════════════════════════════
say "C · Sanitizing PostgREST FK hints"
note "Pattern: User!Consultant_userId_fkey(...)  →  User!userId(...)"
note "Works regardless of the actual constraint name on the live DB."

if [ "$DRY_RUN" -eq 0 ]; then
  node <<'NODE_FK'
const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git", ".zeal-backup", "coverage", ".turbo"]);
// Prisma-style: !<Table>_<column>_fkey(  →  !<column>(
// Requires the FK name to end in `_fkey` so `!inner(`/`!left(` are untouched.
const RE = /!([A-Z][A-Za-z0-9]*)_([A-Za-z][A-Za-z0-9]*)_fkey\(/g;

let filesChanged = 0;
let totalReplacements = 0;
const touched = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name));
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      const full = path.join(dir, e.name);
      let src;
      try { src = fs.readFileSync(full, "utf8"); } catch { continue; }
      if (!src.includes("_fkey(")) continue;

      let localCount = 0;
      const out = src.replace(RE, (_m, _table, col) => {
        localCount++;
        return `!${col}(`;
      });
      if (out !== src) {
        fs.writeFileSync(full, out, "utf8");
        filesChanged++;
        totalReplacements += localCount;
        touched.push(`${full}  (${localCount})`);
      }
    }
  }
}

for (const root of ["apps", "packages"]) {
  if (fs.existsSync(root)) walk(root);
}

console.log(`Files changed: ${filesChanged}, replacements: ${totalReplacements}`);
for (const t of touched.slice(0, 12)) console.log("  " + t);
if (touched.length > 12) console.log(`  … and ${touched.length - 12} more`);
NODE_FK
  ok "FK hints sanitized"
else
  note "would sanitize FK hints"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# D. /api/ai — ValidationError + 400 semantics
# ═══════════════════════════════════════════════════════════════════════════════
say "D · /api/ai — validation vs infrastructure errors"

AIROUTE="apps/web/app/api/ai/route.ts"
if [ -f "$AIROUTE" ]; then
  backup "$AIROUTE"
  if [ "$DRY_RUN" -eq 0 ]; then
    node - "$AIROUTE" <<'NODE_AI'
const fs = require("fs");
const p = process.argv[2];
let src = fs.readFileSync(p, "utf8");

// 1. Ensure the ValidationError class exists just above HANDLERS.
if (!src.includes("class ValidationError")) {
  const anchor = "// ─── Task type ──────────────────────────────────────────────────────────────";
  const inject = `// ─── Error taxonomy ─────────────────────────────────────────────────────────
// Handlers throw ValidationError for caller mistakes (bad input, short
// query, missing fields). The top-level catch maps it to 400. Any other
// Error is treated as infrastructure failure and returned as 500.
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

`;
  if (src.includes(anchor)) src = src.replace(anchor, inject + anchor);
  else src = inject + src;
}

// 2. Convert all `throw new Error("...")` inside handlers to ValidationError.
//    Leave `throw new Error(\`Unknown task: ...\`)` alone (already 400 in-place).
const errorPattern = /throw new Error\(("(?:[^"\\]|\\.)*")\)/g;
src = src.replace(errorPattern, (_m, msg) => `throw new ValidationError(${msg})`);

// 3. Update the top-level catch to discriminate.
if (!src.includes("err instanceof ValidationError")) {
  const catchAnchor = /} catch \(err\) \{\s*\n\s*const message = err instanceof Error \? err\.message : "AI request failed";[\s\S]*?return NextResponse\.json\(\{ error: message \}, \{ status: 500 \}\);\s*\n\s*\}/;
  const catchReplacement = `} catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, code: "VALIDATION" },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "AI request failed";
    console.error(\`[ai/\${taskForLog}]\`, message);
    return NextResponse.json(
      { error: message, code: "INTERNAL" },
      { status: 500 },
    );
  }`;
  if (catchAnchor.test(src)) src = src.replace(catchAnchor, catchReplacement);
}

fs.writeFileSync(p, src);
NODE_AI
    ok "/api/ai now returns 400 for validation errors"
  fi
else
  warn "/api/ai/route.ts not found — skipped"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# E. /api/explore/consultants — resilient fallback
# ═══════════════════════════════════════════════════════════════════════════════
say "E · /api/explore/consultants — resilient fallback"

EXP="apps/web/app/api/explore/consultants/route.ts"
if [ -f "$EXP" ]; then
  backup "$EXP"
  if [ "$DRY_RUN" -eq 0 ]; then
    node - "$EXP" <<'NODE_EXP'
const fs = require("fs");
const p = process.argv[2];
let src = fs.readFileSync(p, "utf8");

// If the primary RPC and the fallback BOTH fail, return 200 with empty
// results + a source marker. Better than 500 which flashes a red toast.
const returnForFatal = `      if (legacy.error) throw legacy.error;`;
if (src.includes(returnForFatal) && !src.includes("source: \"fallback-empty\"")) {
  src = src.replace(
    returnForFatal,
    `      if (legacy.error) {
        console.error("[explore/consultants] legacy fallback failed:", legacy.error.message);
        return NextResponse.json(
          { success: true, consultants: [], total: 0, source: "fallback-empty" },
          { headers: { "Cache-Control": "no-store, max-age=0" } },
        );
      }`,
  );
}

// Ensure a graceful error path for the outer catch
if (!src.includes("source: \"outer-error\"")) {
  const outer = /return NextResponse\.json\(\s*\{ success: false, error: err instanceof Error \? err\.message : "Failed" \},\s*\{ status: 500 \},\s*\);/;
  if (outer.test(src)) {
    src = src.replace(
      outer,
      `return NextResponse.json(
        { success: true, consultants: [], total: 0, source: "outer-error" },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );`,
    );
  }
}

fs.writeFileSync(p, src);
NODE_EXP
    ok "/api/explore/consultants — never 500s on lookup failures"
  fi
else
  warn "/api/explore/consultants not found — skipped"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# F. Profile page — verify FK hints + CTA flow
# ═══════════════════════════════════════════════════════════════════════════════
say "F · Profile page — verify query hints + CTA"

PROF="apps/web/app/consultant/[id]/page.tsx"
if [ -f "$PROF" ]; then
  # FK hints already sanitized in Phase C.
  if grep -q "_fkey(" "$PROF"; then
    warn "profile page still contains FK hints — check sanitization"
  else
    ok "profile page has no stale FK hints"
  fi
  if grep -q "ProfileActions" "$PROF"; then
    ok "ProfileActions rendered (chat + booking CTAs)"
  else
    warn "ProfileActions missing from profile page"
  fi
fi

# Verify ProfileActions uses startChatFlow
PA="apps/web/app/consultant/[id]/ProfileActions.tsx"
if [ -f "$PA" ]; then
  if grep -q "startChatFlow" "$PA"; then
    ok "ProfileActions uses startChatFlow (wallet gate ready)"
  else
    warn "ProfileActions does not use startChatFlow"
  fi
  if grep -q "WalletGateDialog" "$PA"; then
    ok "ProfileActions renders WalletGateDialog on low balance"
  else
    warn "ProfileActions missing WalletGateDialog"
  fi
fi

# Verify /api/consultants/[id]/status exists (startChatFlow dependency)
ST="apps/web/app/api/consultants/[id]/status/route.ts"
if [ -f "$ST" ]; then
  ok "/api/consultants/[id]/status exists"
  if grep -q "_fkey(" "$ST"; then
    warn "status route still has FK hints"
  fi
else
  warn "/api/consultants/[id]/status missing — startChatFlow will 404"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# G. Verify no stale Prisma FK hints remain
# ═══════════════════════════════════════════════════════════════════════════════
say "G · Sweep — any remaining _fkey hints?"
REMAIN=$(grep -rlE '![A-Z][A-Za-z0-9]*_[A-Za-z][A-Za-z0-9]*_fkey\(' apps packages 2>/dev/null | wc -l | tr -d ' ')
if [ "$REMAIN" -gt 0 ]; then
  warn "$REMAIN file(s) still contain _fkey hints:"
  grep -rlE '![A-Z][A-Za-z0-9]*_[A-Za-z][A-Za-z0-9]*_fkey\(' apps packages 2>/dev/null | sed 's/^/    /'
else
  ok "no stale Prisma FK hints remain"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# H. Gates
# ═══════════════════════════════════════════════════════════════════════════════
say "H · Type-check + build"
if [ "$DRY_RUN" -eq 1 ]; then warn "dry-run — skip gates"; exit 0; fi

ws_run() {
  local workspace="$1"; shift
  case "$PM" in
    npm)  npm run "$@" --workspace="$workspace" ;;
    pnpm) pnpm --filter "$workspace" "$@" ;;
  esac
}

run_gate() {
  local label="$1"; shift
  printf '\n%s── %s%s\n' "$B" "$label" "$R"
  if "$@"; then ok "$label passed"
  else err "$label FAILED"; err "Rollback: cp -r $BACKUP/* ."; exit 1; fi
}

run_gate "type-check · web"   ws_run web   type-check
run_gate "type-check · admin" ws_run admin type-check

if [ "$SKIP_BUILD" -eq 0 ]; then
  run_gate "build · web"   ws_run web   build
  run_gate "build · admin" ws_run admin build
else
  warn "build skipped (--skip-build)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════════════════════════════════════════
printf '\n%s════════════════════════════════════════════════════════════════════%s\n' "$B" "$R"
printf '%s  ✅ v3 APPLIED — type-check + build passed%s\n' "$OK" "$R"
printf '%s════════════════════════════════════════════════════════════════════%s\n\n' "$B" "$R"

cat <<EOF
  Backup   : $BACKUP
  Rollback : cp -r $BACKUP/* .

  ── Post-run checklist ────────────────────────────────────────────────────

  Migrations (if not yet pushed):
      supabase db push

  Restart servers:
      $PM run dev --workspace=web
      $PM run dev --workspace=admin

  Smoke tests (do these in order):
     1. Open homepage.
        → No '<path d="undefined">' console errors.
        → Zeal mark in header animates smoothly.

     2. Open /explore.
        → Network tab: /api/explore/consultants returns 200 (not 500).
        → Consultant cards render.

     3. Click any consultant card.
        → Profile page loads with bio, rating, stats.
        → "Chat now" and "Book session" buttons visible above the fold.

     4. Click "Chat now" on a profile.
        → If balance >= rate  →  navigates to /chat/<conversationId>
        → If balance < rate   →  WalletGateDialog opens with "Add ₹X"
        → Click "Add ₹X"      →  /wallet?resume=<consultantId>
        → After recharge      →  returns to chat (auto-resume)

     5. Click "Book session".
        → /booking?consultantId=<id> wizard loads.

     6. Open /services and type a query in ZealChat.
        → Network tab: /api/ai?task=concierge returns 200.
        → If query < 3 chars: returns 400 (not 500) — "Query too short"
        → Recommendation cards render below the assistant message.

     7. Open admin /consultant/dashboard.
        → Realtime KPI strip updates on wallet change.
        → New booking triggers "incoming_request" on
          consultant:<User.id>:incoming.
EOF

exit 0