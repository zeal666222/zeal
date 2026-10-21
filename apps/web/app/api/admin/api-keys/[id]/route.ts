// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/api-keys/[id] — Revoke an API key
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  const { id } = await params;

  // Verify the key belongs to this admin
  const { data: key, error: fetchErr } = await admin
    .from("AdminAPIKey")
    .select("id, name")
    .eq("id", id)
    .eq("createdBy", userId)
    .maybeSingle();

  if (fetchErr || !key) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  const { error: delErr } = await admin
    .from("AdminAPIKey")
    .delete()
    .eq("id", id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  await logAdminAction(admin, {
    adminId: userId,
    action: "API_KEY_REVOKE",
    targetType: "admin_api_key",
    targetId: id,
    metadata: { keyName: key.name },
  });

  return NextResponse.json({ success: true, revoked: id });
}
