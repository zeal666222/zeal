// apps/web/app/api/bookings/[id]/reschedule/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Allows the booking owner OR the consultant to move a booking to a new slot.
// Slot must be in the future, and the consultant must have no conflicting
// booking in that window (checked via the check_booking_conflict RPC).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createServerClientFromCookies } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { serverPublish } from "@/lib/realtime/server";
import { NotificationService } from "@/lib/notifications/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
});

export const POST = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id } = await params;

    const body = await req.json();
    const { scheduledAt, durationMinutes } = RescheduleSchema.parse(body);

    const newStart = new Date(scheduledAt);
    if (newStart.getTime() < Date.now() + 5 * 60_000) {
      throw new AppError("Slot must be at least 5 minutes in the future", 400, ErrorCode.VALIDATION_INPUT);
    }

    const supabase = await createServerClientFromCookies();

    const { data: booking } = await supabase
      .from("Booking")
      .select(`
        id, status, userId, consultantId, scheduledAt, durationMinutes,
        consultant:Consultant!Booking_consultantId_fkey(
          id, userId, user:User!Consultant_userId_fkey(id, name)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (!booking) throw new AppError("Booking not found", 404, ErrorCode.BOOKING_NOT_FOUND);

    const consultantUserId = (booking.consultant as { userId?: string } | null)?.userId;
    const isOwner = booking.userId === userId;
    const isConsultant = consultantUserId === userId;
    if (!isOwner && !isConsultant) {
      throw new AppError("Not authorized", 403, ErrorCode.AUTH_FORBIDDEN);
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      throw new AppError("Cannot reschedule in current status", 400, ErrorCode.BOOKING_CONFLICT);
    }

    const duration = durationMinutes ?? booking.durationMinutes ?? 30;

    // Conflict check
    const { data: conflict } = await supabase.rpc("check_booking_conflict", {
      p_consultant_id: booking.consultantId,
      p_start: newStart.toISOString(),
      p_duration_minutes: duration,
    });
    if (conflict === true) {
      throw new AppError("Consultant is not available at that time", 409, ErrorCode.BOOKING_CONFLICT);
    }

    const { data: updated, error } = await supabase
      .from("Booking")
      .update({
        scheduledAt: newStart.toISOString(),
        durationMinutes: duration,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);

    // Notify counterparty
    const notifyUserId = isOwner ? consultantUserId : booking.userId;
    if (notifyUserId) {
      try {
        await NotificationService.createNotification({
          userId: notifyUserId,
          type: "booking",
          message: `Booking rescheduled to ${newStart.toLocaleString()}`,
          redirectUrl: `/bookings`,
          actorId: userId,
        });
      } catch (err) {
        console.warn("[reschedule] notify failed:", err);
      }
    }

    try {
      await serverPublish(`booking:${id}:status`, "booking_updated", {
        id,
        scheduledAt: newStart.toISOString(),
        durationMinutes: duration,
      });
    } catch { /* best-effort */ }

    return NextResponse.json({ booking: updated });
  },
);
