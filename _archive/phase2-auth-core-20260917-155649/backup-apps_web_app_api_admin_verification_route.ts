// apps/web/app/api/admin/verification/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY FIX (Phase 4):
//   Previously: POST had NO auth. Anyone could approve/reject consultants.
//   Now: requires ADMIN role via requireAdminAPI.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

// ─── GET: list pending consultants ────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { data: consultants, error } = await admin
    .from("Consultant")
    .select(`
      id, category, specialties, bio, perMinuteRate, status, createdAt,
      verificationDocs,
      user:User!Consultant_userId_fkey(id, name, email, username, avatar)
    `)
    .eq("status", "PENDING")
    .order("createdAt", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consultants: consultants ?? [] });
}

// ─── POST: approve or reject ──────────────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { consultantId?: string; action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { consultantId, action, reason } = body;
  if (!consultantId || !action) {
    return NextResponse.json({ error: "Missing consultantId or action" }, { status: 400 });
  }
  if (!["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Use the RPC from migration 002_functions.sql (verify_consultant)
  const { data: rpcData, error: rpcError } = await admin.rpc("verify_consultant", {
    p_consultant_id: consultantId,
    p_admin_id: adminId,
    p_action: action,
    p_reason: reason ?? null,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const rpcResult = rpcData as { success?: boolean; error?: string } | null;
  if (rpcResult && rpcResult.success === false) {
    return NextResponse.json({ error: rpcResult.error || "RPC failed" }, { status: 500 });
  }

  // Audit
  await logAdminAction(admin, {
    adminId,
    action: action === "APPROVE" ? "CONSULTANT_APPROVE" : "CONSULTANT_REJECT",
    targetType: "consultant",
    targetId: consultantId,
    metadata: { reason },
  });

  // Realtime: notify applicant
  try {
    const { serverPublish } = await import("@/lib/realtime/server");
    const { data: consultantRow } = await admin
      .from("Consultant")
      .select("userId")
      .eq("id", consultantId)
      .maybeSingle();

    if (consultantRow?.userId) {
      await serverPublish(`user:${consultantRow.userId}:notifications`, "notification", {
        id: `verif-${Date.now()}`,
        type: "verification",
        message:
          action === "APPROVE"
            ? "Your consultant application was approved!"
            : `Your application was rejected: ${reason ?? "No reason provided"}`,
        redirectUrl: "/consultant/dashboard",
      });
    }
  } catch { /* realtime best-effort */ }

  return NextResponse.json({ success: true, action });
}