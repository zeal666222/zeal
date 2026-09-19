// packages/database/src/client.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Shared browser client — singleton via globalThis to prevent duplicate
// GoTrueClient instances across @zeal/database + @zeal/realtime.
// ═══════════════════════════════════════════════════════════════════════════════

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zeal/types";

export * from "@zeal/types";

declare global {
  // eslint-disable-next-line no-var
  var __ZEAL_SUPABASE_BROWSER__: ReturnType<typeof createBrowserClient<Database>> | undefined;
}

// ─── Anon client (server-safe, no persistence) ──────────────────────────────
export function createAnonClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSupabaseClient(url, key);
}

// ─── Singleton browser client ───────────────────────────────────────────────
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserClient(): any {
  // Reuse shared slot (prevents duplicate GoTrueClient warning)
  if (typeof window !== "undefined" && globalThis.__ZEAL_SUPABASE_BROWSER__) {
    return globalThis.__ZEAL_SUPABASE_BROWSER__;
  }
  if (browserClient) {
    if (typeof window !== "undefined") {
      globalThis.__ZEAL_SUPABASE_BROWSER__ = browserClient;
    }
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // SSR/prerender without env → dummy client
  if (!url || !key) {
    if (typeof window === "undefined") {
      return createSupabaseClient("http://127.0.0.1:54321", "build-dummy-key");
    }
    throw new Error("[@zeal/database] Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  browserClient = createBrowserClient<Database>(url, key);
  if (typeof window !== "undefined") {
    globalThis.__ZEAL_SUPABASE_BROWSER__ = browserClient;
  }
  return browserClient;
}

export function createClient(): any {
  return getBrowserClient();
}

// ─── Prisma shim (legacy compat) ────────────────────────────────────────────
export const prisma = new Proxy({}, {
  get: () => new Proxy({}, { get: () => () => Promise.resolve(null) }),
}) as any;

export const withTransaction = async <T>(cb: (tx: any) => Promise<T>): Promise<T> =>
  cb(prisma);
