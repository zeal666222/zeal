// apps/admin/middleware.ts
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL ADMIN — Middleware
//   • Refreshes Supabase session cookie
//   • Attaches Bearer token on /api/* before proxying to web
//   • Role-gates page routes (consultant + admin sections)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login",
  "/auth/handoff",
  "/auth/callback",
  "/not-found",
];
const ADMIN_ROLES = ["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];
const CONSULTANT_ROLES = ["CLIENT_ADMIN"];
const ALLOWED_ROLES = [...ADMIN_ROLES, ...CONSULTANT_ROLES];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
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
  const { pathname } = request.nextUrl;

  // ─── API proxy: attach admin's access token ────────────────────────────────
  if (pathname.startsWith("/api/")) {
    if (user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("Authorization", `Bearer ${session.access_token}`);
        requestHeaders.set("X-Admin-Proxy", "1");
        const apiResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.getAll().forEach((c) => apiResponse.cookies.set(c));
        return apiResponse;
      }
    }
    return response;
  }

  // ─── Public page routes ────────────────────────────────────────────────────
  if (isPublic(pathname)) return response;

  // ─── Not authenticated ─────────────────────────────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // ─── Role resolution ───────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("User")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) ?? "USER";

  if (!ALLOWED_ROLES.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "not_authorized");
    return NextResponse.redirect(url);
  }

  // Consultant accessing /admin/* → redirect to consultant dashboard
  if (CONSULTANT_ROLES.includes(role) && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
