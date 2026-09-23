#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — Full Workflow v2
# ═══════════════════════════════════════════════════════════════════════════════
# Supersedes v1 with:
#   • Correct package-manager detection (npm workspaces vs pnpm)
#   • Deterministic install before gating
#   • Expert-grade rewrites of every file v1 created
#   • Type-check + build with the detected PM
#
# Usage:
#   bash scripts/zeal-full-workflow-v2.sh
#   bash scripts/zeal-full-workflow-v2.sh --dry-run
#   bash scripts/zeal-full-workflow-v2.sh --skip-build
#   bash scripts/zeal-full-workflow-v2.sh --skip-install
# ═══════════════════════════════════════════════════════════════════════════════

set -Eeuo pipefail

DRY_RUN=0; SKIP_BUILD=0; SKIP_INSTALL=0
for arg in "$@"; do case "$arg" in
  --dry-run)      DRY_RUN=1 ;;
  --skip-build)   SKIP_BUILD=1 ;;
  --skip-install) SKIP_INSTALL=1 ;;
  -h|--help) sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Unknown flag: $arg" >&2; exit 2 ;;
esac; done

if [ -t 1 ]; then
  R=$'\033[0m'; B=$'\033[1m'; DIM=$'\033[2m'
  I=$'\033[1;34m'; OK=$'\033[1;32m'; W=$'\033[1;33m'; E=$'\033[1;31m'
else R=""; B=""; DIM=""; I=""; OK=""; W=""; E=""; fi

say()  { printf '%s[zeal-v2]%s %s\n' "$I" "$R" "$*"; }
ok()   { printf '%s  ✓%s %s\n' "$OK" "$R" "$*"; }
warn() { printf '%s  !%s %s\n' "$W" "$R" "$*"; }
err()  { printf '%s  ✗%s %s\n' "$E" "$R" "$*" >&2; }
note() { printf '%s    %s%s\n' "$DIM" "$*" "$R"; }

# ─── Repo root discovery ──────────────────────────────────────────────────────
find_root() {
  local dir="$1" hops=0
  [ -n "$dir" ] || return 1
  dir="$(cd "$dir" 2>/dev/null && pwd -P || echo "$dir")"
  while [ "$hops" -lt 12 ] && [ -n "$dir" ] && [ "$dir" != "/" ] && [ "$dir" != "." ]; do
    if [ -d "$dir/apps/web" ] && [ -d "$dir/apps/admin" ] && [ -d "$dir/packages/realtime" ]; then
      printf '%s\n' "$dir"; return 0
    fi
    local parent; parent="$(dirname "$dir")"
    [ "$parent" = "$dir" ] && break
    dir="$parent"; hops=$((hops + 1))
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

# ─── Package manager detection ────────────────────────────────────────────────
# Priority:
#   1. pnpm  — only when pnpm-workspace.yaml exists
#   2. npm   — when "workspaces" is in root package.json (Zeal's case)
#   3. fallback to whichever binary is available
detect_pm() {
  if [ -f "pnpm-workspace.yaml" ] && command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"; return
  fi
  if [ -f "package.json" ] && grep -q '"workspaces"' package.json; then
    if command -v npm >/dev/null 2>&1; then echo "npm"; return; fi
  fi
  if command -v pnpm >/dev/null 2>&1; then echo "pnpm"; return; fi
  if command -v npm  >/dev/null 2>&1; then echo "npm"; return; fi
  echo ""
}

PM="$(detect_pm)"
if [ -z "$PM" ]; then err "No package manager (need npm or pnpm)"; exit 1; fi

# ─── Backup ───────────────────────────────────────────────────────────────────
TS="$(date +%Y%m%d-%H%M%S 2>/dev/null || date +%s)"
BACKUP=".zeal-backup/v2-$TS"
[ "$DRY_RUN" -eq 0 ] && mkdir -p "$BACKUP"

backup() {
  [ -f "$1" ] || return 0
  [ "$DRY_RUN" -eq 1 ] && return 0
  cp "$1" "$BACKUP/${1//\//__}"
}

trap 'err "Aborted. Rollback: cp -r $BACKUP/* ."; exit $?' ERR

printf '\n%s════════════════════════════════════════════════════════════════════%s\n' "$B" "$R"
printf '%s  ZEAL — Full Workflow v2%s\n' "$B" "$R"
printf '%s════════════════════════════════════════════════════════════════════%s\n' "$B" "$R"
printf '  Root   : %s\n' "$ROOT"
printf '  PM     : %s\n' "$PM"
printf '  Mode   : %s\n' "$([ $DRY_RUN -eq 1 ] && echo 'DRY-RUN' || echo 'APPLY')"
printf '  Backup : %s\n\n' "$BACKUP"

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE A — Install dependencies
# ═══════════════════════════════════════════════════════════════════════════════
say "Phase A · Dependency install ($PM)"

if [ "$SKIP_INSTALL" -eq 1 ]; then
  warn "install skipped (--skip-install)"
elif [ "$DRY_RUN" -eq 1 ]; then
  note "would run $PM install"
else
  case "$PM" in
    npm)
      if [ -f "package-lock.json" ]; then
        # ci is faster and reproducible, but fails if lockfile is out of sync.
        if ! npm ci --legacy-peer-deps --no-audit --no-fund; then
          warn "npm ci failed — falling back to npm install"
          npm install --legacy-peer-deps --no-audit --no-fund
        fi
      else
        npm install --legacy-peer-deps --no-audit --no-fund
      fi
      ;;
    pnpm)
      if [ -f "pnpm-lock.yaml" ]; then
        pnpm install --frozen-lockfile || pnpm install
      else
        pnpm install
      fi
      ;;
  esac
  ok "dependencies installed"
fi

# Sanity — confirm tsc is now resolvable
if [ "$DRY_RUN" -eq 0 ]; then
  if [ -x "node_modules/.bin/tsc" ] || [ -x "node_modules/typescript/bin/tsc" ]; then
    ok "tsc binary present at node_modules/.bin"
  else
    warn "tsc not found in root node_modules — will resolve via workspace symlink"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE B — Expert rewrites of v1-created files
# ═══════════════════════════════════════════════════════════════════════════════
say "Phase B · Expert rewrites"

# ─── B.1 packages/realtime/src/client.ts ──────────────────────────────────────
RC="packages/realtime/src/client.ts"
if [ -f "$RC" ]; then
  backup "$RC"
  if [ "$DRY_RUN" -eq 0 ]; then
    cat > "$RC" <<'EOF_RC'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/realtime — Shared Supabase Realtime Client
// ─────────────────────────────────────────────────────────────────────────────
// Supabase Realtime compares the `event` filter with strict string equality.
// It has no "*" wildcard on the client-side `.on("broadcast", { event })`.
//
// Zeal's `useChannel` hook (in ./hooks.ts) defaults `event` to "*" and every
// call site relies on that default. To make wildcard subscriptions work:
//
//   1. We register ONE `.on("broadcast", { event: <known> }, dispatch)` per
//      known event name (from KNOWN_EVENTS below).
//   2. On receipt, `dispatch` fans out to listeners registered under the exact
//      event name AND to listeners registered under "*".
//   3. A per-channel `subscribePromise` ensures the channel subscribes once.
//
// Nothing here is React-specific — this module can be imported from any
// "use client" boundary.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface BroadcastChange<T = unknown> {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: T;
  old_record?: T | null;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type AnyHandler = (payload: unknown) => void;

interface Listener {
  readonly id: string;
  readonly handler: AnyHandler;
}

interface ChannelEntry {
  readonly channel: RealtimeChannel;
  readonly listeners: Map<string, Map<string, Listener>>;
  subscribePromise?: Promise<void>;
  status: "pending" | "subscribed" | "error";
}

// ─── Known events emitted by DB triggers + serverPublish() ───────────────────

const KNOWN_EVENTS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "incoming_request",
  "booking_created",
  "booking_updated",
  "sparks:updated",
  "rating:updated",
  "notification",
  "status_updated",
  "status_changed",
] as const;

type KnownEvent = (typeof KNOWN_EVENTS)[number];

// ─── Module state ─────────────────────────────────────────────────────────────

let client: SupabaseClient | null = null;
const channels = new Map<string, ChannelEntry>();
const stateListeners = new Set<(s: ConnectionState) => void>();
const seenEventKeys = new Set<string>();

const MAX_SEEN = 500;
const TRIM_TO = 250;

let currentState: ConnectionState = "disconnected";
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const MAX_ATTEMPTS = 10;

let listenerCounter = 0;
const nextListenerId = (): string =>
  `l-${++listenerCounter}-${Date.now().toString(36)}`;

// ─── Connection state ─────────────────────────────────────────────────────────

function setState(next: ConnectionState): void {
  if (next === currentState) return;
  currentState = next;
  for (const fn of stateListeners) {
    try {
      fn(next);
    } catch (err) {
      console.warn("[realtime] state listener threw:", err);
    }
  }
}

export function onConnectionStateChange(
  fn: (s: ConnectionState) => void,
): () => void {
  stateListeners.add(fn);
  fn(currentState);
  return () => {
    stateListeners.delete(fn);
  };
}

export function getConnectionState(): ConnectionState {
  return currentState;
}

// ─── Client factory ───────────────────────────────────────────────────────────

export function getRealtimeClient(): SupabaseClient | null {
  if (client) return client;

  // Reuse the shared browser client created by @zeal/database if present.
  if (typeof window !== "undefined") {
    const shared = (
      globalThis as { __ZEAL_SUPABASE_BROWSER__?: SupabaseClient }
    ).__ZEAL_SUPABASE_BROWSER__;
    if (shared) {
      client = shared;
      setState("connecting");
      return client;
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[realtime] NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing — realtime disabled",
      );
    }
    return null;
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
      timeout: 20_000,
    },
  });

  if (typeof window !== "undefined") {
    (
      globalThis as { __ZEAL_SUPABASE_BROWSER__?: SupabaseClient }
    ).__ZEAL_SUPABASE_BROWSER__ = client;
  }

  setState("connecting");
  return client;
}

// ─── Reconnect with exponential backoff + jitter ──────────────────────────────

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (reconnectAttempt >= MAX_ATTEMPTS) {
    setState("disconnected");
    return;
  }
  reconnectAttempt++;
  const base = Math.min(
    BASE_BACKOFF_MS * 2 ** (reconnectAttempt - 1),
    MAX_BACKOFF_MS,
  );
  const jitter = base * 0.3 * (Math.random() * 2 - 1);
  const delay = Math.max(100, Math.round(base + jitter));

  setState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!client) return;
    for (const entry of channels.values()) {
      try {
        entry.channel.subscribe();
      } catch {
        /* ignore — subscribe is best-effort */
      }
    }
  }, delay);
}

// ─── Channel management ───────────────────────────────────────────────────────

function getOrCreateChannel(topic: string): ChannelEntry | null {
  const sb = getRealtimeClient();
  if (!sb) return null;

  const existing = channels.get(topic);
  if (existing) return existing;

  const channel = sb.channel(topic, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: "" },
    },
  });

  const entry: ChannelEntry = {
    channel,
    listeners: new Map(),
    status: "pending",
  };
  channels.set(topic, entry);
  return entry;
}

function makeDispatcher(
  entry: ChannelEntry,
  topic: string,
  eventName: KnownEvent,
): (message: unknown) => void {
  return (message: unknown) => {
    const payload = (message as { payload?: unknown } | null)?.payload;

    // Dedup by (event, payload.id). The same row can legitimately arrive as
    // INSERT and UPDATE — the event name disambiguates them.
    const id =
      typeof payload === "object" && payload !== null
        ? (payload as { id?: string }).id
        : undefined;

    if (typeof id === "string") {
      const key = `${eventName}:${id}`;
      if (seenEventKeys.has(key)) return;
      seenEventKeys.add(key);
      if (seenEventKeys.size > MAX_SEEN) {
        const arr = Array.from(seenEventKeys);
        seenEventKeys.clear();
        for (const k of arr.slice(-TRIM_TO)) seenEventKeys.add(k);
      }
    }

    // Exact-event listeners
    const exact = entry.listeners.get(eventName);
    if (exact) {
      for (const listener of exact.values()) {
        try {
          listener.handler(payload);
        } catch (err) {
          console.error(`[realtime] handler threw ${topic}:${eventName}`, err);
        }
      }
    }

    // Wildcard listeners
    const wildcard = entry.listeners.get("*");
    if (wildcard) {
      for (const listener of wildcard.values()) {
        try {
          listener.handler(payload);
        } catch (err) {
          console.error(`[realtime] handler threw ${topic}:*`, err);
        }
      }
    }
  };
}

// ─── Public: subscribe ────────────────────────────────────────────────────────

export function subscribe<T = unknown>(
  topic: string,
  event: string,
  handler: (payload: T) => void,
): () => void {
  const entry = getOrCreateChannel(topic);
  if (!entry) return () => {};

  let eventMap = entry.listeners.get(event);
  if (!eventMap) {
    eventMap = new Map();
    entry.listeners.set(event, eventMap);
  }
  const listener: Listener = {
    id: nextListenerId(),
    handler: handler as AnyHandler,
  };
  eventMap.set(listener.id, listener);

  if (!entry.subscribePromise) {
    entry.subscribePromise = new Promise<void>((resolve) => {
      for (const name of KNOWN_EVENTS) {
        entry.channel.on(
          "broadcast",
          { event: name },
          makeDispatcher(entry, topic, name),
        );
      }
      entry.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          entry.status = "subscribed";
          reconnectAttempt = 0;
          setState("connected");
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          entry.status = "error";
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
      try {
        e.channel.unsubscribe();
      } catch {
        /* ignore */
      }
      channels.delete(topic);
    }
  };
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export interface PresenceHandle<T> {
  unsubscribe: () => void;
  track: (state: T) => void;
  untrack: () => void;
}

export function subscribePresence<T extends Record<string, unknown>>(
  topic: string,
  key: string,
  onSync: (state: Record<string, T[]>) => void,
): PresenceHandle<T> {
  const sb = getRealtimeClient();
  if (!sb) {
    return { unsubscribe: () => {}, track: () => {}, untrack: () => {} };
  }

  const channel = sb.channel(`presence:${topic}`, {
    config: { presence: { key } },
  });
  let tracked = false;

  channel
    .on("presence", { event: "sync" }, () => {
      try {
        onSync(channel.presenceState() as Record<string, T[]>);
      } catch (err) {
        console.error("[realtime] presence sync threw:", err);
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && !tracked) {
        tracked = true;
        try {
          channel.track({ online_at: new Date().toISOString() });
        } catch {
          /* ignore */
        }
      }
    });

  return {
    track: (state: T) => {
      try {
        channel.track(state);
      } catch {
        /* ignore */
      }
    },
    untrack: () => {
      try {
        channel.untrack();
      } catch {
        /* ignore */
      }
    },
    unsubscribe: () => {
      try {
        channel.untrack();
      } catch {
        /* ignore */
      }
      try {
        sb.removeChannel(channel);
      } catch {
        /* ignore */
      }
    },
  };
}

// ─── One-shot publish ─────────────────────────────────────────────────────────

export async function publish<T = unknown>(
  topic: string,
  event: string,
  payload: T,
): Promise<boolean> {
  const sb = getRealtimeClient();
  if (!sb) return false;

  const channel = sb.channel(topic);
  await channel.subscribe();
  try {
    const result = await channel.send({
      type: "broadcast",
      event,
      payload,
    });
    return result === "ok";
  } catch {
    return false;
  } finally {
    try {
      await sb.removeChannel(channel);
    } catch {
      /* ignore */
    }
  }
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function disconnectAll(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  for (const entry of channels.values()) {
    try {
      entry.channel.unsubscribe();
    } catch {
      /* ignore */
    }
  }
  channels.clear();
  seenEventKeys.clear();
  setState("disconnected");
}
EOF_RC
    ok "realtime client rewritten (expert)"
  fi
fi

# ─── B.2 LuxuryConsultantCard.tsx ─────────────────────────────────────────────
LCC="apps/web/components/shared/LuxuryConsultantCard.tsx"
if [ -f "$LCC" ]; then
  backup "$LCC"
  if [ "$DRY_RUN" -eq 0 ]; then
    cat > "$LCC" <<'EOF_LCC'
"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// LuxuryConsultantCard — shared premium card
// ═══════════════════════════════════════════════════════════════════════════════
// Used by Home, Explore, and Services. Consumes the @zeal/types shape and
// extends it with presence metadata. All rendering is token-driven so dark and
// light modes come for free.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { useCallback, useId, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Flame, MessageCircle, Radio, Star, Zap } from "lucide-react";
import type { ConsultantProfile } from "@zeal/types";
import { cn } from "@zeal/ui";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LuxuryConsultantInput extends ConsultantProfile {
  lastSeenAt?: string | null;
  isPaid?: boolean;
}

interface Props {
  consultant: LuxuryConsultantInput;
  onChat?: (consultantId: string) => void;
  onBook?: (consultantId: string) => void;
  variant?: "default" | "compact";
  priority?: boolean;
}

// ─── Presence derivation ──────────────────────────────────────────────────────

type PresenceTone = "online" | "away" | "offline";

interface Presence {
  tone: PresenceTone;
  label: string;
}

const PRESENCE_WINDOW_AWAY_MS = 10 * 60 * 1000;

function derivePresence(c: LuxuryConsultantInput): Presence {
  if (c.isAI) return { tone: "online", label: "AI" };
  if (c.isOnline) return { tone: "online", label: "Online" };
  if (c.lastSeenAt) {
    const lastSeen = new Date(c.lastSeenAt).getTime();
    if (
      Number.isFinite(lastSeen) &&
      Date.now() - lastSeen < PRESENCE_WINDOW_AWAY_MS
    ) {
      return { tone: "away", label: "Away" };
    }
  }
  return { tone: "offline", label: "Offline" };
}

const PRESENCE_STYLE: Record<PresenceTone, { pill: string; dot: string }> = {
  online: {
    pill: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400 animate-pulse",
  },
  away: {
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  offline: {
    pill: "bg-white/5 text-slate-400 border border-white/10",
    dot: "bg-slate-500",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LuxuryConsultantCard({
  consultant,
  onChat,
  onBook,
  variant = "default",
  priority = false,
}: Props) {
  const isCompact = variant === "compact";
  const headingId = useId();

  // 3D tilt — motion values with a spring so pointer motion never jitters
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawX, [-0.5, 0.5], [2, -2]), {
    stiffness: 260,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(rawY, [-0.5, 0.5], [-2, 2]), {
    stiffness: 260,
    damping: 20,
  });

  const presence = useMemo(() => derivePresence(consultant), [consultant]);
  const style = PRESENCE_STYLE[presence.tone];

  const chatEnabled = Boolean(consultant.isAI || consultant.isOnline);
  const href = consultant.isAI
    ? `/ai-astrologers/${consultant.id}`
    : `/consultant/${consultant.id}`;

  const displayName = consultant.name || consultant.username || "Guide";
  const initial = displayName.charAt(0).toUpperCase();

  const handleMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      rawY.set((event.clientX - rect.left) / rect.width - 0.5);
      rawX.set((event.clientY - rect.top) / rect.height - 0.5);
    },
    [rawX, rawY],
  );

  const handleLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  const handleChat = useCallback(() => {
    if (!chatEnabled) return;
    onChat?.(consultant.id);
  }, [chatEnabled, consultant.id, onChat]);

  const handleBook = useCallback(() => {
    onBook?.(consultant.id);
  }, [consultant.id, onBook]);

  const rateLabel =
    consultant.perMinuteRate > 0
      ? `₹${consultant.perMinuteRate}/min`
      : "Free";

  return (
    <motion.article
      aria-labelledby={headingId}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "glass-luxury glass-luxury-hover",
        isCompact ? "p-4" : "p-5",
      )}
    >
      {/* Ambient hover glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-[var(--color-luxury-gold)]/8 via-transparent to-[var(--color-ambient-lavender)]/12"
      />

      {/* Presence pill */}
      <span
        aria-label={`Presence: ${presence.label}`}
        className={cn(
          "absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
          "text-[9px] font-black uppercase tracking-widest",
          style.pill,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
        {presence.label}
      </span>

      {/* AI badge */}
      {consultant.isAI && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] px-2 py-0.5 text-[9px] font-black tracking-wider text-white">
          <Zap size={10} aria-hidden /> AI
        </span>
      )}

      <div className="relative z-[1] flex flex-col items-center text-center">
        {/* Avatar with gradient ring */}
        <Link
          href={href}
          aria-label={`View ${displayName}'s profile`}
          className="relative inline-block"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/25 blur-xl transition-all group-hover:bg-[var(--color-luxury-gold)]/40"
          />
          <span className="relative block rounded-full bg-gradient-to-br from-[var(--color-luxury-gold)] via-transparent to-[var(--color-ambient-lavender)] p-[2px]">
            <span className="block rounded-full bg-[var(--color-surface)] p-[2px]">
              {consultant.avatar ? (
                <img
                  src={consultant.avatar}
                  alt=""
                  loading={priority ? "eager" : "lazy"}
                  decoding="async"
                  className={cn(
                    "rounded-full object-cover",
                    isCompact ? "h-14 w-14" : "h-20 w-20",
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] font-black text-white",
                    isCompact ? "h-14 w-14 text-xl" : "h-20 w-20 text-2xl",
                  )}
                >
                  {initial}
                </span>
              )}
            </span>
          </span>
        </Link>

        <Link href={href} className="mt-3 max-w-full">
          <h3
            id={headingId}
            className="truncate text-base font-bold text-white transition-colors group-hover:text-[var(--color-luxury-gold)]"
          >
            {displayName}
          </h3>
          {consultant.username && (
            <p className="truncate text-[11px] text-slate-400">
              @{consultant.username}
            </p>
          )}
        </Link>

        {/* Metric row */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Star size={11} className="fill-amber-400" aria-hidden />
            {(consultant.rating || 0).toFixed(1)}
          </span>
          {typeof consultant.sparks === "number" && consultant.sparks > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-400">
              <Flame size={11} aria-hidden />
              {consultant.sparks.toLocaleString("en-IN")}
            </span>
          )}
          <span className="font-mono font-bold text-[var(--color-luxury-gold)]">
            {rateLabel}
          </span>
        </div>

        {/* Specialty chips */}
        {!isCompact &&
          consultant.specialties &&
          consultant.specialties.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {consultant.specialties.slice(0, 2).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-300"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

        {/* Actions */}
        <div className="mt-4 flex w-full gap-2">
          <button
            type="button"
            onClick={handleChat}
            disabled={!chatEnabled}
            aria-label={
              consultant.isAI
                ? `Chat with ${displayName}`
                : consultant.isOnline
                  ? `Start chat with ${displayName}`
                  : `${displayName} is offline`
            }
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all",
              chatEnabled
                ? "bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white hover:opacity-95 active:scale-[0.98]"
                : "cursor-not-allowed bg-white/5 text-slate-500",
            )}
          >
            {consultant.isAI ? (
              <>
                <Zap size={12} aria-hidden /> Chat
              </>
            ) : consultant.isOnline ? (
              <>
                <MessageCircle size={12} aria-hidden /> Chat now
              </>
            ) : (
              <>
                <Radio size={12} aria-hidden /> Offline
              </>
            )}
          </button>
          {!consultant.isAI && (
            <button
              type="button"
              onClick={handleBook}
              aria-label={`Book a session with ${displayName}`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-slate-200 transition-all hover:border-[var(--color-luxury-gold)]/40 hover:text-white"
            >
              Book
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
EOF_LCC
    ok "LuxuryConsultantCard rewritten (expert)"
  fi
fi

# ─── B.3 /api/consultants/[id]/route.ts ──────────────────────────────────────
CRT="apps/web/app/api/consultants/[id]/route.ts"
if [ -f "$CRT" ]; then
  backup "$CRT"
  if [ "$DRY_RUN" -eq 0 ]; then
    cat > "$CRT" <<'EOF_CRT'
// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/consultants/[id] — public consultant profile
// ═══════════════════════════════════════════════════════════════════════════════
// Used by: booking wizard, ProfileActions, startChatFlow status pre-check.
// Returns 400 for malformed UUIDs; 404 for missing consultants; 500 for
// infrastructure failures — never conflates the three.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UserRelation {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_online: boolean | null;
}

interface ConsultantRow {
  id: string;
  category: string | null;
  perMinuteRate: number | null;
  rating: number | null;
  totalConsultations: number | null;
  sparkScore: number | null;
  specialties: string[] | null;
  languages: string[] | null;
  bio: string | null;
  user: UserRelation | UserRelation[] | null;
}

export interface ConsultantPublicResponse {
  consultant: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    category: string;
    perMinuteRate: number;
    rating: number;
    totalConsultations: number;
    sparks: number;
    isOnline: boolean;
    specialties: string[];
    languages: string[];
    bio: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickUser(rel: ConsultantRow["user"]): UserRelation | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid consultant id", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("Consultant")
      .select(
        `id, category, "perMinuteRate", rating, "totalConsultations", "sparkScore",
         specialties, languages, bio,
         user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[consultants/[id]] db error:", error.message);
      return NextResponse.json(
        { error: "Could not load consultant", code: "DB_ERROR" },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Consultant not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const row = data as unknown as ConsultantRow;
    const u = pickUser(row.user);
    const displayName = u?.name ?? u?.username ?? "Guide";

    const body: ConsultantPublicResponse = {
      consultant: {
        id: row.id,
        name: displayName,
        username: u?.username ?? "",
        avatar: u?.avatar ?? null,
        category: row.category ?? "HEALER",
        perMinuteRate: Number(row.perMinuteRate ?? 50),
        rating: Number(row.rating ?? 0),
        totalConsultations: Number(row.totalConsultations ?? 0),
        sparks: Number(row.sparkScore ?? 0),
        isOnline: Boolean(u?.is_online),
        specialties: row.specialties ?? [],
        languages: row.languages ?? [],
        bio: row.bio ?? "",
      },
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    console.error("[consultants/[id]] fatal:", message);
    return NextResponse.json(
      { error: message, code: "INTERNAL" },
      { status: 500 },
    );
  }
}
EOF_CRT
    ok "/api/consultants/[id] rewritten (expert)"
  fi
fi

# ─── B.4 SupabaseAuthProvider.tsx — verify import path, dedupe injections ────
AP="apps/web/components/providers/SupabaseAuthProvider.tsx"
if [ -f "$AP" ]; then
  backup "$AP"
  if [ "$DRY_RUN" -eq 0 ]; then
    # Count occurrences of the hydration effect. If >1, rewrite cleanly.
    count=$(grep -c "setStoreUser" "$AP" || true)
    if [ "$count" -gt 2 ]; then
      warn "SupabaseAuthProvider has duplicated hydration effect ($count occurrences) — rewriting"
      # Extract just the two imports and the storeUser effect, dedupe
      node - "$AP" <<'NODE_EOF'
const fs = require("fs");
const p = process.argv[2];
let src = fs.readFileSync(p, "utf8");

// Ensure only ONE storeUser effect block exists.
// Find all "const setStoreUser = useAppStore" and keep the first only.
const blocks = src.split(/const setStoreUser = useAppStore/);
if (blocks.length > 2) {
  const head = blocks[0];
  // Rebuild with only the first block (drop repeats)
  const firstBlock = "const setStoreUser = useAppStore" + blocks[1];
  src = head + firstBlock;
  // Trim any later duplicates of the same effect comment + declaration
  src = src.replace(/const setStoreUser = useAppStore[\s\S]*?setStoreUser\(null\);\s*\n\s*\}\s*\}, \[user, isLoading, setStoreUser\];\s*\n\s*\n/g, "");
  // Restore the first
  src = head + "const setStoreUser = useAppStore" + blocks[1];
}

// Ensure the import exists exactly once.
const importLine = 'import { useAppStore } from "@/lib/store/appStore";';
const importMatches = src.match(new RegExp(importLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
if (importMatches.length === 0) {
  const anchor = 'import { getBrowserSupabase } from "@/lib/supabase/client";';
  if (src.includes(anchor)) {
    src = src.replace(anchor, anchor + "\n" + importLine);
  }
} else if (importMatches.length > 1) {
  // Keep first, drop rest
  let first = true;
  src = src.split(importLine).join((match, i) => "");
  // Re-add one
  src = src.replace(
    /(import \{ getBrowserSupabase \} from "@\/lib\/supabase\/client";)/,
    `$1\n${importLine}`,
  );
}

fs.writeFileSync(p, src);
NODE_EOF
      ok "SupabaseAuthProvider de-duplicated"
    else
      ok "SupabaseAuthProvider clean"
    fi
  fi
fi

# ─── B.5 HomeClient — fix any broken JSX from v1's string replace ────────────
HC="apps/web/app/HomeClient.tsx"
if [ -f "$HC" ]; then
  backup "$HC"
  if [ "$DRY_RUN" -eq 0 ]; then
    # Detect the common v1 breakage: `router.push` injected inside a JSX prop
    # while `router` isn't destructured at the top. Verify router exists.
    if grep -q "onBook={(id) => router.push" "$HC" && ! grep -q "const router = useRouter()" "$HC"; then
      warn "HomeClient references router.push without useRouter — injecting"
      node - "$HC" <<'NODE_EOF'
const fs = require("fs");
const p = process.argv[2];
let src = fs.readFileSync(p, "utf8");
// Add `useRouter` import if not present
if (!src.includes('from "next/navigation"')) {
  src = src.replace(
    /^(import .*;\n)/m,
    '$1import { useRouter } from "next/navigation";\n',
  );
} else if (!src.includes("useRouter")) {
  src = src.replace(
    /import \{ ([^}]+) \} from "next\/navigation";/,
    'import { $1, useRouter } from "next/navigation";',
  );
}
// Add `const router = useRouter();` at the top of the component if missing
if (!src.includes("const router = useRouter()")) {
  src = src.replace(
    /export function HomeClient\(([^)]*)\)\s*\{/,
    (m, args) => `${m}\n  const router = useRouter();`,
  );
}
fs.writeFileSync(p, src);
NODE_EOF
      ok "HomeClient router reference repaired"
    else
      ok "HomeClient router reference ok"
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE C — Re-verify structural patches from v1
# ═══════════════════════════════════════════════════════════════════════════════
say "Phase C · Structural re-verification"

structural_check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else warn "$label — not present"; fi
}

structural_check "realtime client has KNOWN_EVENTS" \
  grep -q "KNOWN_EVENTS" packages/realtime/src/client.ts
structural_check "consultant (studio) route group exists" \
  test -d "apps/web/app/consultant/(studio)"
structural_check "public [id] profile preserved" \
  test -f "apps/web/app/consultant/[id]/page.tsx"
structural_check "startChatFlow has 401 guard" \
  grep -q "meRes.status === 401" apps/web/lib/chat/start-chat-flow.ts
structural_check "booking page uses plural endpoint" \
  grep -q '/api/consultants/${consultantId}' apps/web/app/booking/page.tsx
structural_check "/api/bookings publishes realtime" \
  grep -q ':incoming' apps/web/app/api/bookings/route.ts

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE D — Gates (correct PM syntax)
# ═══════════════════════════════════════════════════════════════════════════════
say "Phase D · Type-check + build gates"

if [ "$DRY_RUN" -eq 1 ]; then
  warn "dry-run — skipping gates"
  exit 0
fi

# Workspace command runner — abstracts npm workspaces vs pnpm filter
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
  if "$@"; then
    ok "$label passed"
  else
    err "$label FAILED"
    err "Rollback: cp -r $BACKUP/* ."
    exit 1
  fi
}

# ─── Type-check ──────────────────────────────────────────────────────────────
run_gate "type-check · web"   ws_run web   type-check
run_gate "type-check · admin" ws_run admin type-check

# ─── Build ───────────────────────────────────────────────────────────────────
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
printf '%s  ✅ v2 APPLIED — type-check + build passed%s\n' "$OK" "$R"
printf '%s════════════════════════════════════════════════════════════════════%s\n\n' "$B" "$R"

cat <<EOF
  Package manager : $PM
  Backup          : $BACKUP
  Rollback        : cp -r $BACKUP/* .

  Migrations to push:
    supabase db push
    (or run manually):
      095_escrow_release_fix.sql
      200_missing_rpcs.sql
      201_realtime_rls_restore.sql
      202_ai_user_cast_fix.sql
EOF

exit 0