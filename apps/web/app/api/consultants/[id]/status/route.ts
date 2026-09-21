// ZEAL_FIX_FE_STATUS
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data } = await admin
      .from("mv_consultant_directory")
      .select("id, is_online, lastSeenAt")
      .eq("id", id)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { id: data.id, is_online: data.is_online, lastSeenAt: data.lastSeenAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
