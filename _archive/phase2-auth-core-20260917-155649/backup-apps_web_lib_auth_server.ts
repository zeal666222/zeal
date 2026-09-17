import { createClient } from "@zeal/database/server";

/**
 * Returns the authenticated user's ID, or null.
 * Never throws.
 *
 * Special handling for Next.js build-time prerendering:
 *   When `cookies()` throws a DYNAMIC_SERVER_USAGE error, we treat it as
 *   "not authenticated" instead of logging a scary error.
 */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user?.id ?? null;
  } catch (err) {
    // Next.js throws during static prerender when cookies() is called.
    // This is expected behavior – the page will be rendered dynamically.
    if (err instanceof Error && err.message.includes("Dynamic server usage")) {
      return null;
    }

    // Only log unexpected errors in development
    if (process.env.NODE_ENV === "development") {
      console.warn("[getUserId] Unexpected error:", err);
    }
    return null;
  }
}

/**
 * Full session (user + session object).
 * Never throws.
 */
export async function getServerSession() {
  try {
    const supabase = await createClient();
    if (!supabase) return { user: null, session: null };

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return { user: null, session: null };

    return {
      user: session?.user ?? null,
      session: session ?? null,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Dynamic server usage")) {
      return { user: null, session: null };
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("[getServerSession] Unexpected error:", err);
    }
    return { user: null, session: null };
  }
}
