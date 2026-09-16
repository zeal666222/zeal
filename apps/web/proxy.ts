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
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/register')
  const isPublicRoute = path === '/'
  
  if (path.startsWith('/api') || path.startsWith('/_next') || path.match(/\.(.*)$/)) {
    return response
  }

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'user'

    if (path.startsWith('/admin') && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/consultant') && role !== 'consultant' && !['admin', 'superadmin', 'super_admin'].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/explore'
      return NextResponse.redirect(url)
    }

    if (isAuthRoute) {
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
