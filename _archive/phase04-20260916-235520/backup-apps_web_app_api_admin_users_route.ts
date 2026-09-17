import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { requireSuperAdmin, logAdminAction } from "@/lib/auth/admin";
import { z } from "zod";

const ActionSchema = z.object({
  userId: z.string().cuid(),
  action: z.enum(["VERIFY", "UNVERIFY", "BAN", "UNBAN", "PROMOTE_ADMIN", "DEMOTE"]),
});

export const GET = withErrorHandler(async (req: Request) => {
  await requireSuperAdmin();

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const role = url.searchParams.get("role");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        isVerified: true,
        sparks: true,
        createdAt: true,
        _count: { select: { bookings: true, posts: true, callSessions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  const adminId = await requireSuperAdmin();

  const body = await req.json();
  const { userId, action } = ActionSchema.parse(body);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) {
    throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
  }

  let update: Record<string, unknown> = {};
  switch (action) {
    case "VERIFY": update = { isVerified: true }; break;
    case "UNVERIFY": update = { isVerified: false }; break;
    case "PROMOTE_ADMIN": update = { role: "SUPER_ADMIN" }; break;
    case "DEMOTE": update = { role: "USER" }; break;
    case "BAN":
    case "UNBAN": update = { isVerified: false }; break;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: update,
    select: { id: true, role: true, isVerified: true },
  });

  await logAdminAction({
    adminId,
    action,
    targetType: "user",
    targetId: userId,
  });

  return NextResponse.json({ user, action });
});

