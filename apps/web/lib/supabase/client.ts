"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/lib/env";

let _client: SupabaseClient | null = null;

/** Returns a cached browser client, or `null` when env is unavailable. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!hasSupabaseEnv()) {
    if (env.isDev) {
      console.warn(
        "[supabase] env missing — auth & realtime disabled in this dev session.",
      );
    }
    return null;
  }
  _client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return _client;
}
