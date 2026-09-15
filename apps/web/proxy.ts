import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// In Next.js 16, the function must be named 'proxy'
export async function proxy(request: NextRequest) {
  // Initialize the response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create the Edge-compatible Supabase Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 1. Fetch Secure Session
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register')
  const isPublicRoute = path === '/'
  
  // Allow API routes and static files to pass through safely
  if (path.startsWith('/api') || path.startsWith('/_next') || path.match(/\.(.*)$/)) {
    return response
  }

  // 2. Unauthenticated User Safeguards
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Authenticated User Safeguards & Role Checking
  if (user) {
    // Fetch user profile securely at the Edge
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarding_completed')
      .eq('id', user.id)
      .single()

    const role = profile?.role || 'user'
    const hasOnboarded = profile?.onboarding_completed || false

    // ONBOARDING ENFORCEMENT: Trap new users until they setup their account
    if (!hasOnboarded && path !== '/onboarding' && !isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // PREVENT BACKTRACKING: Stop onboarded users from going back to onboarding
    if (hasOnboarded && path === '/onboarding') {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    // ADMIN PROTECTION: Only allow Admins inside /admin
    if (path.startsWith('/admin') && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    // CONSULTANT PROTECTION: Only allow Consultants inside /consultant
    if (path.startsWith('/consultant') && role !== 'consultant' && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    // REDIRECT FROM AUTH: Send logged-in users away from /login or /register
    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      if (['admin', 'superadmin', 'super_admin'].includes(role)) {
        url.pathname = '/admin/dashboard'
      } else if (role === 'consultant') {
        url.pathname = '/consultant/dashboard'
      } else {
        url.pathname = '/explore'
      }
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
