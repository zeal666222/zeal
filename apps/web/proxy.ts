import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

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
          // FIXED: Changed `value, ''` to `value: ''` to satisfy strict object assignment
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  
  // Whitelist auth routes & OAuth callback routes
  const isAuthRoute = path.startsWith('/login') || 
                      path.startsWith('/register') || 
                      path.startsWith('/apply') ||
                      path.startsWith('/auth');
  
  // Public routes viewable by guests
  const isPublicRoute = path === '/' || 
                        path.startsWith('/explore') || 
                        path.startsWith('/services') ||
                        (path.startsWith('/consultant/') && !path.startsWith('/consultant/dashboard'));

  // Static Assets Bypass
  if (path.startsWith('/api') || path.startsWith('/_next') || path.match(/\.(.*)$/)) {
    return response
  }

  // Gateway: If guest tries to access protected route
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(url)
  }

  // Dynamic Routing for Authenticated Users
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'user'

    if (path.startsWith('/admin') && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/consultant/dashboard') && role !== 'consultant' && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    // Keep logged-in users out of /login or /register
    if (path === '/login' || path === '/register') {
      const url = request.nextUrl.clone()
      if (['admin', 'superadmin', 'super_admin'].includes(role)) url.pathname = '/admin/dashboard'
      else if (role === 'consultant') url.pathname = '/consultant/dashboard'
      else url.pathname = '/explore'
      return NextResponse.redirect(url)
    }
  }
  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
