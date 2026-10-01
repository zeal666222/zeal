// ZEAL_PHASE2_V1
// apps/web/app/api/consultants/[id]/status/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Returns the minimum info startChatFlow needs to gate + navigate:
//   { id, userId, name, is_online, lastSeenAt, perMinuteRate, isAI }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ConsultantUser {
  name: string | null;
  full_name: string | null;
  username: string | null;
  is_online: boolean | null;
  lastSeenAt: string | null;
}

interface ConsultantRow {
  id: string;
  userId: string;
  chatRate: number | null;
  perMinuteRate: number | null;
  isActive: boolean | null;
  status: string | null;
  user: ConsultantUser | ConsultantUser[] | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    // 1. Human consultant (direct query — always fresh; chatRate drives chat billing)
    const { data: cRow } = await admin
      .from("Consultant")
      .select(
        `id, "userId", "chatRate", "perMinuteRate", "isActive", status,
         user:User!fk_consultant_user(name, full_name, username, is_online, "lastSeenAt")`,
      )
      .eq("id", id)
      .maybeSingle();

    const c = cRow as ConsultantRow | null;

    if (c && c.status === "VERIFIED" && c.isActive !== false) {
      const u = Array.isArray(c.user) ? c.user[0] : c.user;
      return NextResponse.json(
        {
          id: c.id,
          userId: c.userId,
          name: u?.name ?? u?.full_name ?? u?.username ?? "Guide",
          is_online: Boolean(u?.is_online),
          lastSeenAt: u?.lastSeenAt ?? null,
          perMinuteRate: Number(c.chatRate ?? c.perMinuteRate ?? 50),
          isAI: false,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // 2. Fallback: AI consultant
    const { data: ai } = await admin
      .from("AIConsultant")
      .select('id, name, "perMinuteRate", "isPaid", "isActive"')
      .eq("id", id)
      .maybeSingle();

    if (ai) {
      const a = ai as {
        id: string;
        name: string;
        perMinuteRate: number | null;
        isPaid: boolean | null;
        isActive: boolean | null;
      };
      if (a.isActive === false) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json(
        {
          id: a.id,
          userId: a.id,
          name: a.name,
          is_online: true,
          lastSeenAt: null,
          perMinuteRate: a.isPaid ? Number(a.perMinuteRate ?? 0) : 0,
          isAI: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
