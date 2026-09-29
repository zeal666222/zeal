// apps/web/app/api/bookings/[id]/cancel/route.ts
// Windowed cancellation: >24h full refund, 2–24h 50% refund, <2h none.
import { NextResponse } from "next/server";
import { createAdminClient, createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { reason?: string } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const admin = createAdminClient();
  const { data: bookingRaw } = await admin
    .from("Booking")
    .select('id, "userId", "consultantId", "scheduledAt", status, amount, "razorpayPaymentId"')
    .eq("id", id)
    .maybeSingle();

  if (!bookingRaw) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = bookingRaw as {
    id: string;
    userId: string;
    consultantId: string | null;
    scheduledAt: string;
    status: string;
    amount: number;
    razorpayPaymentId: string | null;
  };

  if (booking.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }
  if (booking.status === "COMPLETED") {
    return NextResponse.json({ error: "Cannot cancel completed booking" }, { status: 400 });
  }

  const hoursToStart =
    (new Date(booking.scheduledAt).getTime() - Date.now()) / 3_600_000;

  let refundFraction = 0;
  if (hoursToStart > 24) refundFraction = 1;
  else if (hoursToStart > 2) refundFraction = 0.5;

  const refundAmount = Math.round(booking.amount * refundFraction * 100) / 100;

  const { data: rpcData, error: rpcErr } = await admin.rpc("cancel_booking", {
    p_booking_id: id,
    p_actor_id: user.id,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    refundFraction,
    refundAmount,
    rpc: rpcData,
  });
}
