import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  // 1. Instantly bypass static files and APIs to save compute
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api') || path.startsWith('/_next') || path.match(/\.(.*)$/)) {
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({ request: { headers: request.headers } })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    const isAuthRoute = path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/auth/callback');
    const isPublicRoute = path === '/' || path.startsWith('/explore') || path.startsWith('/services') || (path.startsWith('/consultant/') && !path.startsWith('/consultant/dashboard'));

    // 2. GUEST GATEWAY: Securely bounce unauthenticated users
    if (!user && !isAuthRoute && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirectedFrom', path);
      return NextResponse.redirect(url);
    }

    // 3. AUTHENTICATED ROUTING (Optimized)
    if (user) {
      // LAZY DB CHECK: Only query the database if they are trying to hit a restricted route or an auth route (to bounce them).
      // This makes standard navigation (Explore, Chat, Profiles) 10x faster.
      const needsRoleVerification = path.startsWith('/admin') || path.startsWith('/consultant/dashboard') || isAuthRoute;
      
      let role = 'user';
      
      if (needsRoleVerification) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        role = profile?.role || 'user';
      }

      // Role Bleed Protection
      if (path.startsWith('/admin') && !['admin', 'superadmin', 'super_admin'].includes(role)) {
        return NextResponse.redirect(new URL('/explore', request.url));
      }
      
      if (path.startsWith('/consultant/dashboard') && role !== 'consultant' && !['admin', 'superadmin', 'super_admin'].includes(role)) {
        return NextResponse.redirect(new URL('/explore', request.url));
      }

      // Bounce authenticated users away from Login/Register dynamically
      if (path === '/login' || path === '/register') {
        if (['admin', 'superadmin', 'super_admin'].includes(role)) return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        if (role === 'consultant') return NextResponse.redirect(new URL('/consultant/dashboard', request.url));
        return NextResponse.redirect(new URL('/explore', request.url));
      }
    }

    return response;
  } catch (error) {
    // FAIL-SAFE: If Supabase times out, default to safe rendering rather than crashing the Edge runtime
    console.error("[MIDDLEWARE_ERROR]:", error);
    return response;
  }
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
