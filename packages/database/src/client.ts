// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/client — browser-safe Supabase client
// ═══════════════════════════════════════════════════════════════════════════════
// Safe to import from anywhere (client or server). Uses the anon key which
// respects Row Level Security.
// ═══════════════════════════════════════════════════════════════════════════════

import {createBrowserClient} from "@supabase/ssr";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
import type { Database } from "@zeal/types";
export * from "@zeal/types";

// Singleton across HMR and tabs
declare global {
  // eslint-disable-next-line no-var
  var __ZEAL_SUPABASE_BROWSER__:
    | ReturnType<typeof createBrowserClient<Database>>
    | undefined;
}

let browserClient:
  | ReturnType<typeof createBrowserClient<Database>>
  | null = null;

/** Anonymous client — used server-side during static analysis. */
export function createAnonClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSupabaseClient(url, key);
}

/** Browser client — safe for "use client" files. */
export function getBrowserClient(): any {
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

  if (!url || !key) {
    if (typeof window === "undefined") {
      return createSupabaseClient(
        "http://127.0.0.1:54321",
        "build-dummy-key"
      );
    }
    throw new Error(
      "[@zeal/database] Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY"
    );
  }

  browserClient = createBrowserClient<Database>(url, key);
  if (typeof window !== "undefined") {
    globalThis.__ZEAL_SUPABASE_BROWSER__ = browserClient;
  }
  return browserClient;
}

/** Default export for legacy call sites. */
export function createClient(): any {
  return getBrowserClient();
}
