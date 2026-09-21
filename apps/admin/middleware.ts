import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/auth/callback",
  "/auth/handoff",
  "/not-found",
  "/terms",
  "/privacy",
];

const ADMIN_CONSOLE_PREFIXES = [
  "/dashboard",
  "/users",
  "/consultants",
  "/verification",
  "/bookings",
  "/withdrawals",
  "/analytics",
  "/broadcast",
  "/content",
  "/ai-consultants",
  "/recordings",
  "/wallet",
  "/settings",
  "/audit",
  "/impersonate",
  "/sessions",
];

const ADMIN_ROLES = new Set(["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"]);

const AUTH_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isPrefetchOrRsc(req: NextRequest): boolean {
  const h = req.headers;
  const search = req.nextUrl.search || "";
  return (
    search.includes("_rsc=") ||
    h.get("rsc") === "1" ||
    h.get("next-router-prefetch") === "1" ||
    h.get("x-middleware-prefetch") === "1" ||
    h.get("purpose") === "prefetch"
  );
}

function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://zeal-web-red.vercel.app https://api.groq.com https://apihub.agnes-ai.com https://vitals.vercel-insights.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function harden(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!AUTH_ENABLED) {
    if (process.env.NODE_ENV === "production") {
      console.error("[admin/middleware] Supabase env missing in production");
      return harden(
        new NextResponse("Configuration error: Supabase env missing", {
          status: 500,
        }),
      );
    }
    return NextResponse.next();
  }

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
        getAll() {
          return request.cookies.getAll();
        },
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  harden(response);

  if (isPublic(pathname)) return response;

  if (!user || authError) {
    if (isPrefetchOrRsc(request)) return noContent();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const role = (user.app_metadata?.role as string | undefined) ?? "USER";
  const isAdmin = ADMIN_ROLES.has(role);
  const isConsultant = role === "CLIENT_ADMIN";

  if (
    isConsultant &&
    ADMIN_CONSOLE_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }

  if (isAdmin && pathname.startsWith("/consultant")) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAdmin && !isConsultant) {
    if (isPrefetchOrRsc(request)) return noContent();
    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
    return NextResponse.redirect(
      new URL("/login?error=not_authorized", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
