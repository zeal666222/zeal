import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass explicitly authorized API routes (handled by backend API guards)
  if (
    pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    return NextResponse.next();
  }

  // 2. Initialize the base response
  let supabaseResponse = NextResponse.next({ request });

  // 3. Initialize the Supabase Server Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update incoming request cookies so subsequent Server Components see the rotated token instantly
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          // Re-initialize the response to flush headers safely without destroying existing ones
          supabaseResponse = NextResponse.next({ request });
          
          // Attach the new tokens to the outgoing browser response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 4. Force Token Evaluation
  // We explicitly call getUser() instead of getSession() to guarantee a secure, 
  // cryptographically verified check that triggers the setAll token rotation if expired.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any file with an extension (e.g., .svg, .png, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
