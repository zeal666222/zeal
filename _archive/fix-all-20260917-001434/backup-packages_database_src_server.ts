import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export async function createServerClientFromCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("[@zeal/database] Missing Supabase env (server)");

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set(name: string, value: string, options: Record<string, unknown>) {
        try { cookieStore.set({ name, value, ...options }); } catch { /* read-only */ }
      },
      remove(name: string, options: Record<string, unknown>) {
        try { cookieStore.set({ name, value: "", ...options }); } catch { /* read-only */ }
      },
    },
  });
}

export async function getUserId(): Promise<string | null> {
  try {
    const sb = await createServerClientFromCookies();
    const { data: { user } } = await sb.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

export async function getActorRole(): Promise<string | null> {
  try {
    const sb = await createServerClientFromCookies();
    const { data: { user } } = await sb.auth.getUser();
    return (user?.app_metadata?.role as string) ?? null;
  } catch { return null; }
}
