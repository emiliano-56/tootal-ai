import { HOME_ROUTE, type Role } from '@/lib/auth/rbac'

/**
 * Sign-in portals.
 *
 * Each role gets its own URL. The portal is a front door, not a security
 * boundary — knowing /superadmin grants nothing, because the role is still
 * checked against the database after authentication and the proxy guards the
 * console routes independently. What it does buy is a clean separation for
 * white-label customers, who should never see Comic Tale AI staff branding.
 */

export interface Portal {
  slug: string
  path: string
  /** Null means "any role may sign in here", used by the default portal. */
  role: Role | null
  title: string
  subtitle: string
  badge: string
  /** Tailwind gradient for the submit button and accents. */
  accent: string
}

export const PORTALS: Portal[] = [
  {
    slug: 'login',
    path: '/login',
    role: null,
    title: 'Sign in to your studio',
    subtitle: 'Pick up right where you left off — your comics are waiting.',
    badge: 'Welcome back',
    accent: 'from-indigo-600 via-violet-600 to-fuchsia-600',
  },
  {
    slug: 'superadmin',
    path: '/superadmin',
    role: 'superadmin',
    title: 'Superadmin sign in',
    subtitle: 'Platform administration for Comic Tale AI staff.',
    badge: 'Restricted access',
    accent: 'from-slate-800 via-slate-900 to-black',
  },
  {
    slug: 'reseller',
    path: '/reseller',
    role: 'reseller',
    title: 'Reseller sign in',
    subtitle: 'Manage the users on your reseller licence.',
    badge: 'Reseller portal',
    accent: 'from-blue-600 via-indigo-600 to-violet-600',
  },
  {
    slug: 'whitelabel',
    path: '/whitelabel',
    role: 'white_label',
    title: 'White label sign in',
    subtitle: 'Manage your branded platform and your customers.',
    badge: 'White label portal',
    accent: 'from-fuchsia-600 via-purple-600 to-indigo-600',
  },
]

export const DEFAULT_PORTAL = PORTALS[0]

export const PORTAL_PATHS = PORTALS.map((portal) => portal.path)

export function getPortal(slug: string): Portal | undefined {
  return PORTALS.find((portal) => portal.slug === slug)
}

export function isPortalPath(pathname: string): boolean {
  return PORTAL_PATHS.includes(pathname)
}

/**
 * Read the role off a profile row that may predate migration 002.
 *
 * Before 002 there is no `role` column, only the older `is_admin` boolean, so
 * selecting `role` outright fails and would lock everyone out. Reading the whole
 * row and falling back keeps sign-in working on both schema versions.
 */
export function resolveRoleFromProfile(
  profile: Record<string, unknown> | null | undefined
): Role | null {
  if (!profile) return null

  const role = profile.role

  if (typeof role === 'string' && (['superadmin', 'reseller', 'white_label', 'user'] as string[]).includes(role)) {
    return role as Role
  }

  // Legacy schema: the boolean admin flag is the only signal available.
  if (profile.is_admin === true) return 'superadmin'

  return 'user'
}

export interface PortalAccess {
  allowed: boolean
  redirectTo?: string
  error?: string
}

/**
 * Decide what happens after credentials are accepted.
 *
 * A role-specific portal admits only that role: signing in with the right
 * password but the wrong role is refused and the session is dropped, rather
 * than quietly redirecting somewhere the account does not belong.
 */
export function resolvePortalAccess(portal: Portal, role: Role | null): PortalAccess {
  if (!role) {
    return { allowed: false, error: 'We could not load your account. Contact support.' }
  }

  if (portal.role === null) {
    return { allowed: true, redirectTo: HOME_ROUTE[role] }
  }

  if (portal.role !== role) {
    return {
      allowed: false,
      error: 'This account cannot sign in here. Use the sign-in page for your account type.',
    }
  }

  return { allowed: true, redirectTo: HOME_ROUTE[role] }
}
