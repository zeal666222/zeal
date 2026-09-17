import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin, logAdminAction } from "@/lib/auth/admin";
import { z } from "zod";

const UpdateSchema = z.object({
  consultantId: z.string().cuid(),
  action: z.enum(["SUSPEND", "REACTIVATE", "FEATURE", "UNFEATURE", "SET_RATE", "SET_SUBDOMAIN"]),
  value: z.union([z.number(), z.string(), z.boolean()]).optional(),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireSuperAdmin();

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [consultants, total] = await Promise.all([
    prisma.consultant.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true, username: true, avatar: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.consultant.count({ where }),
  ]);

  return NextResponse.json({
    consultants,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();

  const body = await req.json();
  const { consultantId, action, value } = UpdateSchema.parse(body);

  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    select: { id: true, userId: true, isActive: true, status: true },
  });
  if (!consultant) {
    throw new AppError("Consultant not found", 404, ErrorCode.NOT_FOUND);
  }

  let update: Record<string, unknown> = {};
  switch (action) {
    case "SUSPEND": update = { isActive: false, status: "SUSPENDED" }; break;
    case "REACTIVATE": update = { isActive: true, status: "VERIFIED" }; break;
    case "FEATURE": update = { isFeatured: true }; break;
    case "UNFEATURE": update = { isFeatured: false }; break;
    case "SET_RATE": update = { perMinuteRate: Number(value) }; break;
    case "SET_SUBDOMAIN": update = { subdomain: String(value), subdomainActive: true }; break;
  }

  const updated = await prisma.consultant.update({
    where: { id: consultantId },
    data: update,
  });

  await logAdminAction({
    adminId,
    action,
    targetType: "consultant",
    targetId: consultantId,
    metadata: { value },
  });

  return NextResponse.json({ consultant: updated });
});

