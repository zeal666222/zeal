import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("[@zeal/database] Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }
  cached = createBrowserClient<Database>(url, key);
  return cached;
}
