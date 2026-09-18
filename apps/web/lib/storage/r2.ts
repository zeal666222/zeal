// apps/web/lib/storage/r2.ts
// Cloudflare R2 storage adapter — SigV4 signed requests (Web Crypto)
import type { StorageAdapter, UploadParams, UploadResult } from "./adapter";

interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const enc = new TextEncoder();

/**
 * TS 5.9 + @types/node ≥20 made Uint8Array generic. crypto.subtle expects
 * BufferSource = ArrayBufferView<ArrayBuffer> | ArrayBuffer, but plain
 * Uint8Array is ArrayBufferView<ArrayBufferLike>. Cast after guaranteeing
 * the underlying buffer is a real ArrayBuffer.
 */
function toBufferSource(bytes: Uint8Array): BufferSource {
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes as unknown as BufferSource;
  }
  // Defensive: SharedArrayBuffer path — copy into a fresh ArrayBuffer
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy as unknown as BufferSource;
}

async function importHmacKey(raw: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(bytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await importHmacKey(key);
  return crypto.subtle.sign("HMAC", cryptoKey, toBufferSource(enc.encode(data)));
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", toBufferSource(bytes));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signRequest(opts: {
  method: string;
  url: URL;
  body: Uint8Array | string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  service?: string;
  headers?: Record<string, string>;
}): Promise<Record<string, string>> {
  const region = opts.region ?? "auto";
  const service = opts.service ?? "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const bodyBytes = typeof opts.body === "string" ? enc.encode(opts.body) : opts.body;
  const payloadHash = await sha256Hex(bodyBytes);

  const headers: Record<string, string> = {
    host: opts.url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(opts.headers ?? {}),
  };

  const sortedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();

  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${(headers[k] ?? headers[k.toLowerCase()] ?? "").trim()}\n`)
    .join("");

  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    opts.method,
    opts.url.pathname,
    opts.url.search.slice(1),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(enc.encode(`AWS4${opts.secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signatureBytes = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { ...headers, Authorization: authorization };
}

export function createR2Adapter(options: R2Options): StorageAdapter {
  const endpoint = `https://${options.accountId}.r2.cloudflarestorage.com`;

  async function putObject(
    key: string,
    body: Uint8Array | string,
    contentType?: string,
    metadata?: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(`${endpoint}/${options.bucket}/${key}`);
    const extraHeaders: Record<string, string> = {};
    if (contentType) extraHeaders["content-type"] = contentType;
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        extraHeaders[`x-amz-meta-${k.toLowerCase()}`] = v;
      }
    }
    const signed = await signRequest({
      method: "PUT",
      url,
      body,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      headers: extraHeaders,
    });
    return fetch(url.toString(), {
      method: "PUT",
      headers: signed,
      body: body as BodyInit,
    });
  }

  return {
    async upload(params: UploadParams): Promise<UploadResult> {
      let body: Uint8Array | string;
      if (params.body instanceof Uint8Array) {
        body = params.body;
      } else if (typeof params.body === "string") {
        body = params.body;
      } else if (params.body instanceof Blob) {
        body = new Uint8Array(await params.body.arrayBuffer());
      } else {
        throw new Error("[R2] Unsupported body type");
      }

      const res = await putObject(params.key, body, params.contentType, params.metadata);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 200)}`);
      }
      return { url: `${options.publicUrl}/${params.key}`, key: params.key };
    },

    async delete(key: string): Promise<void> {
      const url = new URL(`${endpoint}/${options.bucket}/${key}`);
      const signed = await signRequest({
        method: "DELETE",
        url,
        body: "",
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      });
      const res = await fetch(url.toString(), { method: "DELETE", headers: signed });
      if (!res.ok && res.status !== 404) {
        throw new Error(`R2 delete failed: ${res.statusText}`);
      }
    },

    async getSignedUrl(key: string, _expiresIn = 3600): Promise<string> {
      return `${options.publicUrl}/${key}`;
    },

    publicUrl(key: string): string {
      return `${options.publicUrl}/${key}`;
    },
  };
}
