// apps/web/middleware.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Session Refresh & Route Guards
// Refreshes Supabase JWT on every request; prevents mid-session logout
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/",
  "/explore",
  "/services",
  "/ai-astrologers",
  "/consultant",
  "/white-label",
  "/zeal",
  "/login",
  "/register",
  "/auth/callback",
  "/auth/verify-invite",
  "/payment/success",
  "/payment/failure",
  "/not-found",
];

const AUTH_REQUIRED_PREFIXES = [
  "/chat",
  "/wallet",
  "/bookings",
  "/booking",
  "/profile",
  "/notifications",
  "/sparks",
  "/sparks",
  "/sparks",
  "/explore",
  "/create",
  "/post",
  "/debug",
  "/session",
];

const CONSULTANT_REQUIRED_PREFIXES = [
  "/consultant/dashboard",
  "/consultant/bookings",
  "/consultant/clients",
  "/consultant/earnings",
  "/consultant/availability",
  "/consultant/settings",
  "/consultant/onboarding",
  "/consultant/pending",
];

const ADMIN_REQUIRED_PREFIXES = ["/admin"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
function requiresAuth(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
function requiresConsultant(pathname: string): boolean {
  return CONSULTANT_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
function requiresAdmin(pathname: string): boolean {
  return ADMIN_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
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
    const role = (user.app_metadata?.role as string) || "USER";

    if (requiresConsultant(pathname)) {
      const isConsultant =
        role === "CLIENT_ADMIN" || role === "HEALER" ||
        role === "ADMIN" || role === "SUPER_ADMIN";
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