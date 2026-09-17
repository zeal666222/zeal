// apps/web/middleware.ts — Session refresh + route guards + MFA enforcement
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Roles that must complete MFA before accessing any protected route
// (once they've enrolled at least one TOTP factor)
const MFA_REQUIRED_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT"];

const PUBLIC_ROUTES = [
  "/", "/explore", "/services", "/ai-astrologers", "/consultant", "/white-label",
  "/zeal", "/login", "/register", "/auth/callback", "/auth/verify-invite",
  "/payment/success", "/payment/failure", "/not-found",
];
const AUTH_REQUIRED_PREFIXES = [
  "/chat", "/wallet", "/bookings", "/booking", "/profile",
  "/notifications", "/sparks", "/create", "/post", "/debug", "/session",
];
const CONSULTANT_REQUIRED_PREFIXES = [
  "/consultant/dashboard", "/consultant/bookings", "/consultant/clients",
  "/consultant/earnings", "/consultant/availability", "/consultant/settings",
  "/consultant/onboarding", "/consultant/pending",
];
const ADMIN_REQUIRED_PREFIXES = ["/admin"];

// Routes reachable even when MFA challenge is pending
const MFA_BYPASS_PATHS = ["/mfa-challenge", "/profile", "/login", "/api/auth", "/auth"];

const isPublic = (p: string) =>
  p === "/" || PUBLIC_ROUTES.some((r) => p === r || p.startsWith(r + "/"));
const requiresAuth = (p: string) =>
  AUTH_REQUIRED_PREFIXES.some((r) => p === r || p.startsWith(r + "/"));
const requiresConsultant = (p: string) =>
  CONSULTANT_REQUIRED_PREFIXES.some((r) => p === r || p.startsWith(r + "/"));
const requiresAdmin = (p: string) =>
  ADMIN_REQUIRED_PREFIXES.some((r) => p === r || p.startsWith(r + "/"));
const mfaBypass = (p: string) =>
  MFA_BYPASS_PATHS.some((r) => p === r || p.startsWith(r + "/"));

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return response;

  if (requiresAuth(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const rawRole = (user.app_metadata?.role as string | undefined) ?? "USER";
    const role = rawRole.length > 0 ? rawRole : "USER";

    // ─── MFA enforcement ────────────────────────────────────────────────────
    // Only enforced for MFA-required roles that have enrolled a TOTP factor.
    // If not enrolled yet, user passes through (they must enroll via /profile).
    // If enrolled, current session must be AAL2.
    if (MFA_REQUIRED_ROLES.includes(role) && !mfaBypass(pathname)) {
      try {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        const needsChallenge =
          aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1";

        if (needsChallenge) {
          const url = request.nextUrl.clone();
          url.pathname = "/mfa-challenge";
          url.searchParams.set("redirectedFrom", pathname);
          return NextResponse.redirect(url);
        }
      } catch (err) {
        // Fail-open on AAL check errors — do not lock users out
        console.warn("[middleware] AAL check failed:", err);
      }
    }

    // ─── Role guards ────────────────────────────────────────────────────────
    if (requiresConsultant(pathname)) {
      const isConsultant =
        role === "CLIENT_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN";
      if (!isConsultant) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    if (requiresAdmin(pathname)) {
      const isAdmin =
        role === "ADMIN" || role === "SUPER_ADMIN" ||
        role === "SUPPORT" || role === "VIEWER";
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
