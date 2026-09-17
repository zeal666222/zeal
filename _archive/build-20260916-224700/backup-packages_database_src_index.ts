import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@zeal/types';

export * from '@zeal/types';

export function createAdminClient() {
  // Safe build-time fallbacks for Next.js SSG prerendering
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-dummy-service-key";

  return createSupabaseClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";
  return createSupabaseClient<Database>(supabaseUrl, anonKey);
}

export type TypedSupabaseClient = ReturnType<typeof createAdminClient>;

// Legacy Shim for Prisma methods
export const prisma = new Proxy({}, {
  get: () => new Proxy({}, {
    get: () => () => Promise.resolve(null)
  })
}) as any;

export const withTransaction = async <T>(cb: (tx: any) => Promise<T>): Promise<T> => {
  return cb(prisma);
};

// ============================================================================
// REAL SUPABASE SSR IMPLEMENTATIONS FOR LEGACY ROUTES
// ============================================================================
export const getAdminClient = () => createAdminClient();

export const createServerClientFromCookies = async () => {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-dummy-key";

  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {} // Read-only access for legacy route wrappers
    }
  }) as any;
};

export const getUserId = async () => {
  const supabase = await createServerClientFromCookies();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) throw new Error("Unauthorized: Invalid Session");
  return data.user.id;
};
