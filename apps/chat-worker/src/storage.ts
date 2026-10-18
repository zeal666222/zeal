// ═══════════════════════════════════════════════════════════════════════════════
// R2 Storage — direct bucket binding operations (zero SigV4 overhead)
// ═══════════════════════════════════════════════════════════════════════════════

import type { Env } from "./env";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif",
]);
const ALLOWED_DOC_TYPES = new Set([
  "application/pdf", "text/plain", "text/csv",
  "application/json", "text/markdown",
]);

const R2_PUBLIC_BASE = "https://zeal.882b56d6adae42a502d0e38bccaf281a.r2.cloudflarestorage.com";

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

function generateKey(prefix: string, ext: string): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const cleanExt = ext.replace(/^\.+/, "");
  return `${prefix}/${ts}-${rand}${cleanExt ? "." + cleanExt : ""}`;
}

function extFromMime(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "image/gif": "gif", "image/avif": "avif",
    "application/pdf": "pdf", "text/plain": "txt",
    "text/csv": "csv", "application/json": "json",
    "text/markdown": "md",
  };
  return map[contentType] ?? "";
}

function isAllowedType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType) || ALLOWED_DOC_TYPES.has(contentType);
}

export async function uploadToR2(
  env: Env,
  body: ArrayBuffer,
  contentType: string,
  userId: string,
  prefix = "uploads",
): Promise<UploadResult> {
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)`);
  }
  if (!isAllowedType(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}`);
  }

  const ext = extFromMime(contentType);
  const key = generateKey(prefix, ext);

  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: { uploadedBy: userId, uploadedAt: new Date().toISOString() },
  });

  return {
    key,
    url: `${R2_PUBLIC_BASE}/${key}`,
    size: body.byteLength,
    contentType,
  };
}

export async function deleteFromR2(env: Env, key: string): Promise<void> {
  await env.BUCKET.delete(key);
}

export async function getFromR2(
  env: Env,
  key: string,
): Promise<R2ObjectBody | null> {
  return env.BUCKET.get(key);
}

export async function listR2(
  env: Env,
  prefix: string,
  limit = 50,
): Promise<{ key: string; size: number; uploaded: string }[]> {
  const listed = await env.BUCKET.list({ prefix, limit });
  return listed.objects.map((o) => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded.toISOString(),
  }));
}

export function publicUrl(key: string): string {
  return `${R2_PUBLIC_BASE}/${key}`;
}
