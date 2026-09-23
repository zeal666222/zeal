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

interface MvRow {
  id: string;
  userId: string;
  name: string | null;
  username: string | null;
  is_online: boolean | null;
  lastSeenAt: string | null;
  perMinuteRate: number | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    // 1. Try human consultant MV
    const { data: mv } = await admin
      .from("mv_consultant_directory")
      .select('id, "userId", name, username, is_online, "lastSeenAt", "perMinuteRate"')
      .eq("id", id)
      .maybeSingle();

    if (mv) {
      const row = mv as MvRow;
      return NextResponse.json(
        {
          id: row.id,
          userId: row.userId,
          name: row.name ?? row.username ?? "Guide",
          is_online: Boolean(row.is_online),
          lastSeenAt: row.lastSeenAt,
          perMinuteRate: Number(row.perMinuteRate ?? 50),
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
