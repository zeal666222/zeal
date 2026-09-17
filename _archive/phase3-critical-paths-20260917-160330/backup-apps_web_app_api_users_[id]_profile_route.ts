import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { prisma } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { getStorageAdapter } from "@/lib/storage";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
});

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: targetId } = await params;
    const viewerId = await getUserId();

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        sparks: true,
        isVerified: true,
        role: true,
        consultant: {
          select: {
            id: true,
            category: true,
            specialties: true,
            languages: true,
            bio: true,
            perMinuteRate: true,
            rating: true,
            totalConsultations: true,
            isActive: true,
            isVerified: true,
            subdomain: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
    }

    // If viewer is the owner, include wallet
    if (viewerId === targetId) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: targetId },
      });
      return NextResponse.json({ user: { ...user, wallet } });
    }

    return NextResponse.json({ user });
  },
);

export const PUT = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: targetId } = await params;
    const viewerId = await getUserId();
    if (!viewerId) {
      throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    }
    if (viewerId !== targetId) {
      throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);
    }

    const body = await req.json();
    const data = UpdateProfileSchema.parse(body);

    // If username is being changed, check uniqueness
    if (data.username) {
      const existing = await prisma.user.findUnique({
        where: { username: data.username },
        select: { id: true },
      });
      if (existing && existing.id !== targetId) {
        throw new AppError(
          "Username already taken",
          409,
          ErrorCode.BOOKING_CONFLICT,
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        name: data.name,
        avatar: data.avatar,
        username: data.username,
      },
    });

    return NextResponse.json({ user });
  },
);

export const POST = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: targetId } = await params;
    const viewerId = await getUserId();
    if (!viewerId) {
      throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    }
    if (viewerId !== targetId) {
      throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);
    }

    const adapter = getStorageAdapter();
    if (!adapter) {
      throw new AppError("Storage not configured", 503, ErrorCode.CONFIG_ERROR);
    }

    const formData = await req.formData();
    const file = formData.get("avatar");
    if (!file || !(file instanceof Blob)) {
      throw new AppError("No avatar provided", 400, ErrorCode.VALIDATION_INPUT);
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new AppError("Avatar must be under 2 MB", 413, ErrorCode.VALIDATION_INPUT);
    }
    if (!file.type.startsWith("image/")) {
      throw new AppError("Avatar must be an image", 400, ErrorCode.VALIDATION_INPUT);
    }

    const ab = await file.arrayBuffer();
    const body = new Uint8Array(ab);
    const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/g, "");
    const key = `avatars/${targetId}/${Date.now()}.${ext}`;

    const result = await adapter.upload({
      key,
      body,
      contentType: file.type,
    });

    await prisma.user.update({
      where: { id: targetId },
      data: { avatar: result.url },
    });

    return NextResponse.json({ url: result.url });
  },
);

// BATCH3_APPLIED
