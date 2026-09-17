import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { z } from "zod";

const TimeBlockSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const AvailabilitySchema = z.object({
  availability: z.record(z.string(), z.array(TimeBlockSchema)),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
});

export const GET = withErrorHandler(async () => {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const consultant = await prisma.consultant.findUnique({
    where: { userId },
    select: { availability: true, bufferMinutes: true },
  });
  if (!consultant) {
    throw new AppError("Not a consultant", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  return NextResponse.json({
    availability: consultant.availability ?? {},
    bufferMinutes: consultant.bufferMinutes ?? 10,
  });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  const body = await req.json();
  const data = AvailabilitySchema.parse(body);

  const consultant = await prisma.consultant.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!consultant) {
    throw new AppError("Not a consultant", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const updated = await prisma.consultant.update({
    where: { id: consultant.id },
    data: {
      availability: data.availability,
      ...(data.bufferMinutes !== undefined && {
        bufferMinutes: data.bufferMinutes,
      }),
    },
    select: { availability: true, bufferMinutes: true },
  });

  return NextResponse.json(updated);
});

// BATCH3_APPLIED
