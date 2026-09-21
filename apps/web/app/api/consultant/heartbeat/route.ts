// ZEAL_FIX_HEARTBEAT_V3
// Presence ping — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { error } = await admin
    .from("User")
    .update({ lastSeenAt: new Date().toISOString(), is_online: true })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data } = await admin
    .from("User")
    .select("lastSeenAt, is_online")
    .eq("id", userId)
    .maybeSingle();

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
