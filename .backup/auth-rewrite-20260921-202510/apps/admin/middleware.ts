import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login", "/register", "/auth/callback", "/auth/handoff",
  "/not-found", "/terms", "/privacy",
];

const ADMIN_CONSOLE_PREFIXES = [
  "/dashboard", "/users", "/consultants", "/verification", "/bookings",
  "/withdrawals", "/analytics", "/broadcast", "/content", "/ai-consultants",
  "/recordings", "/wallet", "/settings",
];

const CONSULTANT_PREFIX = "/consultant";
const ADMIN_ROLES = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * RSC Prefetch Detection (Fixes CORS ERR_FAILED)
 * Prevents Next.js from attempting cross-origin redirects on background data fetches.
 */
function isPrefetchOrRsc(request: NextRequest): boolean {
  const h = request.headers;
  const url = request.nextUrl;
  return (
    url.searchParams.has("_rsc") ||
    h.get("rsc") === "1" ||
    h.get("next-router-prefetch") === "1" ||
    h.get("purpose") === "prefetch"
  );
}

/** Same-origin 204 prevents the browser from crashing on cross-origin fetch redirects */
function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass explicitly authorized API routes
  if (pathname.startsWith("/api/") && request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.next();
  }

  // 2. Initialize base response
  let response = NextResponse.next({ request });

  // 3. Initialize Supabase & Sync Cookies (Fixes 400 Bad Request Token Reuse)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update incoming request cookies so subsequent Server Components see the new token instantly
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          // Re-initialize the response to safely flush headers without destroying existing ones
          response = NextResponse.next({ request });
          
          // Attach the rotated tokens to the outgoing browser response
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 4. Force Cryptographic Token Evaluation
  // getUser() actively pings GoTrue, securely triggering the setAll rotation block if expired.
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // 5. Inject Enterprise Security Headers
  const CSP = [
    "default-src 'self'",
    "img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ");

  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // 6. API Proxy Handling (Attach Bearer & Headers)
  if (pathname.startsWith("/api/")) {
    if (user && !authError) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("Authorization", `Bearer ${session.access_token}`);
        requestHeaders.set("X-Admin-Proxy", "1");
        
        const apiResponse = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.getAll().forEach((c) => apiResponse.cookies.set(c));
        apiResponse.headers.set("Content-Security-Policy", CSP);
        
        return apiResponse;
      }
    }
    return response;
  }

  // 7. Public Route Bypass
  if (isPublic(pathname)) return response;

  // 8. Auth Wall
  if (!user || authError) {
    if (isPrefetchOrRsc(request)) return noContent();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // 9. Role-Based Access Control (RBAC) & Routing
  const role = (user.app_metadata?.role as string) ?? "USER";
  const isAdmin = ADMIN_ROLES.includes(role);
  const isConsultant = role === "CLIENT_ADMIN";

  // Consultant hitting an admin console route -> bounce to studio
  if (isConsultant && ADMIN_CONSOLE_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }

  // Admin hitting a consultant route -> bounce to console
  if (isAdmin && pathname.startsWith(CONSULTANT_PREFIX)) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Plain USER -> cross-origin redirect to web app
  if (!isAdmin && !isConsultant) {
    if (isPrefetchOrRsc(request)) return noContent();
    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
    return NextResponse.redirect(new URL("/login?error=not_authorized", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
