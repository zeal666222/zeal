import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { generateSlots } from "@/lib/scheduling";
import { z } from "zod";

const AvailabilityQuerySchema = z.object({
  consultantId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().min(5).max(240).default(30),
});

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url);
  const params = AvailabilityQuerySchema.parse({
    consultantId: url.searchParams.get("consultantId"),
    date: url.searchParams.get("date"),
    durationMinutes: url.searchParams.get("durationMinutes") || "30",
  });

  const consultant = await prisma.consultant.findUnique({
    where: { id: params.consultantId },
    select: { availability: true, bufferMinutes: true, isActive: true },
  });

  if (!consultant || !consultant.isActive) {
    throw new AppError("Consultant not available", 404, ErrorCode.NOT_FOUND);
  }

  const targetDate = new Date(params.date + "T00:00:00");
  const dayEnd = new Date(targetDate);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const existingBookings = await prisma.booking.findMany({
    where: {
      consultantId: params.consultantId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      scheduledAt: { gte: targetDate, lt: dayEnd },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const result = generateSlots({
    availability: consultant.availability,
    date: targetDate,
    durationMinutes: params.durationMinutes,
    bufferMinutes: consultant.bufferMinutes ?? 10,
    existingBookings,
  });

  return NextResponse.json({
    date: params.date,
    slots: result.slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      available: s.available,
    })),
    hasAvailability: result.hasAvailability,
  });
});

// BATCH2_APPLIED
