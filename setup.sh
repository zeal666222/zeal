#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — COMPLETE AUTH REWRITE (idempotent, self-locating, cross-platform)
# ─────────────────────────────────────────────────────────────────────────────
# USAGE
#   ./setup.sh                    # full rewrite + SQL apply
#   ./setup.sh --no-sql           # frontend only
#   ./setup.sh --verify-only      # audit only, no writes
#   ./setup.sh --dry-run          # show what would happen
#   ./setup.sh --rollback         # restore from .zeal-backup/
#
# GUARANTEES
#   • Detects repo root regardless of CWD or script location
#   • Never writes outside repo root
#   • Backs up every modified file to .zeal-backup/<timestamp>/
#   • Compares SHA-256 hashes; skips unchanged files
#   • Windows Git Bash safe (fixes HOME, paths)
#   • Idempotent — run as many times as you want
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

# ─── Colors ─────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; MAGENTA=''; BOLD=''; DIM=''; NC=''
fi

# ─── Output helpers ─────────────────────────────────────────────────────────
ok()      { echo -e "${GREEN}✓${NC} $1"; }
skip()    { echo -e "${DIM}○ $1 (unchanged)${NC}"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
err()     { echo -e "${RED}✗${NC} $1"; }
info()    { echo -e "${BLUE}→${NC} $1"; }
section() { echo ""; echo -e "${MAGENTA}${BOLD}▶ $1${NC}"; echo ""; }
step()    { echo -e "${CYAN}  $1${NC}"; }
header() {
  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  printf "${BOLD}║  %-62s ║${NC}\n" "$1"
  echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# ARG PARSING
# ═══════════════════════════════════════════════════════════════════════════════
MODE="full"
DRY_RUN=false
NO_SQL=false
for arg in "$@"; do
  case "$arg" in
    --no-sql)       NO_SQL=true ;;
    --verify-only)  MODE="verify" ;;
    --dry-run)      DRY_RUN=true ;;
    --rollback)     MODE="rollback" ;;
    --help|-h)
      echo "Usage: ./setup.sh [--no-sql] [--verify-only] [--dry-run] [--rollback]"
      exit 0 ;;
  esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# BOOTSTRAP — HOME, CWD, REPO ROOT DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

# Fix Windows Git Bash HOME (points to Program Files)
if [[ "${HOME:-}" == *"Program Files"* ]]; then
  export HOME="/c/Users/${USERNAME:-$USER}"
  warn "HOME corrected: $HOME"
fi

# Ensure HOME is writable
if [[ ! -w "$HOME" ]]; then
  export HOME="/tmp"
  warn "HOME not writable, using /tmp"
fi

# Repo root detection: walk up from CWD looking for marker files
find_repo_root() {
  local dir="$PWD"
  while [[ -n "$dir" && "$dir" != "/" && "$dir" != "." ]]; do
    if [[ -f "$dir/package.json" ]] \
       && [[ -d "$dir/apps" ]] \
       && [[ -d "$dir/packages" ]]; then
      echo "$dir"
      return 0
    fi
    local parent
    parent="$(cd "$dir/.." 2>/dev/null && pwd)" || break
    [[ "$parent" == "$dir" ]] && break
    dir="$parent"
  done
  return 1
}

REPO_ROOT="$(find_repo_root)" || {
  err "Cannot find repo root. Expected to run from inside the zeal repo."
  err "Looking for: package.json + apps/ + packages/"
  err "Current directory: $PWD"
  exit 1
}

cd "$REPO_ROOT" || { err "Cannot cd to $REPO_ROOT"; exit 1; }

# Writability check
if ! touch "$REPO_ROOT/.zeal-write-test" 2>/dev/null; then
  err "Repo root not writable: $REPO_ROOT"
  exit 1
fi
rm -f "$REPO_ROOT/.zeal-write-test"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$REPO_ROOT/.zeal-backup/$TIMESTAMP"
LOG_FILE="$REPO_ROOT/.zeal-backup/rewrite-$TIMESTAMP.log"

mkdir -p "$BACKUP_DIR" "$REPO_ROOT/.zeal-backup"

# ═══════════════════════════════════════════════════════════════════════════════
# BANNER
# ═══════════════════════════════════════════════════════════════════════════════
header "ZEAL — COMPLETE AUTH REWRITE"
echo "  Repo root   : $REPO_ROOT"
echo "  Backup dir  : $BACKUP_DIR"
echo "  Timestamp   : $TIMESTAMP"
echo "  Mode        : $MODE"
echo "  Dry run     : $DRY_RUN"
echo "  No SQL      : $NO_SQL"
echo "  HOME        : $HOME"
echo "  Platform    : $(uname -s) $(uname -r)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# ROLLBACK MODE
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "rollback" ]]; then
  header "ROLLBACK MODE"
  LATEST="$(ls -1 "$REPO_ROOT/.zeal-backup" 2>/dev/null | grep '^[0-9]' | sort | tail -1)"
  if [[ -z "$LATEST" ]]; then
    err "No backups found in $REPO_ROOT/.zeal-backup"
    exit 1
  fi
  BACKUP_ROOT="$REPO_ROOT/.zeal-backup/$LATEST"
  info "Restoring from: $BACKUP_ROOT"
  find "$BACKUP_ROOT" -type f | while read -r f; do
    REL="${f#$BACKUP_ROOT/}"
    TARGET="$REPO_ROOT/$REL"
    mkdir -p "$(dirname "$TARGET")"
    cp "$f" "$TARGET"
    ok "Restored: $REL"
  done
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# ENV LOADER
# ═══════════════════════════════════════════════════════════════════════════════
load_env() {
  local f
  for f in ".env.phase1" ".env.local" ".env.production.local" ".env" \
           "apps/web/.env.local" "apps/web/.env.production.local" \
           "apps/admin/.env.local" "apps/admin/.env.production.local"; do
    [[ -f "$f" ]] || continue
    while IFS='=' read -r key value || [[ -n "$key" ]]; do
      [[ "$key" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${key// }" ]] && continue
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      value="${value:-}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"
      value="${value%\"}"; value="${value#\"}"
      value="${value%\'}"; value="${value#\'}"
      if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && [[ -z "${!key:-}" ]]; then
        export "$key=$value" 2>/dev/null || true
      fi
    done < "$f"
  done
}

load_env
[[ -z "${SUPABASE_URL:-}" && -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]] && \
  export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
PROJECT_REF=""
[[ -n "${SUPABASE_URL:-}" ]] && \
  PROJECT_REF="$(echo "$SUPABASE_URL" | sed -n 's|https://\([a-z0-9]*\)\.supabase\.co.*|\1|p')"

# ═══════════════════════════════════════════════════════════════════════════════
# WRITE HELPERS — content-hash based, idempotent, backed up
# ═══════════════════════════════════════════════════════════════════════════════

sha256_of() {
  # Cross-platform SHA-256 (Git Bash, macOS, Linux)
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" 2>/dev/null | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
  else
    # Fallback: use file size + mtime
    stat -c "%s-%Y" "$1" 2>/dev/null || echo "unknown"
  fi
}

sha256_of_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  else
    cat | wc -c
  fi
}

# ─── write_file <relpath> <<'EOF' ... EOF ───────────────────────────────────
# Writes content to <relpath>. Behavior:
#   • Backs up existing file to $BACKUP_DIR/<relpath>
#   • Compares hashes → skips if unchanged
#   • Dry-run → prints action only
#   • Idempotent → safe to run 100x
write_file() {
  local relpath="$1"
  local fullpath="$REPO_ROOT/$relpath"
  local dir
  dir="$(dirname "$fullpath")"

  # Read content from stdin into a temp file (avoids in-memory bloat)
  local tmp
  tmp="$(mktemp)"
  cat > "$tmp"

  local new_hash
  new_hash="$(sha256_of "$tmp")"

  # Ensure directory exists
  if [[ ! -d "$dir" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      info "[dry-run] would mkdir -p $dir"
    else
      if ! mkdir -p "$dir" 2>/dev/null; then
        err "Cannot create $dir"
        rm -f "$tmp"
        return 1
      fi
    fi
  fi

  # Skip if identical
  if [[ -f "$fullpath" ]]; then
    local old_hash
    old_hash="$(sha256_of "$fullpath")"
    if [[ "$old_hash" == "$new_hash" ]]; then
      skip "$relpath"
      rm -f "$tmp"
      return 0
    fi

    # Backup before overwrite
    if [[ "$DRY_RUN" != "true" ]]; then
      local backup_path="$BACKUP_DIR/$relpath"
      mkdir -p "$(dirname "$backup_path")"
      cp "$fullpath" "$backup_path"
    fi
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[dry-run] would write $relpath"
    rm -f "$tmp"
    return 0
  fi

  # Write
  if cp "$tmp" "$fullpath" 2>/dev/null; then
    ok "$relpath"
  else
    err "Failed to write $relpath"
    rm -f "$tmp"
    return 1
  fi
  rm -f "$tmp"
  return 0
}

# ─── write_note <relpath> <<'EOF' ... EOF ───────────────────────────────────
# Same as write_file but marked as a "note" (manual patch doc)
write_note() {
  write_file "$1"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — SQL REPAIR
# ═══════════════════════════════════════════════════════════════════════════════
SQL_FILE="$REPO_ROOT/supabase/migrations/090_auth_repair.sql"

section "PHASE 1 — SQL REPAIR"
step "Writing $SQL_FILE..."

write_file "supabase/migrations/090_auth_repair.sql" << 'SQL_EOF'
-- ═══════════════════════════════════════════════════════════════════════════════
-- 090_auth_repair.sql — idempotent repair of the auth chain
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill Consultant for every CLIENT_ADMIN user
-- 2. Promote users with Consultant rows to CLIENT_ADMIN
-- 3. Sync app_metadata.role from User.role (JWT carries correct role)
-- 4. Create self_heal_user() RPC — callable from frontend
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Backfill Consultant for CLIENT_ADMIN users without one ─────────────
INSERT INTO public."Consultant" (
  "userId", category, specialties, languages, "perMinuteRate",
  status, "isVerified", "isActive",
  subdomain, "subdomainActive", "whiteLabelEnabled",
  rating, "totalConsultations", "sparkScore", "bufferMinutes"
)
SELECT
  u.id, 'ASTROLOGER', '{}', '{English}', 50,
  'VERIFIED', true, true,
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(
      COALESCE(u.name, SPLIT_PART(u.email,'@',1), 'guide'),
      '[^a-zA-Z0-9]+','-','g'))), ''),
    'guide'
  ) || '-' || SUBSTRING(REPLACE(u.id::text, '-', ''), 1, 4),
  true, true,
  5.0, 0, 0, 10
FROM public."User" u
LEFT JOIN public."Consultant" c ON c."userId"::text = u.id::text
WHERE c.id IS NULL
  AND u.role::text IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN','SUPPORT')
ON CONFLICT DO NOTHING;

-- ─── 2. Promote users with Consultant rows ──────────────────────────────────
UPDATE public."User" u
SET role = 'CLIENT_ADMIN'::"AppRole"
WHERE u.role::text = 'USER'
  AND EXISTS (
    SELECT 1 FROM public."Consultant" c
    WHERE c."userId"::text = u.id::text AND c.status = 'VERIFIED'
  );

-- ─── 3. Sync app_metadata.role from User.role ───────────────────────────────
UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', u.role::text)
FROM public."User" u
WHERE au.id::text = u.id::text
  AND COALESCE(au.raw_app_meta_data->>'role', 'USER') <> u.role::text;

-- ─── 4. self_heal_user() RPC — called from client after auth ───────────────
CREATE OR REPLACE FUNCTION public.self_heal_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_has_consultant boolean := false;
  v_created boolean := false;
  v_slug text;
  v_subdomain text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT role::text INTO v_role
  FROM public."User" WHERE id = v_uid;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_user_row');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public."Consultant" WHERE "userId"::text = v_uid::text
  ) INTO v_has_consultant;

  IF v_role IN ('CLIENT_ADMIN','ADMIN','SUPER_ADMIN','SUPPORT') AND NOT v_has_consultant THEN
    SELECT LOWER(REGEXP_REPLACE(
      COALESCE(name, 'guide'), '[^a-zA-Z0-9]+','-','g'))
    INTO v_slug FROM public."User" WHERE id = v_uid;

    v_slug := TRIM(BOTH '-' FROM COALESCE(v_slug, 'guide'));
    IF LENGTH(v_slug) < 3  THEN v_slug := 'guide'; END IF;
    IF LENGTH(v_slug) > 20 THEN v_slug := SUBSTRING(v_slug, 1, 20); END IF;
    v_subdomain := v_slug || '-' || SUBSTRING(REPLACE(v_uid::text, '-', ''), 1, 4);

    INSERT INTO public."Consultant" (
      "userId", category, specialties, languages, "perMinuteRate",
      status, "isVerified", "isActive",
      subdomain, "subdomainActive", "whiteLabelEnabled",
      rating, "totalConsultations", "sparkScore", "bufferMinutes"
    ) VALUES (
      v_uid, 'ASTROLOGER', '{}', '{English}', 50,
      'VERIFIED', true, true,
      v_subdomain, true, true,
      5.0, 0, 0, 10
    )
    ON CONFLICT DO NOTHING;

    v_created := true;
    v_has_consultant := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_role,
    'has_consultant', v_has_consultant,
    'created', v_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_heal_user() TO authenticated;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '  090_auth_repair.sql — APPLIED';
  RAISE NOTICE '  Consultant rows : %', (SELECT COUNT(*) FROM public."Consultant");
  RAISE NOTICE '  CLIENT_ADMINs   : %', (SELECT COUNT(*) FROM public."User" WHERE role::text = 'CLIENT_ADMIN');
  RAISE NOTICE '  Synced metadata : OK';
  RAISE NOTICE '════════════════════════════════════════════════';
END $$;

COMMIT;
SQL_EOF

# ─── Apply SQL via Supabase CLI ─────────────────────────────────────────────
if [[ "$NO_SQL" == "false" && "$MODE" != "verify" && "$DRY_RUN" != "true" ]]; then
  section "PHASE 1B — APPLYING SQL"
  if ! command -v supabase >/dev/null 2>&1; then
    warn "supabase CLI not found — skipping SQL apply"
    warn "Run manually: supabase db push --include-all"
  elif [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    warn "SUPABASE_ACCESS_TOKEN not set — skipping SQL apply"
    warn "Add it to .env.phase1 or run: supabase login"
  else
    step "Linking project $PROJECT_REF..."
    mkdir -p "$REPO_ROOT/supabase/.temp"
    if supabase link --project-ref "$PROJECT_REF" 2>&1 | sed 's/^/    /'; then
      ok "Linked"
    else
      warn "Link failed — continuing"
    fi

    step "Running migration (this may take 10-30s)..."
    if supabase db push --include-all 2>&1 | tee -a "$LOG_FILE" | sed 's/^/    /'; then
      ok "SQL applied"
    else
      warn "supabase db push failed — check log"
      warn "Log: $LOG_FILE"
      warn "Fallback: paste supabase/migrations/090_auth_repair.sql in Supabase SQL Editor"
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — SHARED GOTRUE CLIENT (fix Multiple GoTrueClient)
# ═══════════════════════════════════════════════════════════════════════════════
section "PHASE 2 — SHARED GOTRUE CLIENT"

step "Writing packages/database/src/client.ts ..."
write_file "packages/database/src/client.ts" << 'EOF'
// packages/database/src/client.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Shared browser client — singleton via globalThis to prevent duplicate
// GoTrueClient instances across @zeal/database + @zeal/realtime.
// ═══════════════════════════════════════════════════════════════════════════════

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zeal/types";

export * from "@zeal/types";

declare global {
  // eslint-disable-next-line no-var
  var __ZEAL_SUPABASE_BROWSER__: ReturnType<typeof createBrowserClient<Database>> | undefined;
}

// ─── Anon client (server-safe, no persistence) ──────────────────────────────
export function createAnonClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSupabaseClient(url, key);
}

// ─── Singleton browser client ───────────────────────────────────────────────
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserClient(): any {
  // Reuse shared slot (prevents duplicate GoTrueClient warning)
  if (typeof window !== "undefined" && globalThis.__ZEAL_SUPABASE_BROWSER__) {
    return globalThis.__ZEAL_SUPABASE_BROWSER__;
  }
  if (browserClient) {
    if (typeof window !== "undefined") {
      globalThis.__ZEAL_SUPABASE_BROWSER__ = browserClient;
    }
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // SSR/prerender without env → dummy client
  if (!url || !key) {
    if (typeof window === "undefined") {
      return createSupabaseClient("http://127.0.0.1:54321", "build-dummy-key");
    }
    throw new Error("[@zeal/database] Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  browserClient = createBrowserClient<Database>(url, key);
  if (typeof window !== "undefined") {
    globalThis.__ZEAL_SUPABASE_BROWSER__ = browserClient;
  }
  return browserClient;
}

export function createClient(): any {
  return getBrowserClient();
}

// ─── Prisma shim (legacy compat) ────────────────────────────────────────────
export const prisma = new Proxy({}, {
  get: () => new Proxy({}, { get: () => () => Promise.resolve(null) }),
}) as any;

export const withTransaction = async <T>(cb: (tx: any) => Promise<T>): Promise<T> =>
  cb(prisma);
EOF

step "Writing packages/realtime/src/client.ts ..."
write_file "packages/realtime/src/client.ts" << 'EOF'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — Shared Supabase Realtime Client
// Reuses the browser client from @zeal/database to avoid duplicate GoTrueClient.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface BroadcastChange<T = unknown> {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: T;
  old_record?: T | null;
}

interface Listener<T = unknown> { id: string; handler: (payload: T) => void; }

interface ChannelEntry {
  channel: RealtimeChannel;
  listeners: Map<string, Map<string, Listener>>;
  subscribePromise?: Promise<void>;
  status: "pending" | "subscribed" | "error";
}

let client: SupabaseClient | null = null;
const channels = new Map<string, ChannelEntry>();
const stateListeners = new Set<(s: ConnectionState) => void>();
const seenEventIds = new Set<string>();
const MAX_SEEN = 500;
const TRIM_TO = 250;

let currentState: ConnectionState = "disconnected";
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const MAX_ATTEMPTS = 10;

let listenerCounter = 0;
const nextId = () => `l-${++listenerCounter}-${Date.now()}`;

function setState(next: ConnectionState) {
  if (next === currentState) return;
  currentState = next;
  for (const fn of stateListeners) {
    try { fn(next); } catch (e) { console.warn("[realtime] state listener error", e); }
  }
}

export function onConnectionStateChange(fn: (s: ConnectionState) => void): () => void {
  stateListeners.add(fn);
  fn(currentState);
  return () => { stateListeners.delete(fn); };
}

export function getConnectionState(): ConnectionState { return currentState; }

export function getRealtimeClient(): SupabaseClient | null {
  if (client) return client;

  // Reuse the shared browser client
  if (typeof window !== "undefined") {
    const shared = (globalThis as { __ZEAL_SUPABASE_BROWSER__?: SupabaseClient })
      .__ZEAL_SUPABASE_BROWSER__;
    if (shared) {
      client = shared;
      setState("connecting");
      return client;
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[realtime] Missing Supabase env — realtime disabled");
    return null;
  }

  // Lazy-create if no shared client exists yet
  const { createClient } = require("@supabase/supabase-js");
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 }, timeout: 20_000 },
  });

  if (typeof window !== "undefined") {
    (globalThis as { __ZEAL_SUPABASE_BROWSER__?: SupabaseClient })
      .__ZEAL_SUPABASE_BROWSER__ = client!;
  }

  setState("connecting");
  return client;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (reconnectAttempt >= MAX_ATTEMPTS) { setState("disconnected"); return; }
  reconnectAttempt++;
  const base = Math.min(BASE_BACKOFF_MS * Math.pow(2, reconnectAttempt - 1), MAX_BACKOFF_MS);
  const jitter = base * 0.3 * (Math.random() * 2 - 1);
  const delay = Math.max(100, Math.round(base + jitter));
  setState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!client) return;
    for (const entry of channels.values()) {
      try { entry.channel.subscribe(); } catch { /* ignore */ }
    }
  }, delay);
}

function getOrCreateChannel(topic: string): ChannelEntry | null {
  const sb = getRealtimeClient();
  if (!sb) return null;
  const existing = channels.get(topic);
  if (existing) return existing;
  const channel = sb.channel(topic, {
    config: { broadcast: { self: false, ack: false }, presence: { key: "" } },
  });
  const entry: ChannelEntry = { channel, listeners: new Map(), status: "pending" };
  channels.set(topic, entry);
  return entry;
}

export function subscribe<T = unknown>(
  topic: string, event: string, handler: (payload: T) => void,
): () => void {
  const entry = getOrCreateChannel(topic);
  if (!entry) return () => {};

  let eventMap = entry.listeners.get(event);
  if (!eventMap) {
    eventMap = new Map();
    entry.listeners.set(event, eventMap);

    entry.channel.on("broadcast", { event }, (message: unknown) => {
      const payload = (message as { payload?: unknown })?.payload;
      const id = (payload as { id?: string } | null)?.id;
      if (id) {
        if (seenEventIds.has(id)) return;
        seenEventIds.add(id);
        if (seenEventIds.size > MAX_SEEN) {
          const arr = Array.from(seenEventIds);
          seenEventIds.clear();
          for (const k of arr.slice(-TRIM_TO)) seenEventIds.add(k);
        }
      }
      const listeners = entry!.listeners.get(event);
      if (!listeners) return;
      for (const l of listeners.values()) {
        try { l.handler(payload); }
        catch (e) { console.error(`[realtime] handler error ${topic}:${event}`, e); }
      }
    });
  }

  const listener: Listener<T> = { id: nextId(), handler };
  eventMap.set(listener.id, listener as Listener);

  if (!entry.subscribePromise) {
    entry.subscribePromise = new Promise<void>((resolve) => {
      entry!.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          entry!.status = "subscribed";
          reconnectAttempt = 0;
          setState("connected");
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          entry!.status = "error";
          setState("reconnecting");
          scheduleReconnect();
        }
      });
    });
  }

  return () => {
    const e = channels.get(topic);
    if (!e) return;
    const map = e.listeners.get(event);
    if (map) {
      map.delete(listener.id);
      if (map.size === 0) e.listeners.delete(event);
    }
    if (e.listeners.size === 0) {
      try { e.channel.unsubscribe(); } catch { /* ignore */ }
      channels.delete(topic);
    }
  };
}

export interface PresenceHandle<T> {
  unsubscribe: () => void;
  track: (state: T) => void;
  untrack: () => void;
}

export function subscribePresence<T extends Record<string, unknown>>(
  topic: string, key: string, onSync: (state: Record<string, T[]>) => void,
): PresenceHandle<T> {
  const sb = getRealtimeClient();
  if (!sb) return { unsubscribe: () => {}, track: () => {}, untrack: () => {} };

  const channel = sb.channel(`presence:${topic}`, { config: { presence: { key } } });
  let tracked = false;

  channel
    .on("presence", { event: "sync" }, () => {
      try { onSync(channel.presenceState() as Record<string, T[]>); }
      catch (e) { console.error("[realtime] presence sync error", e); }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && !tracked) {
        tracked = true;
        try { channel.track({ online_at: new Date().toISOString() }); }
        catch { /* ignore */ }
      }
    });

  return {
    track: (state: T) => { try { channel.track(state); } catch { /* ignore */ } },
    untrack: () => { try { channel.untrack(); } catch { /* ignore */ } },
    unsubscribe: () => {
      try { channel.untrack(); } catch { /* ignore */ }
      try { sb.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}

export async function publish<T = unknown>(
  topic: string, event: string, payload: T,
): Promise<boolean> {
  const sb = getRealtimeClient();
  if (!sb) return false;
  const ch = sb.channel(topic);
  await ch.subscribe();
  try {
    const res = await ch.send({ type: "broadcast", event, payload });
    return res === "ok";
  } catch { return false; }
  finally { try { await sb.removeChannel(ch); } catch { /* ignore */ } }
}

export function disconnectAll() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  for (const [topic, entry] of channels.entries()) {
    try { entry.channel.unsubscribe(); } catch { /* ignore */ }
  }
  channels.clear();
  seenEventIds.clear();
  setState("disconnected");
}
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — ADMIN REGISTER + CALLBACK + LOGIN
# ═══════════════════════════════════════════════════════════════════════════════
section "PHASE 3 — ADMIN PORTAL"

step "apps/admin/app/register/page.tsx"
write_file "apps/admin/app/register/page.tsx" << 'EOF'
"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Loader2, Lock, Mail,
  MailCheck, Sparkles, User as UserIcon,
} from "lucide-react";
import { registerConsultantAction } from "@/actions/register";

function Content() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [email, setEmail] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    setEmail(String(fd.get("email") ?? ""));
    const res = await registerConsultantAction(fd);
    if (res.ok) {
      if (res.needsConfirmation) {
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }
      router.push(res.destination ?? "/consultant/dashboard");
      return;
    }
    setError(res.error ?? "Registration failed");
    setLoading(false);
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <MailCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Check your inbox</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-white">{email}</strong>.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm"
          >
            Go to Sign In <ArrowRight size={15} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 shadow-2xl mb-5">
            <Briefcase size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Join the Consultant Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Instant activation · 90% revenue share
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Field name="fullName" icon={UserIcon} label="Full Name"
            placeholder="Your full name" autoComplete="name" />
          <Field name="email" type="email" icon={Mail} label="Email"
            placeholder="you@example.com" autoComplete="email" />
          <Field name="password" type="password" icon={Lock}
            label="Password (min 12 chars)" placeholder="••••••••••••"
            autoComplete="new-password" minLength={12} />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Creating...</>
            ) : (
              <>Create Consultant Account <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-7">
          Already have a consultant account?{" "}
          <a href="/login" className="text-purple-400 font-bold">Sign in</a>
        </p>

        <p className="text-center text-xs text-slate-500 mt-4 pt-4 border-t border-white/5">
          <Sparkles size={11} className="inline mr-1.5 text-purple-400" />
          Just looking for guidance?{" "}
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL}/register`}
            className="text-purple-400 font-bold"
          >
            Join as a Seeker
          </a>
        </p>
      </motion.div>
    </div>
  );
}

function Field({
  name, icon: Icon, label, placeholder,
  type = "text", autoComplete, minLength,
}: {
  name: string;
  icon: typeof Mail;
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
        {label}
      </label>
      <div className="relative">
        <Icon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          name={name}
          type={type}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500"
        />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <Content />
    </Suspense>
  );
}
EOF

step "apps/admin/actions/register.ts"
write_file "apps/admin/actions/register.ts" << 'EOF'
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  ensureUserRow,
  ensureConsultantRow,
  syncAppMetadata,
} from "@zeal/database/server";

export type RegisterResult =
  | { ok: true; destination?: string; needsConfirmation?: false }
  | { ok: true; needsConfirmation: true }
  | { ok: false; error: string };

export async function registerConsultantAction(
  formData: FormData,
): Promise<RegisterResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email." };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be 12+ chars." };
  }

  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* RSC context */ }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: "consultant" },
      emailRedirectTo: `${adminUrl}/auth/callback`,
    },
  });

  if (error) {
    if (/already|exist/i.test(error.message)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: "Signup failed." };

  // Provision User + Wallet + Consultant (idempotent)
  await ensureUserRow(data.user);
  await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 });
  await syncAppMetadata(data.user.id, "CLIENT_ADMIN", data.user.app_metadata);

  if (!data.session) return { ok: true, needsConfirmation: true };
  return { ok: true, destination: "/consultant/dashboard" };
}
EOF

step "apps/admin/app/auth/callback/route.ts"
write_file "apps/admin/app/auth/callback/route.ts" << 'EOF'
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  ensureUserRow,
  ensureConsultantRow,
  syncAppMetadata,
} from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* RSC context */ }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { role } = await ensureUserRow(data.user);

  if (role === "CLIENT_ADMIN" || data.user.user_metadata?.account_type === "consultant") {
    await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 });
    await syncAppMetadata(data.user.id, "CLIENT_ADMIN", data.user.app_metadata);
    return NextResponse.redirect(`${origin}/consultant/dashboard`);
  }

  if (["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"].includes(role)) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
  return NextResponse.redirect(`${origin}/login?error=not_authorized`);
}
EOF

step "apps/admin/middleware.ts"
write_file "apps/admin/middleware.ts" << 'EOF'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login", "/register", "/auth/callback", "/auth/handoff", "/not-found",
];

const ADMIN_CONSOLE_PREFIXES = [
  "/dashboard", "/users", "/consultants", "/verification", "/bookings",
  "/withdrawals", "/analytics", "/broadcast", "/content", "/ai-consultants",
  "/recordings", "/wallet", "/settings",
];

const CONSULTANT_PREFIX = "/consultant";
const ADMIN_ROLES = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // API proxy: attach bearer token
  if (pathname.startsWith("/api/")) {
    if (user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("Authorization", `Bearer ${session.access_token}`);
        requestHeaders.set("X-Admin-Proxy", "1");
        const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.getAll().forEach((c) => apiResponse.cookies.set(c));
        return apiResponse;
      }
    }
    return response;
  }

  if (isPublic(pathname)) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const role = (user.app_metadata?.role as string) ?? "USER";
  const isAdmin = ADMIN_ROLES.includes(role);
  const isConsultant = role === "CLIENT_ADMIN";

  // Consultant → admin console: bounce to studio
  if (isConsultant && ADMIN_CONSOLE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }
  // Admin → consultant studio: bounce to console
  if (isAdmin && pathname.startsWith(CONSULTANT_PREFIX)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  // Plain USER → bounce to web
  if (!isAdmin && !isConsultant) {
    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — WEB PORTAL
# ═══════════════════════════════════════════════════════════════════════════════
section "PHASE 4 — WEB PORTAL"

step "apps/web/app/apply/page.tsx (redirect)"
write_file "apps/web/app/apply/page.tsx" << 'EOF'
// apps/web/app/apply/page.tsx
// Consultants build their profile on the admin portal.
// Web /apply is a redirect to the consultant studio.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ApplyRedirect() {
  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  redirect(adminUrl ? `${adminUrl}/consultant/dashboard` : "/explore");
}
EOF

step "apps/web/components/auth/RoleRedirectGuard.tsx (new)"
write_file "apps/web/components/auth/RoleRedirectGuard.tsx" << 'EOF'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// RoleRedirectGuard
// - Calls self_heal_user() on mount (backfills Consultant row if missing)
// - Redirects CLIENT_ADMIN users to the admin portal
// - Silent no-op for regular users
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";

export function RoleRedirectGuard() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@zeal/database");
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user || cancelled) return;

        // Self-heal: provision Consultant row + sync role
        try {
          await sb.rpc("self_heal_user");
        } catch (err) {
          console.warn("[RoleRedirectGuard] self_heal_user failed:", err);
        }

        const role = (user.app_metadata?.role as string | undefined) ?? "USER";
        if (role === "CLIENT_ADMIN") {
          const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
          if (adminUrl) {
            window.location.href = `${adminUrl}/consultant/dashboard`;
          }
        }
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
EOF

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — MANUAL PATCH NOTES
# ═══════════════════════════════════════════════════════════════════════════════
section "PHASE 5 — MANUAL PATCH NOTES"

step ".zeal-backup/PATCHES.md"
write_file ".zeal-backup/PATCHES.md" << 'EOF'
# Manual Patches — Auth Rewrite

The setup.sh script writes all files automatically. The patches below
must be applied manually because they modify existing code that may
have user customizations.

────────────────────────────────────────────────────────────────────────────
PATCH 1 — apps/admin/actions/auth.ts (role-aware login destination)
────────────────────────────────────────────────────────────────────────────

Inside `adminLoginAction()`, replace the final block (after
`writeAudit({...})` and before `const destination = resolveDestination(...)`)
with:

```ts
  // Self-heal: ensure Consultant row exists
  if (effectiveRole === "CLIENT_ADMIN") {
    try {
      const { ensureConsultantRow } = await import("@zeal/database/server");
      await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 });
    } catch (err) {
      console.warn("[adminLogin] consultant self-heal failed:", err);
    }
    return { success: true, destination: "/consultant/dashboard" };
  }

  // Admin roles → admin console
  return { success: true, destination: "/dashboard" };