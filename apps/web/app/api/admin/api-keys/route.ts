// ═══════════════════════════════════════════════════════════════════════════════
// /api/admin/api-keys — List & generate admin API keys
// ═══════════════════════════════════════════════════════════════════════════════
// GET  — List all API keys for the current admin (masked hashes)
// POST — Generate a new API key (SUPER_ADMIN only). Returns plaintext ONCE.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

// The only scopes that mean anything are the ones routes demand via hasAPIScope().
// Listing decorative scopes here was how a key got created that could never call
// the endpoint it was issued for (e.g. 'impersonate' vs 'impersonate:session').
const VALID_SCOPES = [
  "wallet:credit",
  "wallet:debit",
  "withdraw:process",
  "impersonate:session",
  "read-only",
] as const;

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(VALID_SCOPES)).min(1),
  // Days, not an ISO timestamp: the DB function works in days, and converting a
  // timestamp back to a number here only introduced drift between what the admin
  // picked and when the key actually dies. null = never expires.
  expiresDays: z.number().int().min(1).max(3650).nullable().optional(),
});

// ─── GET: List keys (masked) ─────────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  const { data: keys, error } = await admin
    .from("AdminAPIKey")
    .select("id, name, scopes, expiresAt, lastUsedAt, createdAt, keyHash")
    .eq("createdBy", userId)
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask the key hashes — show only first 8 chars
  const masked = (keys ?? []).map((k: Record<string, unknown>) => ({
    id: k.id,
    name: k.name,
    scopes: (k.scopes as string[]) ?? [],
    expiresAt: k.expiresAt,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
    keyPrefix: (k.keyHash as string).slice(0, 8) + "...",
  }));

  return NextResponse.json({ keys: masked });
}

// ─── POST: Generate new key ──────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, scopes, expiresDays } = parsed.data;

  // Call the DB function to generate the key (returns plaintext once). The RPC
  // answers with a jsonb envelope — {success, id, key} — not a bare string.
  // p_admin_id is mandatory: the service-role client has no auth.uid(), so the
  // acting admin is named here and re-checked against the User table in SQL.
  const { data: issued, error } = await admin.rpc("generate_admin_api_key", {
    p_name: name,
    p_admin_id: userId,
    p_scopes: scopes,
    p_expires_days: expiresDays ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const envelope = (issued ?? {}) as {
    success?: boolean; error?: string; key?: string; id?: string;
  };
  if (!envelope.success || !envelope.key) {
    return NextResponse.json(
      { error: envelope.error ?? "Could not issue key" },
      { status: envelope.error === "forbidden" ? 403 : 500 },
    );
  }

  await logAdminAction(admin, {
    adminId: userId,
    action: "API_KEY_CREATE",
    targetType: "admin_api_key",
    targetId: envelope.id,
    metadata: { name, scopes, expiresDays },
  });

  return NextResponse.json({
    success: true,
    key: envelope.key,
    id: envelope.id,
    name,
    scopes,
    expiresDays: expiresDays ?? null,
    message: "Store this key securely. It will not be shown again.",
  });
}
