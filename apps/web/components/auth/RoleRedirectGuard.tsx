"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// RoleRedirectGuard
// - Calls self_heal_user() on mount (backfills Consultant row if missing)
// - Redirects CLIENT_ADMIN users to the admin portal
// - Silent no-op for regular users
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";

export function RoleRedirectGuard() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@zeal/database");
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user || cancelled) return;

        // Self-heal: provision Consultant row + sync role
        try {
          await sb.rpc("self_heal_user");
        } catch (err) {
          console.warn("[RoleRedirectGuard] self_heal_user failed:", err);
        }

        const role = (user.app_metadata?.role as string | undefined) ?? "USER";
        if (role === "CLIENT_ADMIN") {
          const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
          if (adminUrl) {
            window.location.href = `${adminUrl}/consultant/dashboard`;
          }
        }
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
