// apps/web/app/api/billing/instamojo/route.ts
// REPURPOSED: creates a Razorpay order for a booking. Path preserved.
import { NextResponse } from "next/server";
import { createAdminClient, createServerClientFromCookies } from "@zeal/database/server";
import { createRazorpayOrder, getPublicKeyId } from "@/lib/wallet/instamojo";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  consultantId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  serviceType: z.enum(["chat", "audio", "video", "physical"]).default("chat"),
});

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  }
  const { consultantId, scheduledAt, durationMinutes, serviceType } = parsed.data;

  const admin = createAdminClient();

  const { data: consultantRaw } = await admin
    .from("Consultant")
    .select('id, "perMinuteRate", "chatRate", "audioRate", "videoRate", "physicalRate", "isActive", status')
    .eq("id", consultantId)
    .maybeSingle();

  if (!consultantRaw) return NextResponse.json({ error: "Consultant not found" }, { status: 404 });
  const c = consultantRaw as {
    id: string;
    perMinuteRate: number;
    chatRate: number | null;
    audioRate: number | null;
    videoRate: number | null;
    physicalRate: number | null;
    isActive: boolean;
    status: string;
  };
  if (!c.isActive || c.status !== "VERIFIED") {
    return NextResponse.json({ error: "Consultant unavailable" }, { status: 404 });
  }

  const rateMap: Record<string, number> = {
    chat: Number(c.chatRate ?? c.perMinuteRate ?? 50),
    audio: Number(c.audioRate ?? c.perMinuteRate ?? 75),
    video: Number(c.videoRate ?? c.perMinuteRate ?? 100),
    physical: Number(c.physicalRate ?? c.perMinuteRate ?? 150),
  };
  const rate = rateMap[serviceType] ?? Number(c.perMinuteRate ?? 50);
  const amount = serviceType === "physical" ? rate : Math.round((rate * durationMinutes / 60) * 100) / 100;

  // Conflict check
  const { data: conflict } = await admin.rpc("check_booking_conflict", {
    p_consultant_id: consultantId,
    p_start: scheduledAt,
    p_duration_minutes: durationMinutes,
  });
  if (conflict === true) {
    return NextResponse.json({ error: "Slot not available" }, { status: 409 });
  }

  // Create Booking row (PENDING_PAYMENT)
  const { data: bookingRaw, error: bookingErr } = await admin
    .from("Booking")
    .insert({
      userId: user.id,
      consultantId,
      scheduledAt,
      durationMinutes,
      status: "PENDING_PAYMENT",
      amount,
      serviceType,
    } as never)
    .select("id")
    .single();

  if (bookingErr || !bookingRaw) {
    return NextResponse.json({ error: bookingErr?.message ?? "Booking creation failed" }, { status: 500 });
  }
  const bookingId = (bookingRaw as { id: string }).id;

  const order = await createRazorpayOrder({
    amount,
    receipt: `booking_${bookingId}`,
    notes: {
      userId: user.id,
      purpose: "booking_payment",
      bookingId,
      consultantId,
    },
  });

  await admin.from("RazorpayPayment").insert({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    status: "created",
    userId: user.id,
    purpose: "booking_payment",
    referenceId: bookingId,
  } as never);

  await admin
    .from("Booking")
    .update({ razorpayOrderId: order.id, paymentStatus: "pending" } as never)
    .eq("id", bookingId);

  return NextResponse.json({
    bookingId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: getPublicKeyId(),
  });
}
