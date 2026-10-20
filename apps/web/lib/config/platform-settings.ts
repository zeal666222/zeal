// ═══════════════════════════════════════════════════════════════════════════════
// Platform settings — the values the application code actually honours.
// ───────────────────────────────────────────────────────────────────────────────
// Backed by public."AdminSetting" (20261020170000_admin_settings.sql) and read
// with the service-role client, which is the only role that can see that table.
//
// Reads fall back to DEFAULTS instead of throwing. The migration is applied by
// the operator, so a deploy can legitimately land before the table does, and a
// booking must not fail because a settings lookup did.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlatformSettings {
  /** Percent of the booking amount the platform keeps, stamped on new bookings. */
  platformFeePercent: number;
  /** Smallest withdrawal a consultant can request, in rupees. */
  minimumWithdrawalRupees: number;
}

export const DEFAULTS: PlatformSettings = {
  platformFeePercent: 10,
  minimumWithdrawalRupees: 100,
};

type SettingKey = "platform_fee_percent" | "minimum_withdrawal_rupees";

const KEY_FOR: Record<keyof PlatformSettings, SettingKey> = {
  platformFeePercent: "platform_fee_percent",
  minimumWithdrawalRupees: "minimum_withdrawal_rupees",
};

/** Upper bounds: a fee above this is a typo, a withdrawal floor above it strands wallets. */
const LIMITS: Record<keyof PlatformSettings, [number, number]> = {
  platformFeePercent: [0, 50],
  minimumWithdrawalRupees: [50, 100_000],
};

export function clampSetting<K extends keyof PlatformSettings>(key: K, raw: number): number {
  const [lo, hi] = LIMITS[key];
  return Math.min(hi, Math.max(lo, raw));
}

/** Inclusive bounds a stored value must satisfy. */
export function settingRange(key: keyof PlatformSettings): [number, number] {
  return LIMITS[key];
}

export function isKnownSettingKey(key: string): key is keyof PlatformSettings {
  return key === "platformFeePercent" || key === "minimumWithdrawalRupees";
}

export async function getPlatformSettings(
  admin: SupabaseClient,
): Promise<PlatformSettings> {
  const { data, error } = await admin
    .from("AdminSetting")
    .select("key, value")
    .in("key", Object.values(KEY_FOR));

  const out = { ...DEFAULTS };
  if (error || !data) return out;

  for (const row of data as { key: string; value: unknown }[]) {
    const field = (Object.keys(KEY_FOR) as (keyof PlatformSettings)[]).find(
      (k) => KEY_FOR[k] === row.key,
    );
    if (!field) continue;
    const num = Number(row.value);
    if (Number.isFinite(num)) out[field] = clampSetting(field, num);
  }
  return out;
}

export interface SettingWrite {
  field: keyof PlatformSettings;
  value: number;
}

export async function setPlatformSettings(
  admin: SupabaseClient,
  actorId: string,
  writes: SettingWrite[],
): Promise<PlatformSettings> {
  if (writes.length === 0) return getPlatformSettings(admin);

  const rows = writes.map((w) => ({
    key: KEY_FOR[w.field],
    value: clampSetting(w.field, w.value),
    updatedBy: actorId,
  }));

  const { error } = await admin.from("AdminSetting").upsert(
    rows.map((r) => ({
      key: r.key,
      value: r.value,
      "updatedBy": r.updatedBy,
      "updatedAt": new Date().toISOString(),
    })) as never,
    { onConflict: "key" },
  );
  if (error) throw error;

  // Read back rather than echoing the request, so the UI shows what is stored.
  return getPlatformSettings(admin);
}

/** Fee as the 0-1 ratio the Booking."platformFeeRate" column expects. */
export function feeRate(settings: PlatformSettings): number {
  return settings.platformFeePercent / 100;
}
