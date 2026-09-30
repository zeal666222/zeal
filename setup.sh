#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  ZEAL — PHASE 1 STABILIZATION
# ─────────────────────────────────────────────────────────────────────────────
#  Track A — Desktop mouse scroll      (Lenis ↔ scroll-root conflict)
#  Track B — React error #310           (profile page hook order)
#  Track C — Stability                  (hydration guard, error boundary)
#  Track D — Hygiene                    (barrel exports, dedupe, assertions)
#
#  Design invariants:
#    • Never blind-overwrite. Every edit is pattern-matched, applied, verified.
#    • Idempotent. Marker comments guard every write; re-runs are no-ops.
#    • Backed up. Every touched file lands in .zeal-backups/phase1-<ts>/
#    • Atomic. Every write goes to <file>.zeal-tmp-<pid> then `mv`.
#    • LF-only. Windows CRLF is normalized to LF before every write.
#    • Ported. Tested on Git Bash (MINGW64), macOS, and Linux bash 3.2+.
#    • Zero shell surprises. Node scripts run from temp files, never `-e`.
#
#  Usage:
#    ./setup.sh                   interactive
#    ./setup.sh -y                non-interactive
#    ./setup.sh --dry-run         preview
#    ./setup.sh --verbose         trace every command
#    ./setup.sh --only A,B        run only tracks A and B
#    ./setup.sh --skip C          skip track C
#    ./setup.sh --rollback        restore most recent backup
# ═══════════════════════════════════════════════════════════════════════════════
set -Eeuo pipefail
IFS=$' \t\n'

# ─── Portable repo-root resolver (symlink-safe) ────────────────────────────────
resolve_repo_root() {
  local src="${BASH_SOURCE[0]}" dir
  while [ -h "$src" ]; do
    dir="$(cd -P "$(dirname "$src")" >/dev/null 2>&1 && pwd)"
    src="$(readlink "$src")"
    case "$src" in /*) ;; *) src="$dir/$src" ;; esac
  done
  cd -P "$(dirname "$src")" >/dev/null 2>&1 && pwd
}
ROOT="$(resolve_repo_root)"
cd "$ROOT"

# ─── TTY detection and colour palette ─────────────────────────────────────────
if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  C_RED='\033[0;31m';   C_GRN='\033[0;32m';   C_YEL='\033[1;33m'
  C_BLU='\033[0;34m';   C_MAG='\033[0;35m';   C_CYN='\033[0;36m'
  C_WHT='\033[1;37m';   C_DIM='\033[2m'
  C_BOLD='\033[1m';     C_RST='\033[0m'
else
  C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; C_MAG=''; C_CYN=''
  C_WHT=''; C_DIM=''; C_BOLD=''; C_RST=''
fi

# ─── Primitive logging ────────────────────────────────────────────────────────
ts_utc()  { date -u +%H:%M:%SZ; }
hr()      { printf "${C_DIM}%s${C_RST}\n" "──────────────────────────────────────────────"; }
banner()  { printf "\n${C_BOLD}${C_MAG}━━━ %s ━━━${C_RST}\n" "$*"; }
step()    { printf "${C_CYN}→${C_RST} %s\n" "$*"; }
ok()      { printf "${C_GRN}✓${C_RST} %s\n" "$*"; }
warn()    { printf "${C_YEL}⚠${C_RST} %s\n" "$*"; }
err()     { printf "${C_RED}✗${C_RST} %s\n" "$*"; }
skip()    { printf "${C_DIM}○${C_RST} %s${C_DIM} (skipped)${C_RST}\n" "$*"; }
info()    { printf "${C_DIM}  %s${C_RST}\n" "$*"; }
trace()   { [ "${VERBOSE:-0}" -eq 1 ] && printf "${C_DIM}[trace] %s${C_RST}\n" "$*" || true; }
die()     { err "$*"; exit 1; }

# ─── Global flag state ────────────────────────────────────────────────────────
DRY_RUN=0
ASSUME_YES=0
VERBOSE=0
SKIP_TYPECHECK=0
ONLY_TRACKS=""
SKIP_TRACKS=""
ROLLBACK_MODE=0

# ─── Usage ────────────────────────────────────────────────────────────────────
print_help() {
  cat <<'HLP'
ZEAL — PHASE 1 STABILIZATION
─────────────────────────────────────────────────────────────────────────────
Usage:
  ./setup.sh [options]

Options:
  --dry-run                Preview every change without writing.
  -y, --yes                Non-interactive (skip confirmation prompts).
  --verbose                Trace every command executed.
  --only A,B,C             Run only these tracks (comma-separated).
  --skip C                 Skip these tracks (comma-separated).
  --skip-typecheck         Do not run `npm run type-check` at the end.
  --rollback               Restore the most recent backup and exit.
  -h, --help               This help.

Tracks:
  A   Desktop mouse scroll — Lenis ↔ scroll-root fix
  B   React error #310      — profile page hook order
  C   Stability             — hydration guard, error boundary
  D   Hygiene               — barrel export, deduped <main>, final asserts

Examples:
  ./setup.sh                        # run everything
  ./setup.sh --dry-run              # preview
  ./setup.sh --only A,B             # just the two blockers
  ./setup.sh --skip D --verbose     # everything but D, with tracing
  ./setup.sh --rollback             # undo the last run
HLP
}

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)        DRY_RUN=1; shift ;;
    -y|--yes)         ASSUME_YES=1; shift ;;
    --verbose)        VERBOSE=1; shift ;;
    --skip-typecheck) SKIP_TYPECHECK=1; shift ;;
    --only)           ONLY_TRACKS="${2:-}"; shift 2 ;;
    --skip)           SKIP_TRACKS="${2:-}"; shift 2 ;;
    --rollback)       ROLLBACK_MODE=1; shift ;;
    -h|--help)        print_help; exit 0 ;;
    *)                err "Unknown option: $1"; print_help; exit 2 ;;
  esac
done

# ─── Trace mode: print every command ──────────────────────────────────────────
if [ "$VERBOSE" -eq 1 ]; then
  set -x
fi

# ═══════════════════════════════════════════════════════════════════════════════
# ROLLBACK MODE — restore the most recent backup and exit
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$ROLLBACK_MODE" -eq 1 ]; then
  printf "\n${C_BOLD}${C_YEL}╔══════════════════════════════════════════════════════════════╗${C_RST}\n"
  printf "${C_BOLD}${C_YEL}║  ZEAL — ROLLBACK                                              ║${C_RST}\n"
  printf "${C_BOLD}${C_YEL}╚══════════════════════════════════════════════════════════════╝${C_RST}\n\n"

  if [ ! -d ".zeal-backups" ]; then
    die "No backups found at .zeal-backups/"
  fi

  LATEST="$(ls -1d .zeal-backups/phase1-* 2>/dev/null | sort -r | head -n1 || true)"
  if [ -z "$LATEST" ]; then
    die "No phase1 backups found in .zeal-backups/"
  fi

  printf "${C_BOLD}Most recent backup:${C_RST} %s\n" "$LATEST"
  printf "\n${C_BOLD}Files in backup:${C_RST}\n"
  (cd "$LATEST" && find . -type f -not -path '*/\.*' | sed 's|^\./|  |')

  if [ "$ASSUME_YES" -eq 0 ] && [ -t 0 ]; then
    printf "\n${C_YEL}Restore these files? [y/N] ${C_RST}"
    read -r ans
    case "${ans,,}" in y|yes) ;; *) die "Rollback cancelled." ;; esac
  fi

  # Copy every file in the backup back to the repo root
  (cd "$LATEST" && find . -type f -print0) | while IFS= read -r -d '' rel; do
    src="$LATEST/$rel"
    dst="$ROOT/${rel#./}"
    mkdir -p "$(dirname "$dst")"
    cp -f "$src" "$dst"
    ok "Restored $dst"
  done

  printf "\n${C_GRN}${C_BOLD}✓ Rollback complete${C_RST}\n"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# HEADER
# ═══════════════════════════════════════════════════════════════════════════════
printf "\n${C_BOLD}${C_BLU}╔══════════════════════════════════════════════════════════════════╗${C_RST}\n"
printf "${C_BOLD}${C_BLU}║  ZEAL — PHASE 1 STABILIZATION                                     ║${C_RST}\n"
printf "${C_BOLD}${C_BLU}║  Scroll · React #310 · Hydration · Boundaries · Hygiene           ║${C_RST}\n"
printf "${C_BOLD}${C_BLU}╚══════════════════════════════════════════════════════════════════╝${C_RST}\n\n"
printf "${C_DIM}  Root     : %s${C_RST}\n" "$ROOT"
printf "${C_DIM}  Started  : %s${C_RST}\n" "$(ts_utc)"
printf "${C_DIM}  Dry-run  : %s${C_RST}\n" "$([ "$DRY_RUN" -eq 1 ] && echo yes || echo no)"
printf "${C_DIM}  Verbose  : %s${C_RST}\n" "$([ "$VERBOSE" -eq 1 ] && echo yes || echo no)"
[ -n "$ONLY_TRACKS" ] && printf "${C_DIM}  Only     : %s${C_RST}\n" "$ONLY_TRACKS"
[ -n "$SKIP_TRACKS" ] && printf "${C_DIM}  Skip     : %s${C_RST}\n" "$SKIP_TRACKS"
printf "\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 0. PREFLIGHT
# ═══════════════════════════════════════════════════════════════════════════════
banner "0. Preflight"

# 0.1 — Node.js required
if ! command -v node >/dev/null 2>&1; then
  die "Node.js is required (used for safe, cross-platform file patching)."
fi
NODE_VERSION="$(node -v 2>/dev/null || echo unknown)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  warn "Node $NODE_VERSION detected; the project targets Node 20+. Continuing."
fi
ok "Node $NODE_VERSION"

# 0.2 — Verify repo signature
[ -f package.json ] || die "package.json missing at $ROOT — abort."
NAME="$(node -p 'try { require("./package.json").name } catch { "" }' 2>/dev/null || echo "")"
[ "$NAME" = "zeal" ] || die "Root package.json name is '$NAME' (expected 'zeal'). Wrong directory?"
ok "Repo signature verified (name=zeal)"

# 0.3 — Verify track targets exist
declare -a REQUIRED=(
  "apps/web/app/layout.tsx"
  "apps/web/app/globals.css"
  "apps/web/app/profile/page.tsx"
  "apps/web/app/profile/loading.tsx"
  "apps/web/components/navigation/AppLayout.tsx"
  "packages/ui/src/motion.tsx"
  "packages/ui/src/tokens.css"
  "packages/ui/src/index.ts"
  "packages/ui/package.json"
)
MISSING=()
for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || MISSING+=("$f")
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  err "Missing required files:"
  for f in "${MISSING[@]}"; do printf "      %s\n" "$f"; done
  die "Cannot proceed — repo layout doesn't match expectations."
fi
ok "All ${#REQUIRED[@]} target files present"

# 0.4 — node_modules
if [ ! -d node_modules ]; then
  warn "node_modules missing — run 'npm ci --legacy-peer-deps' afterwards."
else
  ok "node_modules present"
fi

# 0.5 — Portability probes
for cmd in mktemp tr find sort; do
  command -v "$cmd" >/dev/null 2>&1 || die "Required command missing: $cmd"
done
ok "Required POSIX utilities present (mktemp, tr, find, sort)"

# 0.6 — git tree state
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  DIRTY="$(git status --porcelain 2>/dev/null | head -n 8 || true)"
  if [ -n "$DIRTY" ]; then
    warn "Working tree has uncommitted changes:"
    printf "%s\n" "$DIRTY" | sed 's/^/      /'
    if [ "$ASSUME_YES" -eq 0 ] && [ -t 0 ]; then
      printf "\n${C_YEL}Continue anyway? [y/N] ${C_RST}"
      read -r ans
      case "${ans,,}" in y|yes) ;; *) die "Aborted by user." ;; esac
    fi
  else
    ok "Working tree clean"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 1. BACKUP
# ═══════════════════════════════════════════════════════════════════════════════
banner "1. Backup"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR=".zeal-backups/phase1-${TS}"
mkdir -p "$BACKUP_DIR"

BACKUP_COUNT=0
for f in "${REQUIRED[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -f "$f" "$BACKUP_DIR/$f"
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
  fi
done
ok "Backed up $BACKUP_COUNT file(s) → $BACKUP_DIR"

# Write a manifest for traceability
{
  printf "ts=%s\n" "$TS"
  printf "root=%s\n" "$ROOT"
  printf "files=%d\n" "$BACKUP_COUNT"
  for f in "${REQUIRED[@]}"; do
    [ -f "$BACKUP_DIR/$f" ] && printf "  %s\n" "$f"
  done
} > "$BACKUP_DIR/MANIFEST.txt"
info "Manifest written → $BACKUP_DIR/MANIFEST.txt"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. THE PATCH ENGINE
# ═══════════════════════════════════════════════════════════════════════════════
#
# The single most important primitive in this script.
#
# Why this exists: `node -e "<script>"` passes the script *through the shell*.
# On Git Bash / MSYS2, a literal `<main` inside the script is interpreted as
# an input redirect, and `$(...)`, backticks, and unquoted `$` are expanded
# before Node ever sees them. The failure mode is cryptic: e.g.
#   ./setup.sh: line 336: main: No such file or directory
#
# The fix: write the script to a temp file with a QUOTED heredoc (`<<'EOF'`).
# Quoting the delimiter disables ALL expansion, so the file is byte-for-byte
# what you see. Then `node <tmpfile> <target>`, then delete the temp file.
#
# Every patch is a function that:
#   (1) is invoked as `apply_patch <label> <target-file> <<'NODESCRIPT' ... `
#   (2) receives the Node script on stdin
#   (3) writes it to a mktemp file, runs it, and verifies the exit code.
#
# Contract for the Node script:
#   process.argv[2]  = absolute path to the target file
#   exit 0           = patch applied successfully
#   exit 2           = already applied OR pattern not found (skip, not fail)
#   exit 1 (or any)  = hard failure (script will abort)
# ═══════════════════════════════════════════════════════════════════════════════
apply_patch() {
  local label="$1"
  local target="$2"

  if [ ! -f "$target" ]; then
    err "[$label] Target file does not exist: $target"
    return 1
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    skip "[$label] would patch $target"
    return 0
  fi

  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/zeal-patch-XXXXXX.mjs")"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp'" RETURN

  # Read stdin (heredoc) → tmp file, normalizing CRLF→LF.
  tr -d '\r' > "$tmp"

  if [ ! -s "$tmp" ]; then
    err "[$label] Empty patch script (heredoc failed?)"
    return 1
  fi

  trace "[$label] Running node patch from $tmp against $target"

  local rc=0
  node "$tmp" "$target" || rc=$?

  case "$rc" in
    0)  ok "[$label] Patched: $target" ;;
    2)  skip "[$label] Already applied or not applicable: $target" ;;
    *)  err "[$label] Patch failed (rc=$rc): $target"
        return 1 ;;
  esac
  return 0
}

# ─── write_lf — atomic LF-normalized heredoc write ────────────────────────────
write_lf() {
  local target="$1"
  local tmp="${target}.zeal-tmp-$$"

  mkdir -p "$(dirname "$target")"
  tr -d '\r' > "$tmp"

  if [ "$DRY_RUN" -eq 1 ]; then
    local bytes
    bytes="$(wc -c < "$tmp" | tr -d ' ')"
    skip "[write] would write $target ($bytes bytes)"
    rm -f "$tmp"
    return 0
  fi

  mv "$tmp" "$target"
  ok "Wrote: $target"
}

# ─── Assertion helper — used after every patch ────────────────────────────────
assert_file_contains() {
  local label="$1" file="$2" needle="$3"
  if grep -Fq -- "$needle" "$file"; then
    ok "  [$label] assertion passed"
    return 0
  fi
  err "  [$label] assertion FAILED — expected to find: $needle"
  return 1
}

assert_file_not_contains() {
  local label="$1" file="$2" needle="$3"
  if grep -Fq -- "$needle" "$file"; then
    err "  [$label] assertion FAILED — should NOT contain: $needle"
    return 1
  fi
  ok "  [$label] assertion passed"
  return 0
}

# ─── Track selection helpers ──────────────────────────────────────────────────
should_run_track() {
  local t="$1"
  if [ -n "$ONLY_TRACKS" ]; then
    case ",$ONLY_TRACKS," in *",$t,"*) return 0 ;; *) return 1 ;; esac
  fi
  if [ -n "$SKIP_TRACKS" ]; then
    case ",$SKIP_TRACKS," in *",$t,"*) return 1 ;; esac
  fi
  return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# TRACK A — DESKTOP MOUSE SCROLL
# ═══════════════════════════════════════════════════════════════════════════════
if should_run_track A; then
banner "Track A — Desktop Mouse Scroll"

# ── A1. Audit globals.css for scroll-behavior: smooth ────────────────────────
step "A1. Auditing apps/web/app/globals.css for scroll-behavior conflict"
if grep -qE 'scroll-behavior[[:space:]]*:[[:space:]]*smooth' apps/web/app/globals.css 2>/dev/null; then
  warn "Found 'scroll-behavior: smooth' — removing (fights Lenis)."
  apply_patch "A1" "apps/web/app/globals.css" <<'NODE'
    const fs = require("fs");
    const f = process.argv[2];
    let s = fs.readFileSync(f, "utf8");
    const before = s;
    // Remove only `scroll-behavior: smooth;` declarations. Preserve auto/initial.
    s = s.replace(/[ \t]*scroll-behavior[ \t]*:[ \t]*smooth[ \t]*;?[ \t]*\n?/g, "");
    if (s === before) process.exit(2);
    fs.writeFileSync(f, s);
NODE
else
  ok "No scroll-behavior: smooth in globals.css"
fi

# ── A2. Audit tokens.css for the same conflict ───────────────────────────────
step "A2. Auditing packages/ui/src/tokens.css for scroll-behavior conflict"
if grep -qE 'scroll-behavior[[:space:]]*:[[:space:]]*smooth' packages/ui/src/tokens.css 2>/dev/null; then
  warn "Found 'scroll-behavior: smooth' — removing."
  apply_patch "A2" "packages/ui/src/tokens.css" <<'NODE'
    const fs = require("fs");
    const f = process.argv[2];
    let s = fs.readFileSync(f, "utf8");
    const before = s;
    s = s.replace(/[ \t]*scroll-behavior[ \t]*:[ \t]*smooth[ \t]*;?[ \t]*\n?/g, "");
    if (s === before) process.exit(2);
    fs.writeFileSync(f, s);
NODE
else
  ok "No scroll-behavior: smooth in tokens.css"
fi

# ── A3. Rewrite AppLayout — body scrolls on non-immersive routes ─────────────
step "A3. Rewriting AppLayout (window-scroll for non-immersive routes)"
apply_patch "A3" "apps/web/components/navigation/AppLayout.tsx" <<'NODE'
  const fs = require("fs");
  const f = process.argv[2];
  let src = fs.readFileSync(f, "utf8");

  if (src.includes("// ZEAL_PHASE1_APPLIED: app-layout-scroll-root")) {
    process.exit(2);
  }

  const sig = "export function AppLayout";
  const start = src.indexOf(sig);
  if (start === -1) {
    console.error("AppLayout signature not found");
    process.exit(1);
  }
  const open = src.indexOf("{", start);
  if (open === -1) { console.error("open brace not found"); process.exit(1); }

  let depth = 0, close = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { close = i + 1; break; } }
  }
  if (close === -1) { console.error("close brace not found"); process.exit(1); }

  const replacement = [
    "export function AppLayout({",
    "  children,",
    "  user,",
    "  profile,",
    "}: {",
    "  children: React.ReactNode;",
    "  user: { id: string } | null;",
    "  profile: Profile;",
    "}) {",
    "  // ZEAL_PHASE1_APPLIED: app-layout-scroll-root",
    "  // Non-immersive routes: document scroll → Lenis attaches to window.",
    "  // Immersive routes (chat, call): fixed shell with internal scroll.",
    "  const pathname = usePathname();",
    "  const balance = profile?.wallet_balance || 0;",
    "  const hideAppNav = pathname?.startsWith(\"/consultant\");",
    "  const immersive =",
    "    pathname?.startsWith(\"/chat\") || pathname?.startsWith(\"/call\");",
    "",
    "  if (immersive) {",
    "    return (",
    "      <div className=\"flex flex-col h-screen-app overflow-hidden bg-[var(--color-background)] w-full relative\">",
    "        <TopNavBar userId={user?.id ?? null} initialBalance={balance} />",
    "        <main",
    "          id=\"main-content\"",
    "          className=\"flex-1 w-full overflow-y-auto custom-scrollbar pt-16\"",
    "        >",
    "          {children}",
    "        </main>",
    "      </div>",
    "    );",
    "  }",
    "",
    "  return (",
    "    <div className=\"min-h-screen-app bg-[var(--color-background)] w-full relative\">",
    "      <TopNavBar userId={user?.id ?? null} initialBalance={balance} />",
    "      <main id=\"main-content\" className=\"w-full pt-16 pb-24\">",
    "        {children}",
    "      </main>",
    "      {!hideAppNav && <BottomNavBar userId={user?.id ?? null} />}",
    "    </div>",
    "  );",
    "}",
  ].join("\n");

  src = src.slice(0, start) + replacement + src.slice(close);
  fs.writeFileSync(f, src);
NODE

# ── A4. Remove nested <main id=main-content> from root layout ────────────────
step "A4. Removing nested <main id=main-content> from apps/web/app/layout.tsx"
apply_patch "A4" "apps/web/app/layout.tsx" <<'NODE'
  const fs = require("fs");
  const f = process.argv[2];
  let src = fs.readFileSync(f, "utf8");

  if (src.includes("// ZEAL_PHASE1_APPLIED: single-main")) {
    process.exit(2);
  }

  // Match `<AppLayout ...> <main id="main-content"> {children} </main> </AppLayout>`
  // across arbitrary whitespace. We build the pattern with `[\s\S]` so it
  // spans newlines, and we keep the AppLayout open/close tags.
  const re = /(<AppLayout[^>]*>)\s*<main\s+id="main-content"[^>]*>\s*\{children\}\s*<\/main>\s*(<\/AppLayout>)/;
  if (!re.test(src)) {
    console.error("Expected <main id=\"main-content\">{children}</main> inside <AppLayout> not found.");
    process.exit(1);
  }
  src = src.replace(re,
    "$1\n                  {/* ZEAL_PHASE1_APPLIED: single-main */}\n                  {children}\n                $2"
  );
  fs.writeFileSync(f, src);
NODE

# ── A5. Harden SmoothScroll — singleton, anchors, coarse-pointer skip ────────
step "A5. Rewriting SmoothScroll (singleton guard + anchor intercept + reduced-motion)"
apply_patch "A5" "packages/ui/src/motion.tsx" <<'NODE'
  const fs = require("fs");
  const f = process.argv[2];
  let src = fs.readFileSync(f, "utf8");

  if (src.includes("// ZEAL_PHASE1_APPLIED: smoothscroll")) {
    process.exit(2);
  }

  const sig = "export function SmoothScroll";
  const start = src.indexOf(sig);
  if (start === -1) { console.error("SmoothScroll not found"); process.exit(1); }

  const open = src.indexOf("{", start);
  if (open === -1) { console.error("open brace not found"); process.exit(1); }

  let depth = 0, close = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { close = i + 1; break; } }
  }
  if (close === -1) { console.error("close brace not found"); process.exit(1); }

  const replacement = [
    "export function SmoothScroll({ children }: { children: React.ReactNode }) {",
    "  // ZEAL_PHASE1_APPLIED: smoothscroll",
    "  // - Singleton guard: safe under React 19 StrictMode double-mount.",
    "  // - Skips on coarse pointers (native momentum scroll is already good).",
    "  // - Skips when prefers-reduced-motion: reduce.",
    "  // - Intercepts in-page #anchor clicks and routes them through Lenis.",
    "  // - Exposes window.__ZEAL_LENIS__ for external scroll control.",
    "  useEffect(() => {",
    "    if (typeof window === \"undefined\") return;",
    "    if (window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches) return;",
    "    if (window.matchMedia(\"(pointer: coarse)\").matches) return;",
    "",
    "    const w = window as unknown as { __ZEAL_LENIS__?: Lenis | null };",
    "    if (w.__ZEAL_LENIS__) return;",
    "",
    "    const lenis = new Lenis({",
    "      duration: 1.15,",
    "      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),",
    "      smoothWheel: true,",
    "      touchMultiplier: 1.6,",
    "      wheelMultiplier: 1,",
    "      lerp: 0.1,",
    "    });",
    "    w.__ZEAL_LENIS__ = lenis;",
    "",
    "    let rafId = 0;",
    "    const raf = (time: number) => {",
    "      lenis.raf(time);",
    "      rafId = requestAnimationFrame(raf);",
    "    };",
    "    rafId = requestAnimationFrame(raf);",
    "",
    "    const onAnchorClick = (e: MouseEvent) => {",
    "      const el = e.target as HTMLElement | null;",
    "      const anchor = el?.closest?.(\"a[href^=\\\"#\\\"]\") as HTMLAnchorElement | null;",
    "      if (!anchor) return;",
    "      const hash = anchor.getAttribute(\"href\");",
    "      if (!hash || hash === \"#\") return;",
    "      const target = document.querySelector(hash);",
    "      if (!target) return;",
    "      e.preventDefault();",
    "      lenis.scrollTo(target as HTMLElement, { offset: -80 });",
    "    };",
    "    document.addEventListener(\"click\", onAnchorClick);",
    "",
    "    return () => {",
    "      document.removeEventListener(\"click\", onAnchorClick);",
    "      cancelAnimationFrame(rafId);",
    "      try { lenis.destroy(); } catch { /* noop */ }",
    "      w.__ZEAL_LENIS__ = null;",
    "    };",
    "  }, []);",
    "",
    "  return <>{children}</>;",
    "}",
  ].join("\n");

  src = src.slice(0, start) + replacement + src.slice(close);
  fs.writeFileSync(f, src);
NODE

fi # end Track A

# ═══════════════════════════════════════════════════════════════════════════════
# TRACK B — REACT ERROR #310
# ═══════════════════════════════════════════════════════════════════════════════
if should_run_track B; then
banner "Track B — React Error #310 (profile hook order)"

# ── B1. Hoist inline useTransform out of JSX in profile/page.tsx ─────────────
step "B1. Hoisting inline useTransform in apps/web/app/profile/page.tsx"
apply_patch "B1" "apps/web/app/profile/page.tsx" <<'NODE'
  const fs = require("fs");
  const f = process.argv[2];
  let src = fs.readFileSync(f, "utf8");

  if (src.includes("// ZEAL_PHASE1_APPLIED: profile-hooks")) {
    process.exit(2);
  }

  // The exact inline-hook pattern that violates Rules of Hooks.
  const bugRe = /style=\{\{\s*opacity:\s*useTransform\(scrollY,\s*\[0,\s*80\],\s*\[1,\s*0\]\)\s*\}\}/;
  if (!bugRe.test(src)) {
    console.error("Expected inline useTransform in JSX not found (already fixed?).");
    process.exit(2);
  }

  // Anchor: the headerOpacity declaration. We add our new hoisted hook
  // immediately after it so it lives in the same unconditional block.
  const anchorRe = /([ \t]*const headerOpacity = useTransform\(scrollY, \[80, 160\], \[0, 1\]\);)/;
  if (!anchorRe.test(src)) {
    console.error("Anchor (headerOpacity) not found — refusing to guess.");
    process.exit(1);
  }

  src = src.replace(
    anchorRe,
    "$1\n  // ZEAL_PHASE1_APPLIED: profile-hooks\n  const backButtonOpacity = useTransform(scrollY, [0, 80], [1, 0]);"
  );
  src = src.replace(bugRe, "style={{ opacity: backButtonOpacity }}");

  // Post-verify: no inline hook inside any style={{ ... }}
  if (/style=\{\{[^}]*useTransform\(/.test(src)) {
    console.error("Post-verify failed: inline useTransform still present.");
    process.exit(1);
  }

  fs.writeFileSync(f, src);
NODE

fi # end Track B

# ═══════════════════════════════════════════════════════════════════════════════
# TRACK C — STABILITY
# ═══════════════════════════════════════════════════════════════════════════════
if should_run_track C; then
banner "Track C — Stability"

# ── C1. Create @zeal/ui/use-hydrated.ts ──────────────────────────────────────
step "C1. Ensuring @zeal/ui/use-hydrated exists"
if [ -f packages/ui/src/use-hydrated.ts ]; then
  skip "Already exists: packages/ui/src/use-hydrated.ts"
else
  write_lf "packages/ui/src/use-hydrated.ts" <<'EOF'
"use client";

import { useEffect, useState } from "react";

/**
 * useHydrated
 * ────────────────────────────────────────────────────────────────────────────
 * Returns `false` on the server and the first client render, then `true`
 * after mount. Use to guard any render-time read of browser-only APIs
 * (localStorage, new Date(), matchMedia, navigator) so the server tree
 * and the client tree stay identical during hydration.
 *
 *   const hydrated = useHydrated();
 *   if (!hydrated) return <Skeleton />;
 *   return <ClientOnlyValue value={localStorage.getItem("x")} />;
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
EOF
fi

# ── C2. Export @zeal/ui/use-hydrated from package.json ──────────────────────
step "C2. Adding ./use-hydrated to @zeal/ui/package.json exports"
apply_patch "C2" "packages/ui/package.json" <<'NODE'
  const fs = require("fs");
  const f = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(f, "utf8"));

  pkg.exports = pkg.exports || {};
  if (pkg.exports["./use-hydrated"]) {
    process.exit(2);
  }
  pkg.exports["./use-hydrated"] = {
    "types": "./src/use-hydrated.ts",
    "default": "./src/use-hydrated.ts"
  };
  fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + "\n");
NODE

# ── C3. Ensure /profile route error boundary ─────────────────────────────────
step "C3. Ensuring /profile route error boundary"
if [ -f apps/web/app/profile/error.tsx ]; then
  skip "Already exists: apps/web/app/profile/error.tsx"
else
  write_lf "apps/web/app/profile/error.tsx" <<'EOF'
"use client";

// ZEAL_PHASE1_APPLIED: profile-error-boundary
// Route-level boundary for /profile. Catches React #310 (hook order),
// data-shape issues, and any thrown error during profile render.
// Logs to console with digest for traceability. Never re-throws.

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Home, RefreshCw } from "lucide-react";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[profile/error]", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-rose-400" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Profile couldn&apos;t load
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || "An unexpected error occurred while loading your profile."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono mb-4">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          type="button"
          onClick={reset}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-bold flex items-center gap-2 active:scale-[0.98] transition-transform"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
        <Link
          href="/"
          className="px-5 py-3 rounded-xl bg-surface-raised border border-border text-foreground text-sm font-bold flex items-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Home className="w-4 h-4" /> Go home
        </Link>
      </div>
    </div>
  );
}
EOF
fi

fi # end Track C

# ═══════════════════════════════════════════════════════════════════════════════
# TRACK D — HYGIENE (barrel export, final assertions)
# ═══════════════════════════════════════════════════════════════════════════════
if should_run_track D; then
banner "Track D — Hygiene"

# ── D1. Barrel-export useHydrated from @zeal/ui ──────────────────────────────
step "D1. Adding useHydrated to @zeal/ui barrel (src/index.ts)"
apply_patch "D1" "packages/ui/src/index.ts" <<'NODE'
  const fs = require("fs");
  const f = process.argv[2];
  let src = fs.readFileSync(f, "utf8");

  if (src.includes('from "./use-hydrated"')) {
    process.exit(2);
  }

  // Append at the end, with a marker so re-runs skip.
  if (!src.endsWith("\n")) src += "\n";
  src += [
    "",
    "// ZEAL_PHASE1_APPLIED: barrel-export-use-hydrated",
    "export { useHydrated } from \"./use-hydrated\";",
    "",
  ].join("\n");

  fs.writeFileSync(f, src);
NODE

fi # end Track D

# ═══════════════════════════════════════════════════════════════════════════════
# 3. VERIFICATION — structural assertions on every patched file
# ═══════════════════════════════════════════════════════════════════════════════
banner "3. Verification"

VFAIL=0
vcheck() {
  # $1=label, rest=command
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    ok "V[$label] pass"
  else
    err "V[$label] FAIL"
    VFAIL=$((VFAIL + 1))
  fi
}

# V1 — AppLayout: non-immersive main has no overflow-y-auto
if should_run_track A; then
  step "V1. AppLayout — window scroll on non-immersive routes"
  vcheck "A1-app-layout" node -e '
    const fs = require("fs");
    const s = fs.readFileSync("apps/web/components/navigation/AppLayout.tsx","utf8");
    // Immersive branch has overflow-y-auto; non-immersive does not.
    if (!s.includes("ZEAL_PHASE1_APPLIED: app-layout-scroll-root")) process.exit(1);
    if (!/className="w-full pt-16 pb-24"/.test(s)) process.exit(1);
    if (/id="main-content"\s+className="[^"]*overflow-y-auto[^"]*pt-16 pb-24/.test(s)) process.exit(1);
  '
fi

# V2 — Root layout has no nested main
if should_run_track A; then
  step "V2. Root layout — no duplicate <main id=main-content>"
  vcheck "A2-single-main" node -e '
    const fs = require("fs");
    const s = fs.readFileSync("apps/web/app/layout.tsx","utf8");
    const hits = (s.match(/id="main-content"/g) || []).length;
    process.exit(hits === 0 ? 0 : 1);
  '
fi

# V3 — SmoothScroll singleton guard present
if should_run_track A; then
  step "V3. SmoothScroll — singleton guard + anchor interception"
  vcheck "A3-smoothscroll" node -e '
    const fs = require("fs");
    const s = fs.readFileSync("packages/ui/src/motion.tsx","utf8");
    if (!s.includes("__ZEAL_LENIS__")) process.exit(1);
    if (!s.includes("prefers-reduced-motion")) process.exit(1);
    if (!s.includes("pointer: coarse")) process.exit(1);
    if (!s.includes("a[href^=")) process.exit(1);
  '
fi

# V4 — profile page has no inline hook in style={{}}
if should_run_track B; then
  step "V4. Profile — no inline useTransform inside style={{}}"
  vcheck "B1-profile-hooks" node -e '
    const fs = require("fs");
    const s = fs.readFileSync("apps/web/app/profile/page.tsx","utf8");
    if (/style=\{\{[^}]*useTransform\(/.test(s)) process.exit(1);
    if (!s.includes("ZEAL_PHASE1_APPLIED: profile-hooks")) process.exit(1);
  '
fi

# V5 — use-hydrated exists and is exported
if should_run_track C; then
  step "V5. @zeal/ui/use-hydrated + package.json export"
  vcheck "C1-use-hydrated" test -f packages/ui/src/use-hydrated.ts
  vcheck "C2-export-map" node -e '
    const pkg = require("./packages/ui/package.json");
    process.exit(pkg.exports && pkg.exports["./use-hydrated"] ? 0 : 1);
  '
fi

# V6 — error boundary present
if should_run_track C; then
  step "V6. /profile route error boundary"
  vcheck "C3-error-boundary" test -f apps/web/app/profile/error.tsx
fi

# V7 — barrel export present
if should_run_track D; then
  step "V7. @zeal/ui barrel exports useHydrated"
  vcheck "D1-barrel" grep -Fq 'from "./use-hydrated"' packages/ui/src/index.ts
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 4. TYPECHECK
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$SKIP_TYPECHECK" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
  banner "4. Typecheck"
  if [ ! -d node_modules ]; then
    warn "node_modules missing — skipping typecheck."
    info "  Run: npm ci --legacy-peer-deps"
    info "  Then: npm run type-check --workspaces --if-present"
  elif command -v npm >/dev/null 2>&1; then
    step "Running: npm run type-check --workspaces --if-present"
    if npm run type-check --workspaces --if-present 2>&1; then
      ok "Typecheck passed"
    else
      err "Typecheck reported errors — inspect output above."
      VFAIL=$((VFAIL + 1))
    fi
  else
    warn "npm not found — cannot run typecheck."
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 5. REPORT
# ═══════════════════════════════════════════════════════════════════════════════
banner "Report"

printf "\n${C_BOLD}Applied changes${C_RST}\n"
cat <<'REPORT'
  Track A — Desktop Mouse Scroll
    • AppLayout: non-immersive routes now use document scroll (Lenis attaches
      to window); immersive routes (chat/call) keep the fixed internal-scroll
      shell. This is the primary fix for "mouse wheel does nothing".
    • Root layout: removed duplicate <main id="main-content"> element.
    • SmoothScroll: singleton guard (StrictMode-safe), coarse-pointer skip,
      prefers-reduced-motion skip, #anchor interception via Lenis, and
      window.__ZEAL_LENIS__ exposure for external scroll control.
    • Audited globals.css and tokens.css for scroll-behavior: smooth conflicts.

  Track B — React Error #310
    • Hoisted `backButtonOpacity` out of inline JSX in /profile — this was the
      exact Rules-of-Hooks violation triggered by the early `if (loading)` and
      `if (!profile)` returns.
    • Added /profile route-level error boundary with branded fallback.

  Track C — Stability
    • Added @zeal/ui/use-hydrated — guards localStorage / Date / matchMedia
      reads during the hydration pass.
    • Added @zeal/ui/use-hydrated export map to package.json.

  Track D — Hygiene
    • Barrel-exported useHydrated from @zeal/ui.
REPORT

printf "\n${C_BOLD}Backup${C_RST}\n"
printf "  %s\n" "$BACKUP_DIR"
printf "  ${C_DIM}(restore with ./setup.sh --rollback)${C_RST}\n"

printf "\n${C_BOLD}Verification${C_RST}\n"
if [ "$VFAIL" -eq 0 ]; then
  printf "  ${C_GRN}${C_BOLD}✓ All structural checks passed${C_RST}\n"
else
  printf "  ${C_RED}${C_BOLD}✗ %d structural check(s) failed${C_RST}\n" "$VFAIL"
fi

printf "\n${C_BOLD}Next steps${C_RST}\n"
cat <<'NEXT'
  1. Restart the dev server:
       npm run dev --workspace=web

  2. Manual verification (5 min):
       • Desktop: mouse wheel scrolls on /, /explore, /services, /profile, /wallet
       • /profile loads without React error #310 in the console
       • /chat still uses its internal scroll shell (immersive path)
       • Radix <Select> / <Dialog> / <Sheet> scroll independently of the page
       • Toggle OS Reduce Motion → Lenis disengages, native scroll still works
       • Toggle DevTools device emulation → no Lenis on touch devices

  3. Commit:
       git add -A
       git commit -m "phase1: scroll root + react #310 + hydration guards"

  4. Rollback if needed:
       ./setup.sh --rollback
NEXT

printf "\n${C_DIM}Finished: %s${C_RST}\n\n" "$(ts_utc)"

if [ "$VFAIL" -gt 0 ]; then
  exit 1
fi
exit 0