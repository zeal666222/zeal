import { createAdminClient } from "@zeal/database/server";
import type { StorageAdapter, UploadParams, UploadResult } from "./adapter";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "zeal-uploads";

export function createSupabaseStorageAdapter(): StorageAdapter | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const client = createAdminClient();

  return {
    async upload({ key: objectKey, body, contentType }: UploadParams): Promise<UploadResult> {
      const { error } = await client.storage
        .from(BUCKET)
        .upload(objectKey, body, { contentType, upsert: false });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      return { url: this.publicUrl(objectKey), key: objectKey };
    },

    async delete(objectKey: string): Promise<void> {
      const { error } = await client.storage.from(BUCKET).remove([objectKey]);
      if (error) throw new Error(`Storage delete failed: ${error.message}`);
    },

    async getSignedUrl(objectKey: string, expiresIn = 3600): Promise<string> {
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(objectKey, expiresIn);
      if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? "no data"}`);
      return data.signedUrl;
    },

    publicUrl(objectKey: string): string {
      return `${url}/storage/v1/object/public/${BUCKET}/${objectKey}`;
    },
  };
}
