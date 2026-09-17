cat > fix.sh << 'FIX_END'
#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /d/zeal)" || exit 1

G=$'\033[32m'; R=$'\033[31m'; M=$'\033[35m'; B=$'\033[1m'; N=$'\033[0m'
[[ ! -t 1 ]] && { G=''; R=''; M=''; B=''; N=''; }
OK(){  printf "${G}OK${N}   %s\n" "$1"; }
BAD(){ printf "${R}FAIL${N} %s\n" "$1"; }
FIX(){ printf "${M}FIX${N}  %s\n" "$1"; }
FAILED=0
BK="_archive/zod-fix-$(date +%s)"; mkdir -p "$BK"

TARGET="apps/web/app/api/consultant/profile/route.ts"
[[ -f "$TARGET" ]] && cp "$TARGET" "$BK/profile-route.bak"

# ─── Write enterprise-grade route with Zod v4 compatible schema ───────
cat > "$TARGET" << 'ROUTE_END'
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerClientFromCookies,
  evaluateConsultantProfile,
} from "@zeal/database/server";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const RATE_MIN = 10;
const RATE_MAX = 500;
const BIO_MAX = 1000;
const SPECIALTY_MAX = 20;
const LANG_MAX = 20;
const BLOCKS_PER_DAY_MAX = 10;

// ═══════════════════════════════════════════════════════════════════════
// SCHEMA — Zod v4 (two-arg z.record, exhaustive day keys)
// ═══════════════════════════════════════════════════════════════════════
const DayKeySchema = z.enum(DAY_KEYS);

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");

const TimeBlockSchema = z
  .object({
    start: TimeSchema,
    end: TimeSchema,
  })
  .refine((b) => b.end > b.start, {
    message: "End time must be after start time",
    path: ["end"],
  });

const AvailabilitySchema = z
  .record(DayKeySchema, z.array(TimeBlockSchema).max(BLOCKS_PER_DAY_MAX))
  .superRefine((days, ctx) => {
    for (const [day, blocks] of Object.entries(days)) {
      if (!blocks || blocks.length < 2) continue;
      const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (!prev || !cur) continue;
        if (cur.start < prev.end) {
          ctx.addIssue({
            code: "custom",
            message: `${day}: block ${i + 1} overlaps with block ${i}`,
            path: [day, i],
          });
        }
      }
    }
  });

const PatchSchema = z
  .object({
    category: z.string().min(1).max(64).optional(),
    specialties: z
      .array(z.string().min(1).max(64))
      .max(SPECIALTY_MAX)
      .optional(),
    bio: z.string().max(BIO_MAX).optional(),
    perMinuteRate: z.number().int().min(RATE_MIN).max(RATE_MAX).optional(),
    languages: z.array(z.string().min(1).max(64)).max(LANG_MAX).optional(),
    availability: AvailabilitySchema.optional(),
  })
  .strict();

// ═══════════════════════════════════════════════════════════════════════
// HANDLER — PATCH /api/consultant/profile
// ═══════════════════════════════════════════════════════════════════════
export async function PATCH(req: Request) {
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: first?.message || "Invalid input",
        path: first?.path ?? [],
        issues: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: consultant, error: lookupErr } = await supabase
    .from("Consultant")
    .select("id")
    .eq("userId", user.id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!consultant) {
    return NextResponse.json(
      { error: "No consultant profile" },
      { status: 404 },
    );
  }

  const { error: updateErr } = await supabase
    .from("Consultant")
    .update(patch)
    .eq("id", consultant.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("Consultant")
    .select(
      'bio, "perMinuteRate", specialties, languages, availability, category',
    )
    .eq("id", consultant.id)
    .maybeSingle();

  const report = evaluateConsultantProfile(updated);

  return NextResponse.json({
    success: true,
    isLive: report.isLive,
    score: report.score,
    checks: report.checks,
  });
}
ROUTE_END

[[ -s "$TARGET" ]] \
  && FIX "$TARGET written ($(wc -l < "$TARGET" | tr -d ' ') lines)" \
  || { BAD "$TARGET write failed"; FAILED=1; }

# ─── Sweep for any remaining single-arg z.record( in live code ────────
STALE=$(grep -rn 'z\.record(z\.array\|z\.record(z\.object\|z\.record(z\.string()\.)' \
  apps packages --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v node_modules | grep -v _archive | head -10)
if [[ -n "$STALE" ]]; then
  echo ""
  printf "${M}Note:${N} other single-arg z.record() usages detected:\n"
  echo "$STALE" | sed 's/^/  /'
fi

# ─── Typecheck gate ───────────────────────────────────────────────────
for ws in packages/database apps/web apps/admin; do
  slug=$(echo "$ws" | tr '/' '_')
  log="/tmp/zf-${slug}.log"
  pushd "$ws" >/dev/null 2>&1 || continue
  if npx --no-install tsc --noEmit --pretty false > "$log" 2>&1; then
    OK "$ws clean"
  else
    n=$(grep -c 'error TS' "$log" 2>/dev/null | tr -d '[:space:]'); [[ -z "$n" ]] && n=0
    BAD "$ws — $n errors"
    grep 'error TS' "$log" 2>/dev/null | head -20 | sed 's/^/   /'
    FAILED=1
  fi
  popd >/dev/null 2>&1
done

# ─── Commit if green ──────────────────────────────────────────────────
if [[ $FAILED -eq 0 ]]; then
  git add -A 2>/dev/null
  git reset -- _archive/ .zeal/ 2>/dev/null
  staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d '[:space:]')
  if [[ "${staged:-0}" -gt 0 ]]; then
    git commit -m "Fix Zod v4 z.record + enterprise profile validation

Zod v4 made the key schema mandatory for z.record(), so
z.record(valueSchema) is a compile-time error (TS2554).
Migrated to z.record(keySchema, valueSchema).

Enterprise additions to /api/consultant/profile:
- DayKeySchema (z.enum) — exhaustive day-name keys
- TimeSchema — HH:MM 24-hour regex validation
- TimeBlockSchema — end-after-start refine per block
- AvailabilitySchema — overlap detection across blocks per day
- Block count cap (10/day), rate bounds (₹10–500),
  bio cap (1000), specialty/lang caps (20 each)
- .strict() — rejects unknown keys
- 422 responses carry path + issues array for client debugging
- Explicit no-op guard (empty patch → 400)" >/dev/null 2>&1 \
      && OK "committed $(git rev-parse --short HEAD)" \
      && git push origin main >/dev/null 2>&1 \
      && OK "pushed origin/main"
  else
    OK "nothing to commit (already clean)"
  fi
else
  BAD "typecheck failed — not committing"
fi
FIX_END

chmod +x fix.sh && ./fix.sh