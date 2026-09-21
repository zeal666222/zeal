// ZEAL_FIX_FE_HEARTBEAT
// Presence ping — called by useConsultantHeartbeat() every 25s.
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await supabase
    .from("User")
    .update({ lastSeenAt: new Date().toISOString(), is_online: true })
    .eq("id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await supabase
    .from("User").select("lastSeenAt, is_online").eq("id", user.id).maybeSingle();
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}
