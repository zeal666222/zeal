// apps/web/app/api/bookings/[id]/confirm/route.ts
// Confirms a booking, holds escrow, and credits the consultant exactly once.
import { NextResponse } from "next/server";
import { createAdminClient, createServerClientFromCookies } from "@zeal/database/server";
import { serverPublish } from "@/lib/realtime/server";

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

  let body: { razorpayPaymentId?: string } = {};
  try { body = await req.json(); } catch { /* optional body */ }

  const admin = createAdminClient();

  const { data: rpcData, error: rpcErr } = await admin.rpc("confirm_booking_payment", {
    p_booking_id: id,
    p_razorpay_payment_id: body.razorpayPaymentId ?? null,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }
  const rpc = rpcData as { success?: boolean; error?: string } | null;
  if (rpc && rpc.success === false) {
    return NextResponse.json({ error: rpc.error ?? "Confirm failed" }, { status: 400 });
  }

  const { data: booking } = await admin
    .from("Booking")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  try {
    await serverPublish(`booking:${id}:status`, "booking_updated", {
      id,
      status: "CONFIRMED",
      confirmedAt: new Date().toISOString(),
    });
  } catch { /* best-effort */ }

  return NextResponse.json({ booking });
}
