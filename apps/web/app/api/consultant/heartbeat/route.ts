import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  await safeQuery(
    admin.from("User")
      .update({ lastSeenAt: new Date().toISOString(), is_online: true })
      .eq("id", userId),
    "heartbeat.update",
  );

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
});

export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const row = await safeQueryOne<{ lastSeenAt: string | null; is_online: boolean }>(
    admin.from("User").select("lastSeenAt, is_online").eq("id", userId).maybeSingle(),
    "heartbeat.read",
  );

  return NextResponse.json({ ok: true, ...(row ?? {}) });
});
