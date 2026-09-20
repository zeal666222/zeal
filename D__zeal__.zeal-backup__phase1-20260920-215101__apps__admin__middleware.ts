import { NextResponse, type NextRequest } from "next/server";
import {createServerClient} from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login", "/register", "/auth/callback", "/auth/handoff", "/not-found",
  // ZEAL_CORS_FIX — legal pages linked from /register; no auth required
  "/terms", "/privacy",
];

const ADMIN_CONSOLE_PREFIXES = [
  "/dashboard", "/users", "/consultants", "/verification", "/bookings",
  "/withdrawals", "/analytics", "/broadcast", "/content", "/ai-consultants",
  "/recordings", "/wallet", "/settings",
];

const CONSULTANT_PREFIX = "/consultant";
const ADMIN_ROLES = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export async function middleware(request: NextRequest) {

// ZEAL_CORS_FIX — detect Next.js RSC prefetches / speculative fetches.
// Cross-domain redirects on these cause CORS errors because the browser
// refuses to follow a 307 to another origin inside a fetch().
function isPrefetchOrRsc(request: NextRequest): boolean {
  const h = request.headers;
  return (
    h.get("next-router-prefetch") === "1" ||
    h.get("purpose") === "prefetch" ||
    h.get("rsc") === "1"
  );
}

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // API proxy: attach bearer token
  if (pathname.startsWith("/api/")) {
    if (user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("Authorization", `Bearer ${session.access_token}`);
        requestHeaders.set("X-Admin-Proxy", "1");
        const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.getAll().forEach((c) => apiResponse.cookies.set(c));
        return apiResponse;
      }
    }
    return response;
  }

  if (isPublic(pathname)) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const role = (user.app_metadata?.role as string) ?? "USER";
  const isAdmin = ADMIN_ROLES.includes(role);
  const isConsultant = role === "CLIENT_ADMIN";

  // Consultant → admin console: bounce to studio
  if (isConsultant && ADMIN_CONSOLE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }
  // Admin → consultant studio: bounce to console
  if (isAdmin && pathname.startsWith(CONSULTANT_PREFIX)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  // Plain USER → bounce to web
  // ZEAL_CORS_FIX — never redirect a prefetch off-domain

  if (!isAdmin && !isConsultant) {

    if (isPrefetchOrRsc(request)) {

      return new NextResponse(null, { status: 204 });

    }

    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
  
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
