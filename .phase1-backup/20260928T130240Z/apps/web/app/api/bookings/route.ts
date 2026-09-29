// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/bookings — create booking with escrow hold
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import * as Ledger from "@/lib/wallet/ledger";
import crypto from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  consultantId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(240),
  amount: z.number().positive().max(100_000),
  platformFee: z.number().min(0).max(100_000),
});

export async function POST(req: Request) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to book." }, { status: 401 });
  }

  // ─── Body ────────────────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid booking." },
      { status: 422 },
    );
  }
  const { consultantId, scheduledAt, durationMinutes, amount, platformFee } = parsed.data;

  // ─── Verify wallet balance ───────────────────────────────────────────────
  const balance = await Ledger.getWalletBalance(user.id);
  if (balance < amount) {
    return NextResponse.json(
      { error: "Insufficient wallet balance. Please top up." },
      { status: 400 },
    );
  }

  const bookingId = crypto.randomUUID();
  const consultantEarning = amount - platformFee;

  // ─── Insert booking (RLS-scoped client) ──────────────────────────────────
  const { error: bookingError } = await supabase
    .from("Booking")
    .insert({
      id: bookingId,
      userId: user.id,
      consultantId,
      scheduledAt,
      durationMinutes,
      status: "PENDING",
      amount,
      platformFee,
      consultantEarning,
    } as never);

  if (bookingError) {
    return NextResponse.json(
      { error: "Could not create booking. Please try again." },
      { status: 500 },
    );
  }

  // ─── Hold funds in escrow (atomic RPC) ───────────────────────────────────
  try {
    await Ledger.holdInEscrow(
      user.id,
      amount,
      bookingId,
      "Prepaid consultation booking",
    );
  } catch (escrowErr) {
    // Rollback: delete booking
    await supabase.from("Booking").delete().eq("id", bookingId);
    console.error("[bookings] escrow failed:", escrowErr);
    return NextResponse.json(
      { error: "Could not hold funds. Please try again." },
      { status: 500 },
    );
  }

  // ─── Realtime fanout ──────────────────────────────────────────────────────
  // Consultant dashboards listen on consultant:<User.id>:incoming
  // Admin dashboards listen on      admin:bookings
  // Must resolve Consultant.userId — publishing to Consultant.id would be a
  // channel-name mismatch (different UUIDs).
  try {
    const { data: consultantRow } = await supabase
      .from("Consultant")
      .select("userId")
      .eq("id", consultantId)
      .maybeSingle();
    const consultantUserId = (consultantRow as { userId?: string } | null)?.userId;
    const { serverPublish } = await import("@/lib/realtime/server");

    if (consultantUserId) {
      await serverPublish(
        `consultant:${consultantUserId}:incoming`,
        "incoming_request",
        {
          id: bookingId,
          seekerName: user.email?.split("@")[0] ?? "Seeker",
          rate: amount,
          modality: "chat",
          receivedAt: new Date().toISOString(),
        },
      );
    }

    await serverPublish("admin:bookings", "booking_created", {
      id: bookingId,
      userId: user.id,
      consultantId,
      amount,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[bookings] realtime publish failed:", err);
  }

  return NextResponse.json({ success: true, bookingId });
}
