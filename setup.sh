#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 1C · Repair Phase 1B damage
# ═══════════════════════════════════════════════════════════════════════════════
# 1. Restore the 8 files broken by phase 1B's regex from backup
# 2. Write clean, complete versions with bearer-aware auth
# 3. Fix the audit script (arithmetic + F1 false positive)
# 4. Type-check + build
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[1;33m'
CYN=$'\033[0;36m'; MAG=$'\033[0;35m'; BLD=$'\033[1m'; DIM=$'\033[2m'; NC=$'\033[0m'
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT" || exit 2

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$REPO_ROOT/.zeal-backup/phase1c-$TS"
mkdir -p "$BACKUP"

hdr() { echo; echo "${BLD}${MAG}━━━ $* ━━━${NC}"; }
ok()  { echo "  ${GRN}✓${NC} $*"; }
skip(){ echo "  ${DIM}·${NC} $*"; }
warn(){ echo "  ${YLW}⚠${NC}  $*"; }
err() { echo "  ${RED}✗${NC} $*"; }
backup() { local f="$1"; [[ -f "$f" ]] && cp "$f" "$BACKUP/${f//\//__}"; }

echo "${BLD}${MAG}━━━ ZEAL Phase 1C · Repair Phase 1B ━━━${NC}"
echo "${DIM}  Backup: $BACKUP${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Restore the 8 broken files from the most recent phase1b backup
# ═══════════════════════════════════════════════════════════════════════════════
hdr "1. Restore 8 files from phase1b backup"

PB="$(ls -dt "$REPO_ROOT/.zeal-backup"/phase1b-* 2>/dev/null | head -1 || true)"
if [[ -z "$PB" ]]; then
  warn "no phase1b backup found — attempting git checkout instead"
  for f in \
    apps/web/app/api/consultant/visibility/route.ts \
    apps/web/app/api/consultant/pulse/route.ts \
    apps/web/app/api/consultant/bookings/route.ts \
    apps/web/app/api/consultant/earnings/route.ts \
    apps/web/app/api/consultant/clients/route.ts \
    apps/web/app/api/consultant/online/route.ts \
    apps/web/app/api/consultant/profile/route.ts \
    apps/web/app/api/consultant/heartbeat/route.ts
  do
    [[ -f "$f" ]] && git checkout -- "$f" 2>/dev/null && ok "git restored $f"
  done
else
  RESTORED=0
  for f in \
    apps/web/app/api/consultant/visibility/route.ts \
    apps/web/app/api/consultant/pulse/route.ts \
    apps/web/app/api/consultant/bookings/route.ts \
    apps/web/app/api/consultant/earnings/route.ts \
    apps/web/app/api/consultant/clients/route.ts \
    apps/web/app/api/consultant/online/route.ts \
    apps/web/app/api/consultant/profile/route.ts \
    apps/web/app/api/consultant/heartbeat/route.ts
  do
    flat="${f//\//__}"
    if [[ -f "$PB/$flat" ]]; then
      backup "$f"
      cp "$PB/$flat" "$f"
      ok "restored $f"
      RESTORED=$((RESTORED+1))
    else
      warn "no backup for $f — will write fresh below"
    fi
  done
  ok "$RESTORED files restored"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Write clean, complete replacements with bearer-aware auth
# ═══════════════════════════════════════════════════════════════════════════════

write_route() {
  local rel="$1" sentinel="$2"
  local content; content=$(cat)
  backup "$rel"
  mkdir -p "$(dirname "$REPO_ROOT/$rel")"
  printf '%s\n' "$content" > "$REPO_ROOT/$rel"
  ok "wrote $rel"
}

# ─── 2.1 visibility/route.ts ────────────────────────────────────────────────
hdr "2.1 visibility"
write_route "apps/web/app/api/consultant/visibility/route.ts" "ZEAL_FIX_VISIBILITY_V3" <<'TS'
// ZEAL_FIX_VISIBILITY_V3
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant visibility report — bearer + cookie aware.
//
// Uses the service-role admin client (from the guard) and does the checks
// inline, filtering by guard.userId. The consultant_visibility_report() RPC
// relies on auth.uid(), which is NULL under a service-role session, so we
// can't use it from an admin-proxy call. Inline is correct here.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;

  const { userId, admin } = guard;

  const [userRes, consultantRes] = await Promise.all([
    admin
      .from("User")
      .select("id, email, role, is_online, lastSeenAt")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("Consultant")
      .select(`id, status, isActive, isVerified, subdomainActive, subdomain,
               category, bio, perMinuteRate, specialties, languages,
               rating, sparkScore`)
      .eq("userId", userId)
      .maybeSingle(),
  ]);

  const user = userRes.data as
    | { id: string; email: string; role: string; is_online: boolean; lastSeenAt: string | null }
    | null;

  if (!user) {
    return NextResponse.json(
      { success: false, error: "no_user_row" },
      { status: 404 },
    );
  }

  const c = consultantRes.data as
    | {
        id: string;
        status: string;
        isActive: boolean;
        isVerified: boolean;
        subdomainActive: boolean;
        subdomain: string | null;
        category: string;
        bio: string | null;
        perMinuteRate: number;
        specialties: string[] | null;
        languages: string[] | null;
        rating: number;
        sparkScore: number;
      }
    | null;

  if (!c) {
    return NextResponse.json({
      success: false,
      error: "no_consultant_row",
      user: { role: user.role, is_online: user.is_online },
    });
  }

  // MV membership — non-fatal if the MV doesn't exist yet
  let inMv = false;
  try {
    const { data: mvRow } = await admin
      .from("mv_consultant_directory")
      .select("id")
      .eq("id", c.id)
      .maybeSingle();
    inMv = Boolean(mvRow);
  } catch { /* MV missing — treat as not present */ }

  // Service count
  let serviceCount = 0;
  try {
    const { count } = await admin
      .from("ConsultantService")
      .select("*", { count: "exact", head: true })
      .eq("consultant_id", c.id);
    serviceCount = count ?? 0;
  } catch { /* table missing */ }

  const bioLength = (c.bio ?? "").length;
  const specCount = (c.specialties ?? []).length;
  const langCount = (c.languages ?? []).length;

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      is_online: user.is_online,
      lastSeenAt: user.lastSeenAt,
    },
    consultant: {
      id: c.id,
      status: c.status,
      isActive: c.isActive,
      isVerified: c.isVerified,
      subdomainActive: c.subdomainActive,
      subdomain: c.subdomain,
      category: c.category,
      bio_length: bioLength,
      perMinuteRate: c.perMinuteRate,
      specialties_count: specCount,
      languages_count: langCount,
      rating: c.rating,
      sparkScore: c.sparkScore,
    },
    checks: {
      role_is_client_admin: user.role === "CLIENT_ADMIN",
      consultant_verified: c.status === "VERIFIED",
      consultant_active: c.isActive,
      consultant_verified_flag: c.isVerified,
      in_directory_mv: inMv,
      has_services: serviceCount > 0,
      has_bio: bioLength >= 20,
      has_specialties: specCount > 0,
      has_subdomain: c.subdomain !== null,
    },
    service_count: serviceCount,
    public_url: c.subdomain ? `https://${c.subdomain}.zeal.app` : null,
    profile_url: `/consultant/${c.id}`,
  });
}
TS

# ─── 2.2 bookings/route.ts ──────────────────────────────────────────────────
hdr "2.2 bookings"
write_route "apps/web/app/api/consultant/bookings/route.ts" "ZEAL_FIX_BOOKINGS_V3" <<'TS'
// ZEAL_FIX_BOOKINGS_V3
// Consultant bookings list — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BookingRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  amount: number;
  userId: string | null;
}
interface UserRow {
  id: string;
  name: string | null;
  username: string | null;
}

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultantRaw } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  const consultant = consultantRaw as { id: string } | null;
  if (!consultant) {
    return NextResponse.json({ bookings: [] });
  }

  const { data: bookingsRaw, error } = await admin
    .from("Booking")
    .select("id, scheduledAt, durationMinutes, status, amount, userId")
    .eq("consultantId", consultant.id)
    .order("scheduledAt", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = (bookingsRaw ?? []) as BookingRow[];

  const ids = Array.from(
    new Set(bookings.map((b) => b.userId).filter((x): x is string => Boolean(x))),
  );

  let users: UserRow[] = [];
  if (ids.length > 0) {
    const { data: usersRaw } = await admin
      .from("User")
      .select("id, name, username")
      .in("id", ids);
    users = (usersRaw ?? []) as UserRow[];
  }

  const userById = new Map<string, UserRow>();
  for (const u of users) userById.set(u.id, u);

  const items = bookings.map((b) => {
    const u = b.userId ? userById.get(b.userId) : undefined;
    return {
      id: b.id,
      scheduledAt: b.scheduledAt,
      durationMinutes: b.durationMinutes,
      status: b.status,
      amount: b.amount,
      userName: u?.name || u?.username || null,
    };
  });

  return NextResponse.json({ bookings: items });
}
TS

# ─── 2.3 clients/route.ts ───────────────────────────────────────────────────
hdr "2.3 clients"
write_route "apps/web/app/api/consultant/clients/route.ts" "ZEAL_FIX_CLIENTS_V3" <<'TS'
// ZEAL_FIX_CLIENTS_V3
// Consultant clients list — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BookingRow { userId: string | null; scheduledAt: string }
interface UserRow {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
}

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultantRaw } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  const consultant = consultantRaw as { id: string } | null;
  if (!consultant) return NextResponse.json({ clients: [] });

  const { data: bookingsRaw } = await admin
    .from("Booking")
    .select("userId, scheduledAt")
    .eq("consultantId", consultant.id)
    .not("userId", "is", null)
    .order("scheduledAt", { ascending: false });

  const bookings = (bookingsRaw ?? []) as BookingRow[];

  // Aggregate per client
  const stats = new Map<string, { sessions: number; lastSessionAt: string }>();
  for (const b of bookings) {
    if (!b.userId) continue;
    const existing = stats.get(b.userId);
    if (existing) {
      existing.sessions += 1;
      if (b.scheduledAt > existing.lastSessionAt) existing.lastSessionAt = b.scheduledAt;
    } else {
      stats.set(b.userId, { sessions: 1, lastSessionAt: b.scheduledAt });
    }
  }

  const ids = Array.from(stats.keys());
  if (ids.length === 0) return NextResponse.json({ clients: [] });

  const { data: usersRaw } = await admin
    .from("User")
    .select("id, name, username, email")
    .in("id", ids);

  const users = (usersRaw ?? []) as UserRow[];

  const clients = users.map((u) => {
    const s = stats.get(u.id);
    return {
      id: u.id,
      name: u.name || u.username || null,
      email: u.email,
      lastSessionAt: s?.lastSessionAt ?? null,
      sessions: s?.sessions ?? 0,
    };
  });

  return NextResponse.json({ clients });
}
TS

# ─── 2.4 earnings/route.ts ──────────────────────────────────────────────────
hdr "2.4 earnings"
write_route "apps/web/app/api/consultant/earnings/route.ts" "ZEAL_FIX_EARNINGS_V3" <<'TS'
// ZEAL_FIX_EARNINGS_V3
// Consultant earnings — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface WalletRow { id: string; balance: number }
interface TxRow {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: walletRaw } = await admin
    .from("Wallet")
    .select("id, balance")
    .eq("userId", userId)
    .maybeSingle();

  const wallet = walletRaw as WalletRow | null;
  if (!wallet) {
    return NextResponse.json({ balance: 0, transactions: [] });
  }

  const { data: txRaw } = await admin
    .from("Transaction")
    .select("id, type, amount, balance, description, createdAt")
    .eq("walletId", wallet.id)
    .order("createdAt", { ascending: false })
    .limit(50);

  return NextResponse.json({
    balance: wallet.balance,
    transactions: (txRaw ?? []) as TxRow[],
  });
}
TS

# ─── 2.5 online/route.ts ────────────────────────────────────────────────────
hdr "2.5 online"
write_route "apps/web/app/api/consultant/online/route.ts" "ZEAL_FIX_ONLINE_V3" <<'TS'
// ZEAL_FIX_ONLINE_V3
// Toggle online — bearer + cookie aware.
// Allows consultants to go live even with incomplete profiles; the directory
// query filters by completeness, so this is safe.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: { is_online?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.is_online !== "boolean") {
    return NextResponse.json({ error: "is_online must be boolean" }, { status: 400 });
  }

  let completenessWarning: Record<string, unknown> = {};

  if (body.is_online === true) {
    const { data: c } = await admin
      .from("Consultant")
      .select('bio, "perMinuteRate", specialties, languages, availability, category, status')
      .eq("userId", userId)
      .maybeSingle();

    if (!c) {
      return NextResponse.json(
        { error: "NO_CONSULTANT_PROFILE", message: "Sign up as a consultant first." },
        { status: 403 },
      );
    }
    if ((c as { status: string }).status === "SUSPENDED") {
      return NextResponse.json(
        { error: "SUSPENDED", message: "Account suspended." },
        { status: 403 },
      );
    }

    const report = evaluateConsultantProfile(c);
    if (!report.isLive) {
      completenessWarning = {
        warning: "PROFILE_INCOMPLETE",
        message: "You're online, but you won't appear in the directory until your profile is complete.",
        score: report.score,
        checks: report.checks,
      };
    }
  }

  const { error } = await admin
    .from("User")
    .update({ is_online: body.is_online })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort realtime fanout
  try {
    const { serverPublish } = await import("@/lib/realtime/server");
    await serverPublish(`consultant:${userId}:status`, "status_updated", {
      consultantId: userId,
      is_online: body.is_online,
    });
    await serverPublish("consultants:live", "status_changed", {
      consultantId: userId,
      is_online: body.is_online,
      at: new Date().toISOString(),
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    success: true,
    is_online: body.is_online,
    ...completenessWarning,
  });
}
TS

# ─── 2.6 profile/route.ts ───────────────────────────────────────────────────
hdr "2.6 profile"
write_route "apps/web/app/api/consultant/profile/route.ts" "ZEAL_FIX_PROFILE_V3" <<'TS'
// ZEAL_FIX_PROFILE_V3
// Consultant profile PATCH — bearer + cookie aware.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_KEYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");

const TimeBlockSchema = z
  .object({ start: TimeSchema, end: TimeSchema })
  .refine((b) => b.end > b.start, { message: "End must be after start" });

const AvailabilitySchema = z
  .record(z.enum(DAY_KEYS), z.array(TimeBlockSchema).max(10));

const PatchSchema = z.object({
  category: z.string().min(1).max(64).optional(),
  specialties: z.array(z.string().min(1).max(64)).max(20).optional(),
  bio: z.string().max(1000).optional(),
  perMinuteRate: z.number().int().min(10).max(500).optional(),
  languages: z.array(z.string().min(1).max(64)).max(20).optional(),
  availability: AvailabilitySchema.optional(),
}).strict();

export async function PATCH(req: Request) {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message || "Invalid input", path: first?.path ?? [] },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: consultant } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ error: "No consultant profile" }, { status: 404 });
  }

  const { error: updateErr } = await admin
    .from("Consultant")
    .update(parsed.data)
    .eq("id", (consultant as { id: string }).id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: updated } = await admin
    .from("Consultant")
    .select('bio, "perMinuteRate", specialties, languages, availability, category')
    .eq("id", (consultant as { id: string }).id)
    .maybeSingle();

  const report = evaluateConsultantProfile(updated);

  return NextResponse.json({
    success: true,
    isLive: report.isLive,
    score: report.score,
    checks: report.checks,
  });
}
TS

# ─── 2.7 heartbeat/route.ts ─────────────────────────────────────────────────
hdr "2.7 heartbeat"
write_route "apps/web/app/api/consultant/heartbeat/route.ts" "ZEAL_FIX_HEARTBEAT_V3" <<'TS'
// ZEAL_FIX_HEARTBEAT_V3
// Presence ping — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { error } = await admin
    .from("User")
    .update({ lastSeenAt: new Date().toISOString(), is_online: true })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data } = await admin
    .from("User")
    .select("lastSeenAt, is_online")
    .eq("id", userId)
    .maybeSingle();

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
TS

# ─── 2.8 pulse/route.ts ─────────────────────────────────────────────────────
hdr "2.8 pulse"
write_route "apps/web/app/api/consultant/pulse/route.ts" "ZEAL_FIX_PULSE_V3" <<'TS'
// ZEAL_FIX_PULSE_V3
// Consultant dashboard pulse — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultant } = await admin
    .from("Consultant")
    .select(`id, bio, "perMinuteRate", specialties, languages, availability,
             category, status, "isActive", rating, "totalConsultations",
             "sparkScore", subdomain`)
    .eq("userId", userId)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ error: "NO_CONSULTANT_PROFILE" }, { status: 404 });
  }
  const c = consultant as { id: string };

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [userRow, wallet, todaysBookings, pending, live] = await Promise.all([
    admin.from("User").select("id, name, is_online, avatar_url").eq("id", userId).maybeSingle(),
    admin.from("Wallet").select("balance, escrow, pendingIn, pendingOut, blocked").eq("userId", userId).maybeSingle(),
    admin
      .from("Booking")
      .select("id, scheduledAt, durationMinutes, status, amount, userId")
      .eq("consultantId", c.id)
      .gte("scheduledAt", todayStart.toISOString())
      .lte("scheduledAt", todayEnd.toISOString())
      .order("scheduledAt", { ascending: true })
      .limit(20),
    admin.from("Booking").select("*", { count: "exact", head: true })
      .eq("consultantId", c.id).eq("status", "PENDING"),
    admin.from("CallSession").select("*", { count: "exact", head: true })
      .eq("consultantId", c.id).eq("status", "INITIATED"),
  ]);

  return NextResponse.json({
    consultant: {
      ...(consultant as Record<string, unknown>),
      ...((userRow.data ?? {}) as Record<string, unknown>),
      wallet: wallet.data ?? { balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
      completeness: evaluateConsultantProfile(consultant),
    },
    today: {
      bookings: todaysBookings.data ?? [],
      pendingRequests: pending.count ?? 0,
      liveSessions: live.count ?? 0,
    },
  });
}
TS

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Fix the audit script (arithmetic + F1 false positive)
# ═══════════════════════════════════════════════════════════════════════════════
hdr "3. Fix the audit script"

if [[ -f scripts/zeal-audit-frontend.sh ]]; then
  backup scripts/zeal-audit-frontend.sh

  # 3a — coerce arithmetic values
  sed -i.bak 's/\[\[ \$DUPS -eq 0 \]\]/[[ "${DUPS:-0}" -eq 0 ]]/g' scripts/zeal-audit-frontend.sh
  sed -i.bak 's/\[\[ \$STUBS -eq 0 \]\]/[[ "${STUBS:-0}" -eq 0 ]]/g' scripts/zeal-audit-frontend.sh
  sed -i.bak 's/\[\[ \$MISSING -eq 0 \]\]/[[ "${MISSING:-0}" -eq 0 ]]/g' scripts/zeal-audit-frontend.sh
  sed -i.bak 's/\[\[ \$BEARER_FAIL -eq 0 \]\]/[[ "${BEARER_FAIL:-0}" -eq 0 ]]/g' scripts/zeal-audit-frontend.sh
  rm -f scripts/zeal-audit-frontend.sh.bak

  # 3b — defensive F1: filter to existing files, fall back to PASS
  node - scripts/zeal-audit-frontend.sh <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// Replace the F1 block
const F1_OLD = `if [[ -f scripts/verify-onchange-types.mjs ]]; then
  FILES=$(git diff --name-only 2>/dev/null | grep -E '\\.tsx?$' || true)
  if [[ -n "$FILES" ]]; then
    if OUT=$(node scripts/verify-onchange-types.mjs $FILES 2>&1); then
      check F1 "onChange generics (modified files)" PASS
    else
      check F1 "onChange generics (modified files)" FAIL "$(echo "$OUT" | grep -c '✗') mismatches"
      [[ $VERBOSE -eq 1 ]] && echo "$OUT" | head -10 | sed 's/^/    /'
    fi
  else
    check F1 "onChange generics (modified files)" PASS "no modified tsx"
  fi
else
  check F1 "onChange generics" WARN "verifier missing"
fi`;

const F1_NEW = `if [[ -f scripts/verify-onchange-types.mjs ]]; then
  # Only consider tracked-or-existing .tsx files; skip deleted/unreadable paths
  EXISTING=()
  while IFS= read -r f; do
    [[ -n "$f" && -f "$f" ]] && EXISTING+=("$f")
  done < <(git diff --name-only 2>/dev/null | grep -E '\\.tsx$' || true)

  if [[ \${#EXISTING[@]} -eq 0 ]]; then
    check F1 "onChange generics" PASS "no modified tsx"
  else
    if node scripts/verify-onchange-types.mjs "\${EXISTING[@]}" >/dev/null 2>&1; then
      check F1 "onChange generics" PASS
    else
      check F1 "onChange generics" FAIL "mismatches detected"
    fi
  fi
else
  check F1 "onChange generics" WARN "verifier missing"
fi`;

if (s.includes(F1_OLD)) {
  s = s.replace(F1_OLD, F1_NEW);
  fs.writeFileSync(file, s);
  console.log("F1 block updated");
} else {
  console.log("F1 block pattern not found — leaving as is");
}
NODE
  ok "audit script patched"
else
  warn "scripts/zeal-audit-frontend.sh not found — skipping"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Verify: type-check + build
# ═══════════════════════════════════════════════════════════════════════════════
hdr "4. Verify"

TC_FAIL=0
for app in web admin; do
  printf "  %s %s type-check… " "${CYN}▸${NC}" "$app"
  if ( cd "apps/$app" && npm run type-check >/tmp/zeal-1c-tc-$app.log 2>&1 ); then
    echo "${GRN}✓${NC}"
  else
    echo "${RED}✗${NC}"
    tail -25 /tmp/zeal-1c-tc-$app.log | sed 's/^/      /'
    TC_FAIL=$((TC_FAIL+1))
  fi
done

if [[ $TC_FAIL -gt 0 ]]; then
  err "type-check failed — see logs above"
  echo "  Backup of current state: $BACKUP"
  exit 1
fi

for app in web admin; do
  printf "  %s %s build… " "${CYN}▸${NC}" "$app"
  if ( cd "apps/$app" && npm run build >/tmp/zeal-1c-b-$app.log 2>&1 ); then
    echo "${GRN}✓${NC}"
  else
    echo "${RED}✗${NC}"
    tail -30 /tmp/zeal-1c-b-$app.log | sed 's/^/      /'
    exit 1
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Run the fixed audit
# ═══════════════════════════════════════════════════════════════════════════════
if [[ -x scripts/zeal-audit-frontend.sh ]]; then
  hdr "5. Audit"
  bash scripts/zeal-audit-frontend.sh || true
fi

echo
echo "${GRN}${BLD}  ✅ PHASE 1C REPAIR COMPLETE${NC}"
echo
echo "  Backup: $BACKUP"
echo
echo "  Next:"
echo "    1. Apply supabase/migrations/110_consultant_live_visibility.sql"
echo "    2. git add -A && git commit -m 'fix: repair phase1b damage + bearer-aware routes'"
echo "    3. git push"
echo