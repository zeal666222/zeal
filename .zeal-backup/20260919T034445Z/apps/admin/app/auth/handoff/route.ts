// apps/admin/app/auth/handoff/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL ADMIN — Cross-Domain Auth Handoff Receiver
// ─────────────────────────────────────────────────────────────────────────────
// apps/web generates a Supabase magic-link token via generateLink() and redirects
// the browser here with ?token_hash=...&type=magiclink.
//
// We consume the token with verifyOtp() — which creates a session cookie on
// THIS domain (zeal-admin-rose.vercel.app). Then we role-gate and redirect.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "magiclink";

  const loginUrl = new URL("/login", req.url);

  if (!tokenHash) {
    loginUrl.searchParams.set("error", "missing_token");
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* RSC — safe */ }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.verifyOtp({
    // Supabase expects the raw token hash
    token_hash: tokenHash,
    type: type as "magiclink",
  });

  if (error || !data.user) {
    console.warn("[handoff] verifyOtp failed:", error?.message);
    loginUrl.searchParams.set("error", "handoff_failed");
    return NextResponse.redirect(loginUrl);
  }

  // Resolve canonical role from User table
  const { data: profile } = await supabase
    .from("User")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = (profile?.role as string) ?? "USER";

  if (ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }
  if (role === "CLIENT_ADMIN") {
    return NextResponse.redirect(new URL("/consultant/dashboard", req.url));
  }

  // Not authorized — clear session and bounce
  await supabase.auth.signOut();
  loginUrl.searchParams.set("error", "not_authorized");
  return NextResponse.redirect(loginUrl);
}
