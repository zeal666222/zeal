// apps/web/app/api/upload/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Accepts auth from either:
//   • Bearer token (admin proxy — enables admin chat image upload)
//   • Session cookie (direct web calls)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { getStorageAdapter } from "@/lib/storage";
import { randomUUID } from "crypto";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId } = guard;

  const formData = await req.formData();
  const file = formData.get("file");
  const folder = (formData.get("folder") as string | null) || "uploads";

  if (!file || !(file instanceof Blob)) {
    throw new AppError("No file provided", 400, ErrorCode.VALIDATION_INPUT);
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppError(`Unsupported file type: ${mime}`, 400, ErrorCode.VALIDATION_INPUT);
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new AppError("File exceeds 5 MB limit", 413, ErrorCode.VALIDATION_INPUT);
  }

  const adapter = getStorageAdapter();
  if (!adapter) {
    throw new AppError("Storage not configured", 503, ErrorCode.CONFIG_ERROR);
  }

  // Sanitize folder to prevent path traversal
  const safeFolder = folder.replace(/[^a-zA-Z0-9_\-/]/g, "").replace(/\/+/g, "/");
  const ext = (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/g, "");
  const key = `${safeFolder}/${userId}/${randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  const result = await adapter.upload({
    key,
    body,
    contentType: mime,
    metadata: { uploadedBy: userId },
  });

  return NextResponse.json({
    url: result.url,
    key: result.key,
    size: file.size,
    mime,
  });
});
