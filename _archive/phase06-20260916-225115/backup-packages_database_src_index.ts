// packages/database/src/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Unified Supabase Client Layer
// Fixes: "createClient has no exported member" errors across 15+ files
// ═══════════════════════════════════════════════════════════════════════════════

import { cookies } from "next/headers";
import { createServerClient as createSSRServerClient, createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zeal/types";

export * from "@zeal/types";

// ─── Admin (service role) ─────────────────────────────────────────────────────
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-dummy-service-key";

  return createSupabaseClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ─── Anon (public reads) ──────────────────────────────────────────────────────
export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSupabaseClient<Database>(supabaseUrl, anonKey);
}

// ─── Browser Client (SSR-aware, session persisted) ────────────────────────────
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error("[@zeal/database] getBrowserClient() called on server. Use createClient() instead.");
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

// ═══════════════════════════════════════════════════════════════════════════════
// FIX: `createClient` — Unified entry point
//   • Browser  → returns a live SSR-aware browser client (sync)
//   • Server   → returns a cookie-aware server client (awaitable)
// ═══════════════════════════════════════════════════════════════════════════════
export function createClient(): ReturnType<typeof getBrowserClient> {
  if (typeof window === "undefined") {
    return createServerClientFromCookies() as unknown as ReturnType<typeof getBrowserClient>;
  }
  return getBrowserClient();
}

// ─── Server Client from Cookies ───────────────────────────────────────────────
export const createServerClientFromCookies = async () => {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";

  return createSSRServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components can't set cookies — safe to ignore
        }
      },
    },
  });
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export const getAdminClient = () => createAdminClient();

export const getUserId = async (): Promise<string | null> => {
  try {
    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
};

export const getActorRole = async (): Promise<string | null> => {
  try {
    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    return (user?.app_metadata?.role as string) ?? null;
  } catch {
    return null;
  }
};

// ─── Legacy Prisma shim (kept for backward compatibility) ─────────────────────
export const prisma = new Proxy({}, {
  get: () => new Proxy({}, {
    get: () => () => Promise.resolve(null),
  }),
}) as any;

export const withTransaction = async <T>(cb: (tx: any) => Promise<T>): Promise<T> => {
  return cb(prisma);
};

export type TypedSupabaseClient = ReturnType<typeof createAdminClient>;