// apps/web/middleware.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL WEB — Middleware
//   • Refreshes Supabase session
//   • Bearer-authed /api/* requests bypass (handled by api-guard)
//   • Route guards: /chat, /wallet, /bookings, /profile, etc.
//   • Consultant pages redirect to admin portal
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";


// ZEAL_CORS_FIX — detect Next.js RSC prefetches so we never redirect them
// to another origin (browsers block cross-origin 307s inside fetch()).
function isPrefetchOrRsc(request: NextRequest): boolean {
  const h = request.headers;
  return (
    h.get("next-router-prefetch") === "1" ||
    h.get("purpose") === "prefetch" ||
    h.get("rsc") === "1"
  );
}
import {createServerClient} from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/", "/explore", "/services", "/ai-astrologers", "/consultant", "/white-label",
  "/login", "/register", "/auth/callback", "/auth/verify-invite",
  "/payment/success", "/payment/failure", "/not-found",
];

const AUTH_REQUIRED_PREFIXES = [
  "/chat", "/wallet", "/bookings", "/booking", "/profile",
  "/notifications", "/sparks", "/create", "/post", "/debug", "/session",
];

// Consultant-facing pages no longer live in apps/web
const CONSULTANT_REDIRECT_PREFIXES = [
  "/consultant/dashboard",
  "/consultant/bookings",
  "/consultant/clients",
  "/consultant/earnings",
  "/consultant/availability",
  "/consultant/settings",
  "/consultant/onboarding",
  "/consultant/pending",
];

const isPublic = (p: string) =>
  p === "/" || PUBLIC_ROUTES.some((r) => p === r || p.startsWith(r + "/"));
const requiresAuth = (p: string) =>
  AUTH_REQUIRED_PREFIXES.some((r) => p === r || p.startsWith(r + "/"));
const requiresConsultantRedirect = (p: string) =>
  CONSULTANT_REDIRECT_PREFIXES.some((r) => p === r || p.startsWith(r + "/"));

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bearer-authed API calls bypass (api-guard handles them)
  if (
    pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Consultant pages → redirect to admin portal
  // ZEAL_CORS_FIX — skip cross-domain redirect for prefetches

  if (requiresConsultantRedirect(pathname)) {

    if (isPrefetchOrRsc(request)) {

      return new NextResponse(null, { status: 204 });

    }

    const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
    if (adminUrl) {
      const suffix = pathname.replace(/^\/consultant/, "");
      return NextResponse.redirect(`${adminUrl}/consultant${suffix}`);
    }
  }

  if (isPublic(pathname)) return response;

  if (requiresAuth(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
