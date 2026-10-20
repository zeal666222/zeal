// apps/web/app/api/bookings/[id]/cancel/route.ts
// Windowed cancellation: >24h full refund, 2–24h 50%, <2h none.
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
    id: string; userId: string; consultantId: string | null;
    scheduledAt: string; status: string;
    amount: number; razorpayPaymentId: string | null;
  };

  // Authorization: seeker, the assigned consultant, or an admin.
  let consultantUserId: string | null = null;
  if (booking.consultantId) {
    const { data: c } = await admin
      .from("Consultant").select("userId").eq("id", booking.consultantId).maybeSingle();
    consultantUserId = (c as { userId: string | null } | null)?.userId ?? null;
  }
  const { data: profile } = await admin
    .from("User").select("role").eq("id", user.id).maybeSingle();
  const callerRole = String((profile as { role: string | null } | null)?.role ?? "").toUpperCase();

  const isSeeker = booking.userId === user.id;
  const isConsultant = consultantUserId !== null && consultantUserId === user.id;
  const isAdmin = callerRole === "SUPER_ADMIN" || callerRole === "ADMIN" || callerRole === "SUPPORT";

  if (!isSeeker && !isConsultant && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // A consultant may only decline a booking that has not been settled/credited
  // yet. Cancelling a CONFIRMED booking would refund the seeker without clawing
  // back the consultant's already-paid earning — reserve that for the seeker/admin.
  const settled = booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS" || booking.status === "COMPLETED";
  if (isConsultant && !isSeeker && !isAdmin && settled) {
    return NextResponse.json(
      { error: "This booking is already confirmed. The client or support must cancel it." },
      { status: 409 },
    );
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

  return NextResponse.json({ ok: true, refundFraction, refundAmount, rpc: rpcData });
}
