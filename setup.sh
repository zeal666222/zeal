#!/usr/bin/env bash
# ==============================================================================
# PROJECT ZEAL — PROXY MIDDLEWARE SYNTAX FIX
# ==============================================================================
set -euo pipefail

INFO="\033[1;34m[INFO]\033[0m"
SUCCESS="\033[1;32m[SUCCESS]\033[0m"
ERR_MSG="\033[1;31m[ERROR]\033[0m"

echo -e "${INFO} 1. Fixing syntax error in Edge Middleware (apps/web/proxy.ts)..."
cat << 'EOF' > apps/web/proxy.ts
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
EOF

echo -e "${INFO} 2. Running Strict TypeScript Type Check..."
if npx tsc --noEmit --project apps/web/tsconfig.json; then
    echo -e "${SUCCESS} TypeScript verified without errors!"
else
    echo -e "${ERR_MSG} Type checking failed."
    exit 1
fi

echo -e "${INFO} 3. Executing Next.js Production Build..."
if npm run build; then
    echo -e "${SUCCESS} Production build passed cleanly!"
    
    echo -e "${INFO} 4. Committing and Pushing Fix..."
    git add -A
    git commit -m "fix(zeal): correct cookie removal syntax in proxy middleware" || true
    git push -u origin main
    
    echo -e "${SUCCESS} ====================================================================="
    echo -e "${SUCCESS} PROXY MIDDLEWARE FIXED AND OAUTH ARCHITECTURE FULLY DEPLOYED!"
    echo -e "${SUCCESS} ====================================================================="
else
    echo -e "${ERR_MSG} Build failed. Review output above."
    exit 1
fi