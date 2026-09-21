// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/database/session — ONE source of truth for auth
// ═══════════════════════════════════════════════════════════════════════════════
// • Reads Supabase session from cookies
// • Reads role from the User table (single indexed SELECT)
// • Memoized per request via React cache()
// • No JWT claims, no app_metadata, no middleware, no races.
// ═══════════════════════════════════════════════════════════════════════════════

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AppRole =
  | "USER"
  | "CLIENT_ADMIN"
  | "SUPPORT"
  | "ADMIN"
  | "SUPER_ADMIN"
  | "VIEWER"
  | "AI";

export const ROLE_LEVEL: Record<AppRole, number> = {
  VIEWER: 10,
  USER: 20,
  CLIENT_ADMIN: 40,
  SUPPORT: 50,
  ADMIN: 80,
  SUPER_ADMIN: 100,
  AI: 0,
};

export const ADMIN_PORTAL_ROLES: ReadonlySet<AppRole> = new Set([
  "CLIENT_ADMIN",
  "SUPPORT",
  "ADMIN",
  "SUPER_ADMIN",
  "VIEWER",
]);

export interface SessionResult {
  user: User | null;
  role: AppRole | null;
  supabase: SupabaseClient;
}

async function readSession(): Promise<SessionResult> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC context — read-only */
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, role: null, supabase };
  }

  // Single source of truth: the database. Indexed on primary key.
  const { data: profile } = await supabase
    .from("User")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = ((profile?.role as AppRole | undefined) ?? "USER") as AppRole;

  return { user, role, supabase };
}

/** Memoized per request — call it anywhere, it runs once. */
export const getSession = cache(readSession);

/** Convenience guard — throws via redirect() when anonymous. */
export async function requireSession() {
  const { getSession: get } = await import("./session");
  const s = await get();
  if (!s.user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return s as SessionResult & { user: User; role: AppRole };
}

/** Role-level check with named minimum. */
export async function requireRole(min: AppRole) {
  const s = await requireSession();
  if (ROLE_LEVEL[s.role] < ROLE_LEVEL[min]) {
    const { forbidden } = await import("next/navigation");
    forbidden();
  }
  return s;
}

/** Portal check — is this user allowed into the admin console? */
export async function requireAdminPortal() {
  const s = await getSession();
  if (!s.user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  if (!ADMIN_PORTAL_ROLES.has(s.role!)) {
    const { redirect } = await import("next/navigation");
    redirect("/login?error=wrong_portal");
  }
  return s as SessionResult & { user: User; role: AppRole };
}
