// apps/web/app/api/bookings/[id]/confirm/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Confirm a booking (settle + credit the consultant exactly once).
//
// Authorized actors: the seeker who owns the booking, the consultant assigned to
// it, or an admin. The old code delegated to confirm_booking_payment(), which
// resolves its caller from auth.uid(); but this route calls Supabase with the
// service-role client, where auth.uid() is NULL — so it returned
// 'not_authenticated' for everyone and consultants were forbidden by the RPC's
// own guard. We settle directly with explicit actor authorization instead.
//
// Money-safety: the consultant credit uses credit_funds_safe with the idempotency
// key `booking-earn:<id>`, the same key the RPC uses, so confirm can never
// double-credit regardless of which path (webhook / seeker / consultant) fires.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient, createServerClientFromCookies } from "@zeal/database/server";
import { serverPublish } from "@/lib/realtime/server";
import { sendAdminBus } from "@/lib/realtime/admin-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "SUPPORT"]);

interface BookingRow {
  id: string;
  userId: string | null;
  consultantId: string | null;
  status: string;
  amount: number;
  platformFeeRate: number | null;
  razorpayPaymentId: string | null;
  scheduledAt: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { razorpayPaymentId?: string } = {};
  try { body = await req.json(); } catch { /* optional body */ }

  const admin = createAdminClient();

  const { data: bookingRaw, error: loadErr } = await admin
    .from("Booking")
    .select('id, "userId", "consultantId", status, amount, "platformFeeRate", "razorpayPaymentId", "scheduledAt"')
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  const booking = bookingRaw as BookingRow | null;
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Resolve the consultant's owning user (needed for authorization + credit).
  let consultantUserId: string | null = null;
  if (booking.consultantId) {
    const { data: c } = await admin
      .from("Consultant").select("userId").eq("id", booking.consultantId).maybeSingle();
    consultantUserId = (c as { userId: string | null } | null)?.userId ?? null;
  }

  // Resolve caller role for admin override.
  const { data: profile } = await admin
    .from("User").select("role").eq("id", user.id).maybeSingle();
  const callerRole = String((profile as { role: string | null } | null)?.role ?? "").toUpperCase();

  const isSeeker = booking.userId === user.id;
  const isConsultant = consultantUserId !== null && consultantUserId === user.id;
  const isAdmin = ADMIN_ROLES.has(callerRole);

  if (!isSeeker && !isConsultant && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Idempotent: already settled → return the current row untouched.
  if (booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS" || booking.status === "COMPLETED") {
    const { data: current } = await admin.from("Booking").select("*").eq("id", id).maybeSingle();
    return NextResponse.json({ booking: current, alreadyConfirmed: true });
  }
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "Booking is cancelled" }, { status: 409 });
  }

  // Only PENDING / PENDING_PAYMENT reach this point.
  const feeRate = Number(booking.platformFeeRate ?? 0.10);
  const amount = Number(booking.amount ?? 0);
  const platformFee = Math.round(amount * feeRate * 100) / 100;
  const consultantEarning = Math.round((amount - platformFee) * 100) / 100;

  const { error: updateErr } = await admin
    .from("Booking")
    .update({
      status: "CONFIRMED",
      platformFee,
      consultantEarning,
      paymentStatus: "captured",
      razorpayPaymentId: body.razorpayPaymentId ?? booking.razorpayPaymentId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", booking.status); // optimistic guard against races
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Credit the consultant exactly once (idempotency key shared with the RPC).
  if (consultantUserId && consultantEarning > 0) {
    const { error: creditErr } = await admin.rpc("credit_funds_safe", {
      p_user_id: consultantUserId,
      p_amount: consultantEarning,
      p_description: `Booking earning: ${id}`,
      p_reference_id: `booking-earn:${id}`,
    });
    if (creditErr) {
      return NextResponse.json({ error: creditErr.message }, { status: 500 });
    }
  }

  // Notify the seeker (Notification insert trigger fans out user:<uid>:notifications).
  if (booking.userId) {
    await admin.from("Notification").insert({
      userId: booking.userId,
      type: "booking",
      message: "Your booking is confirmed.",
      redirectUrl: "/bookings",
      actorId: user.id,
    });
  }

  // Realtime (best-effort; DB trigger also emits booking:<id>:status + admin:bookings).
  try {
    await serverPublish(`booking:${id}:status`, "booking_updated", {
      id, status: "CONFIRMED", confirmedAt: new Date().toISOString(),
    });
    if (consultantUserId) {
      await serverPublish(`consultant:${consultantUserId}:bookings`, "booking_updated", { id, status: "CONFIRMED" });
    }
  } catch { /* non-fatal */ }

  void sendAdminBus({
    kind: "booking_confirmed",
    label: `Booking ${id.slice(0, 8)} confirmed`,
    actor: user.id,
    amount: consultantEarning > 0 ? consultantEarning : null,
    meta: { bookingId: id },
  });

  const { data: settled } = await admin.from("Booking").select("*").eq("id", id).maybeSingle();
  return NextResponse.json({ booking: settled });
}
