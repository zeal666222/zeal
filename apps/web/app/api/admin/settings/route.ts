// ═══════════════════════════════════════════════════════════════════════════════
// GET / PUT /api/admin/settings — platform defaults, backed by AdminSetting
// ───────────────────────────────────────────────────────────────────────────────
// Every value returned here is read from the database, and every value written
// here is honoured by the code that spends money:
//   platformFeePercent      → stamped as Booking."platformFeeRate" at creation
//                             (/api/billing/instamojo), which is what the settle
//                             RPC later reads. Existing bookings keep the rate
//                             they were created with.
//   minimumWithdrawalRupees → enforced on /api/consultant-portal/withdraw.
// Anything else belongs in the database, not here — see the migration header.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { serverPublish } from "@/lib/realtime/server";
import { sendAdminBus } from "@/lib/realtime/admin-bus";
import {
  getPlatformSettings,
  setPlatformSettings,
  isKnownSettingKey,
  settingRange,
  type PlatformSettings,
} from "@/lib/config/platform-settings";

export const dynamic = "force-dynamic";

const WRITABLE: (keyof PlatformSettings)[] = [
  "platformFeePercent",
  "minimumWithdrawalRupees",
];

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;

  const settings = await getPlatformSettings(guard.admin);
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "no-store" },
  });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Expected an object of settings", 422, ErrorCode.VALIDATION_INPUT);
  }

  const patch = body as Record<string, unknown>;
  const unknown = Object.keys(patch).filter((k) => !WRITABLE.includes(k as keyof PlatformSettings));
  if (unknown.length > 0) {
    throw new AppError(
      `Unknown setting: ${unknown.join(", ")}`,
      422,
      ErrorCode.VALIDATION_INPUT,
    );
  }

  const writes: { field: keyof PlatformSettings; value: number }[] = [];
  for (const [key, raw] of Object.entries(patch)) {
    if (!isKnownSettingKey(key)) continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      throw new AppError(`${key} must be a number`, 422, ErrorCode.VALIDATION_INPUT);
    }
    const [lo, hi] = settingRange(key);
    // Reject rather than silently clamp: a save that quietly moved the number
    // is indistinguishable from a save that worked.
    if (num < lo || num > hi) {
      throw new AppError(`${key} must be between ${lo} and ${hi}`, 422, ErrorCode.VALIDATION_INPUT);
    }
    writes.push({ field: key, value: num });
  }

  if (writes.length === 0) {
    throw new AppError("Nothing to update", 422, ErrorCode.VALIDATION_INPUT);
  }

  let applied: PlatformSettings;
  try {
    applied = await setPlatformSettings(admin, adminId, writes);
  } catch (err) {
    throw new AppError(
      err instanceof Error ? err.message : "Could not save settings",
      500,
      ErrorCode.INTERNAL_DATABASE,
    );
  }

  await logAdminAction(admin, {
    adminId,
    action: "SETTINGS_UPDATE",
    targetType: "platform",
    metadata: { changed: Object.fromEntries(writes.map((w) => [w.field, w.value])) },
  });

  // Other open admin consoles pick this up without a refresh.
  void serverPublish("admin:settings", "settings:updated", {
    type: "UPDATE",
    record: { id: "platform", ...applied },
  });
  void sendAdminBus({
    kind: "settings_updated",
    label: `Platform settings changed (${writes.map((w) => w.field).join(", ")})`,
    actor: adminId,
    meta: { changed: Object.fromEntries(writes.map((w) => [w.field, w.value])) },
  });

  return NextResponse.json(applied);
});
