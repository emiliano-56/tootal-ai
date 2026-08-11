import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  HOME_ROUTE,
  isRouteAllowed,
  isGuardedRoute,
  signInRouteFor,
  type Role,
} from '@/lib/auth/rbac'
import {
  DEFAULT_PORTAL,
  PORTAL_PATHS,
  isPortalPath,
  resolveRoleFromProfile,
} from '@/lib/auth/portals'

/**
 * Session refresh + role-based route guarding.
 *
 * This runs before any page renders, which is the point: previously `/admin`
 * was gated by a hardcoded email comparison inside a client component, so the
 * check could be removed in devtools. Here the role is read server-side from
 * the database on every request.
 */

// Reachable while signed out, and matched on the whole path: the portal roots
// double as consoles once signed in, so /superadmin is public but
// /superadmin/users is not.
const PUBLIC_EXACT = ['/', ...PORTAL_PATHS]

// Public including everything beneath them.
//
// Two machine endpoints arrive with no session and no cookies, so redirecting
// them to a sign-in page would silently swallow the work they came to do:
// /api/ipn is the payment processor posting a sale, and /api/cron is the
// scheduler that drives Autopilot. Both authenticate with a shared secret of
// their own instead.
// /s is a share link. It is meant to be opened by strangers on Facebook, and
// every network fetches it signed out to build the preview card — a redirect
// to sign-in would turn every shared comic into a login screen.
//
// /api/social/callback is where a platform returns someone after they press
// Allow. Whether the session cookie survives that cross-site hop depends on
// SameSite rules we do not control, so the callback identifies the customer
// from its HMAC-signed `state` instead and does not need a session at all.
// Note the prefix stops at /callback: /api/social itself stays behind auth.
const PUBLIC_PREFIXES = [
  '/signup',
  '/support-1',
  '/auth',
  '/api/ipn',
  '/api/cron',
  '/api/social/callback',
  '/s',
  '/d',
  '/api/d',
]

function isPublicRoute(pathname: string) {
  if (PUBLIC_EXACT.includes(pathname)) return true

  return PUBLIC_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

/**
 * Routes with no session to check and none to refresh.
 *
 * Worth separating from `PUBLIC_PREFIXES`, which also holds pages a signed-in
 * visitor may reach. These four never involve a logged-in user at all:
 *
 *   /api/ipn              the payment processor, authenticated by shared secret
 *   /api/cron             the scheduler, likewise
 *   /api/social/callback  identifies the customer from a signed `state`
 *   /s                    a share link, opened by strangers and by every
 *                         social network's preview crawler
 *
 * Returning before any Supabase work saves two network round trips on each —
 * one of them to the auth service, not the database. On a share link that is
 * most of the response time, and a post doing well is a lot of crawler hits.
 */
// /d and /api/d are a delivery link: a buyer with no account, following a
// link from an email. Sending them to a sign-in page would make every file
// sold undeliverable.
const NO_SESSION_PREFIXES = ['/api/ipn', '/api/cron', '/api/social/callback', '/s', '/d', '/api/d']

function needsNoSession(pathname: string) {
  return NO_SESSION_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (needsNoSession(pathname)) return NextResponse.next({ request })

  // Keep the refreshed auth cookies on whatever response we return.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          response = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalidates against Supabase — getSession() would trust a cookie
  // the client could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isPublicRoute(pathname)) return response

    // An API call gets an answer, not a login page.
    //
    // Redirecting one produces a 200 with HTML in it, so every `await
    // res.json()` in the app throws "Unexpected token '<'" — a parse error
    // that names nothing and points nowhere. Callers then take the catch
    // branch and show whatever their failure state is, which is how an
    // expired session turned the language picker into one language captioned
    // "83 more are on the higher tiers".
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Not signed in' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Deep links into a console land on that console's own sign-in page.
    const signInUrl = new URL(signInRouteFor(pathname), request.url)
    signInUrl.searchParams.set('redirectedFrom', pathname)

    return NextResponse.redirect(signInUrl)
  }

  // Whole row, not named columns: before 002 there is no `role` column and
  // selecting it by name fails, which would sign everybody out.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role: Role = resolveRoleFromProfile(profile) ?? 'user'

  // Suspended accounts keep a valid session but lose access everywhere.
  if (profile?.status === 'suspended') {
    await supabase.auth.signOut()

    const suspendedUrl = new URL(DEFAULT_PORTAL.path, request.url)
    suspendedUrl.searchParams.set('error', 'account_suspended')

    return NextResponse.redirect(suspendedUrl)
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(HOME_ROUTE[role], request.url))
  }

  // A portal root doubles as that role's console. Your own always renders.
  // A superadmin may open another portal too — they can already reach the
  // pages beneath it, and blocking only the root left the three layers
  // disagreeing about who gets in.
  if (isPortalPath(pathname)) {
    // isGuardedRoute matters here: /login is a portal but belongs to no role,
    // so a signed-in visitor must be bounced rather than shown a login form.
    const allowed =
      pathname === HOME_ROUTE[role] || (isGuardedRoute(pathname) && isRouteAllowed(role, pathname))

    if (allowed) return response

    return NextResponse.redirect(new URL(HOME_ROUTE[role], request.url))
  }

  if (isPublicRoute(pathname)) return response

  if (!isRouteAllowed(role, pathname)) {
    return NextResponse.redirect(new URL(HOME_ROUTE[role], request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need a
     * session check and matching them would slow every page load.
     */
    '/((?!_next/static|_next/image|favicon.ico|characters|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)',
  ],
}
