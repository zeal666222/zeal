// packages/database/src/client.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Client-safe database exports
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️  DO NOT import "next/headers" or any server-only module here.
//     This file is bundled into client components.
// ═══════════════════════════════════════════════════════════════════════════════

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zeal/types";

export * from "@zeal/types";

// ─── Anon (public reads, browser-safe) ───────────────────────────────────────
export function createAnonClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSupabaseClient(url, key);
}

// ─── Browser Client (SSR-aware, session persisted) ───────────────────────────
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserClient(): any {
  if (typeof window === "undefined") {
    throw new Error(
      "[@zeal/database] getBrowserClient() called on server. " +
      "Import from '@zeal/database/server' instead."
    );
  }
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("[@zeal/database] Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  browserClient = createBrowserClient<Database>(url, key);
  return browserClient;
}

// ─── createClient (browser-only in this barrel) ──────────────────────────────
// On the server, import { createClient } from '@zeal/database/server' instead.
export function createClient(): any {
  if (typeof window === "undefined") {
    throw new Error(
      "[@zeal/database] createClient() called on server. " +
      "Import from '@zeal/database/server' instead."
    );
  }
  return getBrowserClient();
}

// ─── Legacy Prisma shim (safe, no server imports) ────────────────────────────
export const prisma = new Proxy({}, {
  get: () => new Proxy({}, { get: () => () => Promise.resolve(null) }),
}) as any;

export const withTransaction = async <T>(cb: (tx: any) => Promise<T>): Promise<T> => cb(prisma);