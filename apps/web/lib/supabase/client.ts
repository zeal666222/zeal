"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserClient } from "@zeal/database/client";
import { env, hasSupabaseEnv } from "@/lib/env";

let _warned = false;

/**
 * Returns the shared browser Supabase client (the same instance used by
 * @zeal/realtime and @zeal/database — separate clients on the same auth
 * storage key trigger GoTrue "multiple instances" conflicts).
 * Returns `null` when env is unavailable.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!hasSupabaseEnv()) {
    if (env.isDev && !_warned) {
      _warned = true;
      console.warn(
        "[supabase] env missing — auth & realtime disabled in this dev session.",
      );
    }
    return null;
  }
  return getBrowserClient() as SupabaseClient;
}
