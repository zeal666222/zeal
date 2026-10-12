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

const VALID_SCOPES = [
  "impersonate",
  "manage-users",
  "view-analytics",
  "manage-content",
  "manage-bookings",
  "manage-wallet",
  "system-health",
  "read-only",
] as const;

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(VALID_SCOPES)).min(1),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ─── GET: List keys (masked) ─────────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  const { data: keys, error } = await admin
    .from("AdminAPIKey")
    .select("id, name, scopes, expiresAt, lastUsedAt, createdAt, keyHash")
    .eq("adminId", userId)
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask the key hashes — show only first 8 chars
  const masked = (keys ?? []).map((k: Record<string, unknown>) => ({
    id: k.id,
    name: k.name,
    scopes: k.scopes,
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

  const { name, scopes, expiresAt } = parsed.data;

  // Call the DB function to generate the key (returns plaintext once)
  const { data: rawKey, error } = await admin.rpc("generate_admin_api_key", {
    p_admin_id: userId,
    p_name: name,
    p_scopes: scopes,
    p_expires_at: expiresAt ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(admin, {
    adminId: userId,
    action: "API_KEY_CREATE",
    targetType: "admin_api_key",
    metadata: { name, scopes, expiresAt },
  });

  return NextResponse.json({
    success: true,
    key: rawKey,
    name,
    scopes,
    expiresAt,
    message: "Store this key securely. It will not be shown again.",
  });
}
