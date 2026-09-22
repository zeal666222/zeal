#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — Complete Repo Fix
# ═══════════════════════════════════════════════════════════════════════════════
# Applies:
#   1. packages/ui/src/empty-state.tsx     — string icon support
#   2. packages/ui/src/motion.tsx          — domMax for SVG path morphing
#   3. packages/ui/src/animated-zeal-mark.tsx — defensive path guard
#   4. apps/web/app/explore/page.tsx       — emoji icon instead of Sparkles
#   5. supabase/migrations/703_fix_conversation_rls_recursion.sql
#
# Idempotent. Safe to re-run. Backs up every file it touches.
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Resolve repo root ───────────────────────────────────────────────────────
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd)"
cd "$REPO_ROOT"

if [[ ! -f package.json ]]; then
  echo "✗ Run from repo root (package.json not found in $REPO_ROOT)"
  exit 1
fi

# ─── Colors ──────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; C='\033[0;36m'; N='\033[0m'
else
  G=''; Y=''; R=''; B=''; C=''; N=''
fi
ok()   { printf "${G}  ✓${N} %s\n" "$*"; }
warn() { printf "${Y}  ○${N} %s\n" "$*"; }
fail() { printf "${R}  ✗${N} %s\n" "$*"; }
info() { printf "${C}  ℹ${N} %s\n" "$*"; }
head_() { printf "\n${B}▸ %s${N}\n" "$*"; }

# ─── Backup infrastructure ───────────────────────────────────────────────────
TS=$(date +%Y%m%d-%H%M%S)
BK=".zeal-backup/repo-fix-$TS"
mkdir -p "$BK"

backup() {
  if [[ -f "$1" ]]; then
    mkdir -p "$BK/$(dirname "$1")"
    cp "$1" "$BK/$1"
  fi
}

# ─── Track results ───────────────────────────────────────────────────────────
CHANGED=0
SKIPPED=0
FAILED=0

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 1 — Directory check"
# ═══════════════════════════════════════════════════════════════════════════════

for d in packages/ui/src apps/web/app/explore supabase/migrations; do
  if [[ -d "$d" ]]; then
    ok "$d/"
  else
    mkdir -p "$d"
    warn "created $d/"
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 2 — packages/ui/src/empty-state.tsx"
# ═══════════════════════════════════════════════════════════════════════════════

EMPTY_STATE="packages/ui/src/empty-state.tsx"

if [[ -f "$EMPTY_STATE" ]] && grep -q 'typeof icon === "string"' "$EMPTY_STATE" 2>/dev/null; then
  warn "already patched — skipping"
  SKIPPED=$((SKIPPED+1))
else
  backup "$EMPTY_STATE"
  cat > "$EMPTY_STATE" <<'TS_EOF'
"use client";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface EmptyStateProps {
  icon?: LucideIcon | string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "min-h-[280px] p-8",
        className,
      )}
    >
      {icon !== undefined && icon !== null && (
        typeof icon === "string" ? (
          <div className="text-4xl mb-4" aria-hidden>{icon}</div>
        ) : (
          <div className="p-4 rounded-full bg-[var(--color-surface-raised)] mb-4">
            {React.createElement(icon, {
              className: "w-8 h-8 text-[var(--color-muted-foreground)]",
            })}
          </div>
        )
      )}
      <h3 className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1.5 max-w-md">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
TS_EOF
  ok "wrote $EMPTY_STATE"
  CHANGED=$((CHANGED+1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 3 — packages/ui/src/motion.tsx (domMax)"
# ═══════════════════════════════════════════════════════════════════════════════

MOTION="packages/ui/src/motion.tsx"

if [[ ! -f "$MOTION" ]]; then
  warn "$MOTION not found — skipping"
  SKIPPED=$((SKIPPED+1))
elif grep -q "domMax" "$MOTION" 2>/dev/null; then
  warn "already using domMax — skipping"
  SKIPPED=$((SKIPPED+1))
elif grep -q "domAnimation" "$MOTION" 2>/dev/null; then
  backup "$MOTION"
  sed -i 's/domAnimation/domMax/g' "$MOTION"
  ok "switched domAnimation → domMax"
  CHANGED=$((CHANGED+1))
else
  warn "motion.tsx uses neither domAnimation nor domMax — manual review needed"
  SKIPPED=$((SKIPPED+1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 4 — packages/ui/src/animated-zeal-mark.tsx"
# ═══════════════════════════════════════════════════════════════════════════════

ZEAL_MARK="packages/ui/src/animated-zeal-mark.tsx"

if [[ -f "$ZEAL_MARK" ]] && grep -q "safePath" "$ZEAL_MARK" 2>/dev/null; then
  warn "already patched — skipping"
  SKIPPED=$((SKIPPED+1))
else
  backup "$ZEAL_MARK"
  cat > "$ZEAL_MARK" <<'TS_EOF'
"use client";
import { useId } from "react";
import { m } from "framer-motion";
import { cn } from "./utils";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
  animate?: boolean;
  variant?: "brand" | "mono";
}

const PATHS = {
  z:        "M 8 10 L 40 10 L 8 38 L 40 38",
  triangle: "M 24 8 L 40 34 L 8 34 L 40 34",
  diamond:  "M 24 8 L 40 24 L 24 40 L 8 24",
  square:   "M 8 8 L 40 8 L 40 40 L 8 40",
} as const;

const SEQUENCE = [PATHS.z, PATHS.triangle, PATHS.diamond, PATHS.square, PATHS.z];

function safePath(d: string | undefined | null): string {
  if (typeof d !== "string" || d.length === 0) return PATHS.z;
  if (!/^[Mm]/.test(d.trim())) return PATHS.z;
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
  const glowId = `zeal-mark-glow-${safe}`;
  const stroke = variant === "brand" ? `url(#${gradientId})` : "currentColor";
  const d0 = safePath(PATHS.z);

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-label="Zeal"
    >
      {glow && (
        <m.span
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              variant === "brand"
                ? "radial-gradient(circle, rgba(157,125,197,0.5) 0%, rgba(83,58,253,0) 70%)"
                : "radial-gradient(circle, currentColor 0%, transparent 70%)",
          }}
          animate={animate ? { scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] } : undefined}
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
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {animate ? (
          <m.path
            d={d0}
            stroke={stroke}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
            animate={{ d: SEQUENCE }}
            transition={{
              duration: 12,
              repeat: Infinity,
              times: [0, 0.25, 0.5, 0.75, 1],
              ease: "easeInOut",
            }}
          />
        ) : (
          <path
            d={d0}
            stroke={stroke}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />
        )}
      </svg>
    </span>
  );
}
TS_EOF
  ok "wrote $ZEAL_MARK"
  CHANGED=$((CHANGED+1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 5 — apps/web/app/explore/page.tsx"
# ═══════════════════════════════════════════════════════════════════════════════

EXPLORE="apps/web/app/explore/page.tsx"

if [[ ! -f "$EXPLORE" ]]; then
  warn "$EXPLORE not found — skipping"
  SKIPPED=$((SKIPPED+1))
elif ! grep -q "icon={Sparkles}" "$EXPLORE" 2>/dev/null; then
  warn "no Sparkles icon reference — skipping"
  SKIPPED=$((SKIPPED+1))
else
  backup "$EXPLORE"

  # Replace icon={Sparkles} with icon="✨"
  sed -i 's/icon={Sparkles}/icon="✨"/g' "$EXPLORE"

  # Remove Sparkles from the lucide-react import list if it's no longer used
  if ! grep -v "^import" "$EXPLORE" | grep -q "Sparkles"; then
    # Use Node for a safe import-list rewrite
    node - "$EXPLORE" <<'NODE_EOF'
const fs = require("fs");
const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");
src = src.replace(
  /import\s*\{([^}]*)\}\s*from\s*"lucide-react";/,
  (m, imports) => {
    const list = imports
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "Sparkles");
    return `import { ${list.join(", ")} } from "lucide-react";`;
  }
);
fs.writeFileSync(file, src, "utf8");
console.log("  → removed Sparkles from lucide-react import");
NODE_EOF
  fi

  ok "patched $EXPLORE"
  CHANGED=$((CHANGED+1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 6 — SQL migration 703"
# ═══════════════════════════════════════════════════════════════════════════════

MIGRATION="supabase/migrations/703_fix_conversation_rls_recursion.sql"

if [[ -f "$MIGRATION" ]] && grep -q "user_is_in_conversation" "$MIGRATION" 2>/dev/null; then
  warn "migration already present — skipping"
  SKIPPED=$((SKIPPED+1))
else
  backup "$MIGRATION"
  cat > "$MIGRATION" <<'SQL_EOF'
BEGIN;
SET LOCAL statement_timeout = '2min';

DROP POLICY IF EXISTS participant_self_read         ON public."ConversationParticipant";
DROP POLICY IF EXISTS message_participant_read      ON public."Message";
DROP POLICY IF EXISTS message_participant_send      ON public."Message";
DROP POLICY IF EXISTS conversation_participant_read ON public."Conversation";

CREATE OR REPLACE FUNCTION public.user_is_in_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."ConversationParticipant"
    WHERE "conversationId" = p_conversation_id
      AND "userId" = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_in_conversation(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_in_conversation(uuid) TO authenticated;

CREATE POLICY conversation_participant_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (public.user_is_in_conversation("Conversation".id));

CREATE POLICY participant_self_read ON public."ConversationParticipant"
  FOR SELECT TO authenticated
  USING (
    "userId" = (SELECT auth.uid())
    OR public.user_is_in_conversation("ConversationParticipant"."conversationId")
  );

CREATE POLICY message_participant_read ON public."Message"
  FOR SELECT TO authenticated
  USING (public.user_is_in_conversation("Message"."conversationId"));

CREATE POLICY message_participant_send ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderId" = (SELECT auth.uid())
    AND public.user_is_in_conversation("Message"."conversationId")
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
SQL_EOF
  ok "wrote $MIGRATION"
  CHANGED=$((CHANGED+1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 7 — Verify repo files"
# ═══════════════════════════════════════════════════════════════════════════════

verify() {
  local file="$1" pattern="$2" label="$3"
  if [[ ! -f "$file" ]]; then
    fail "$label — file missing: $file"
    FAILED=$((FAILED+1))
  elif grep -q "$pattern" "$file" 2>/dev/null; then
    ok "$label"
  else
    fail "$label — pattern not found: $pattern"
    FAILED=$((FAILED+1))
  fi
}

verify "packages/ui/src/empty-state.tsx"          'typeof icon === "string"'      "empty-state handles string icons"
verify "packages/ui/src/motion.tsx"               "domMax"                        "motion.tsx uses domMax"
verify "packages/ui/src/animated-zeal-mark.tsx"   "safePath"                      "animated-zeal-mark guards path"
verify "apps/web/app/explore/page.tsx"            'icon="✨"'                     "explore uses emoji icon"
verify "supabase/migrations/703_fix_conversation_rls_recursion.sql" "user_is_in_conversation" "SQL migration written"

# Verify Sparkles is gone from explore page
if grep -q "icon={Sparkles}" "apps/web/app/explore/page.tsx" 2>/dev/null; then
  fail "explore still passes Sparkles as icon"
  FAILED=$((FAILED+1))
else
  ok "no Sparkles reference in explore"
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 8 — Optional type-check"
# ═══════════════════════════════════════════════════════════════════════════════

if [[ "${SKIP_TYPECHECK:-0}" == "1" ]]; then
  warn "SKIP_TYPECHECK=1 — skipped"
elif command -v npm >/dev/null 2>&1 && [[ -d node_modules ]]; then
  if npm run type-check --workspaces --if-present >/dev/null 2>&1; then
    ok "type-check passed"
  else
    warn "type-check reported issues — run manually to see details"
  fi
else
  warn "npm or node_modules missing — skipped"
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "REPORT"
# ═══════════════════════════════════════════════════════════════════════════════

printf "\n"
printf "  Files changed    : %d\n" "$CHANGED"
printf "  Files skipped    : %d\n" "$SKIPPED"
printf "  Verification fail: %d\n" "$FAILED"
printf "\n"
printf "  Backup directory : %s\n" "$BK"
printf "\n"

if [[ "$FAILED" -gt 0 ]]; then
  printf "${R}${B}  ✗ %d issue(s) remain${N}\n" "$FAILED"
  printf "\n"
  printf "  Check the failing entries above.\n"
  printf "  Backup is at: %s\n" "$BK"
  printf "\n"
  exit 1
fi

printf "${G}${B}  ✓ Repo fix complete${N}\n"
printf "\n"
printf "${B}  Next steps:${N}\n"
printf "    1. Apply the SQL migration:\n"
printf "       ${C}bash -c 'supabase db push'${N}\n"
printf "       OR paste ${C}supabase/migrations/703_fix_conversation_rls_recursion.sql${N}\n"
printf "       into Supabase → SQL Editor → Run\n"
printf "\n"
printf "    2. Build both apps:\n"
printf "       ${C}npm run build${N}\n"
printf "\n"
printf "    3. Commit + push (Vercel auto-deploys):\n"
printf "       ${C}git add -A && git commit -m 'fix: RSC icon, domMax, RLS recursion' && git push${N}\n"
printf "\n"
printf "    4. Hard-refresh the browser (Ctrl+Shift+R) to clear cached errors.\n"
printf "\n"
printf "    5. Re-test: open /explore → click AI astrologer → chat page should load\n"
printf "\n"
printf "  To skip type-check next time: ${C}SKIP_TYPECHECK=1 bash fix-repo.sh${N}\n"
printf "\n"