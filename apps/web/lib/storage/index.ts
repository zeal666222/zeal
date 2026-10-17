// Unified storage export
export * from "./adapter";
export { createR2Adapter } from "./r2";
export { createSupabaseStorageAdapter } from "./supabase";

import {createR2Adapter} from "./r2";
import {createSupabaseStorageAdapter} from "./supabase";
import type { StorageAdapter } from "./adapter";

let cachedAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter | null {
  if (cachedAdapter) return cachedAdapter;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (accountId && accessKeyId && secretAccessKey && bucket && publicUrl) {
    cachedAdapter = createR2Adapter({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicUrl,
    });
    return cachedAdapter;
  }

  cachedAdapter = createSupabaseStorageAdapter();
  if (cachedAdapter) return cachedAdapter;

  console.warn("[Storage] No storage backend configured (R2 or Supabase)");
  return null;
}

export async function uploadFile(
  key: string,
  body: Buffer | Blob | string,
  contentType: string,
): Promise<string | null> {
  const adapter = getStorageAdapter();
  if (!adapter) return null;
  const result = await adapter.upload({ key, body, contentType });
  return result.url;
}

// Posts created before the upload flow stored bare object keys in mediaUrls;
// resolve them to the active backend's public URL so next/image can render them.
export function normalizeMediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const adapter = getStorageAdapter();
  return adapter ? adapter.publicUrl(value) : value;
}

// BATCH1_APPLIED
