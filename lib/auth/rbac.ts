/**
 * Role-based access control.
 *
 * Single source of truth for what each role may do and which navigation it
 * sees. UI, API routes and middleware all read from here, so a permission is
 * changed in one place rather than in every screen that happens to check it.
 *
 * The database enforces the same hierarchy independently (see
 * supabase/migrations/002_saas_foundation.sql) — this layer is for UX and
 * early rejection, never the only line of defence.
 */

export const ROLES = ['superadmin', 'reseller', 'white_label', 'user'] as const

export type Role = (typeof ROLES)[number]

export type Permission =
  // Account management
  | 'users.create'
  | 'users.read.own_tenant'
  | 'users.read.all'
  | 'users.update'
  | 'users.delete'
  | 'users.suspend'
  | 'users.impersonate'
  | 'users.reset_password'
  | 'resellers.manage'
  | 'white_labels.manage'
  // Credits
  // Platform configuration
  | 'apis.manage'
  | 'smtp.manage'
  | 'email_templates.manage'
  | 'settings.manage'
  | 'plans.manage'
  | 'licences.assign'
  // Branding — white-label only
  | 'branding.manage'
  | 'domains.manage'
  | 'domains.approve'
  // Data
  | 'leads.manage'
  | 'analytics.view.own_tenant'
  | 'analytics.view.all'
  | 'audit_logs.view'
  | 'marketing_assets.view'
  | 'marketing_assets.edit'

const SUPERADMIN_PERMISSIONS: Permission[] = [
  'users.create',
  'users.read.all',
  'users.read.own_tenant',
  'users.update',
  'users.delete',
  'users.suspend',
  'users.impersonate',
  'users.reset_password',
  'resellers.manage',
  'white_labels.manage',
  'apis.manage',
  'smtp.manage',
  'email_templates.manage',
  'settings.manage',
  'plans.manage',
  'licences.assign',
  'branding.manage',
  'domains.manage',
  'domains.approve',
  'leads.manage',
  'analytics.view.all',
  'analytics.view.own_tenant',
  'audit_logs.view',
  'marketing_assets.view',
  'marketing_assets.edit',
]

/** Resellers sell the official product: no branding, no platform settings. */
const RESELLER_PERMISSIONS: Permission[] = [
  'users.create',
  'users.read.own_tenant',
  'users.update',
  'users.delete',
  'users.suspend',
  'users.reset_password',
  'analytics.view.own_tenant',
  'audit_logs.view',
  'marketing_assets.view',
]

/** White-label owners additionally control branding and their own domain. */
const WHITE_LABEL_PERMISSIONS: Permission[] = [
  ...RESELLER_PERMISSIONS,
  'branding.manage',
  'domains.manage',
  'smtp.manage',
  'marketing_assets.edit',
]

const USER_PERMISSIONS: Permission[] = []

const PERMISSIONS_BY_ROLE: Record<Role, Permission[]> = {
  superadmin: SUPERADMIN_PERMISSIONS,
  reseller: RESELLER_PERMISSIONS,
  white_label: WHITE_LABEL_PERMISSIONS,
  user: USER_PERMISSIONS,
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false

  return PERMISSIONS_BY_ROLE[role]?.includes(permission) ?? false
}

export function canAny(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission))
}

/**
 * Which roles a given role is allowed to create.
 * Mirrors the `enforce_account_rules` trigger in the database.
 */
export function creatableRoles(role: Role | null | undefined): Role[] {
  switch (role) {
    case 'superadmin':
      return ['user', 'reseller', 'white_label']
    case 'reseller':
    case 'white_label':
      return ['user']
    default:
      return []
  }
}

export function canCreateRole(actor: Role | null | undefined, target: Role): boolean {
  return creatableRoles(actor).includes(target)
}

// ---------------------------------------------------------------------------
//  Route access
// ---------------------------------------------------------------------------

/**
 * Landing route for each role immediately after sign-in.
 *
 * For the privileged roles this is the same URL as their sign-in page: the
 * route renders the login form when signed out and the console when signed
 * in, so a superadmin lives entirely under /superadmin.
 */
export const HOME_ROUTE: Record<Role, string> = {
  superadmin: '/superadmin',
  reseller: '/reseller',
  white_label: '/whitelabel',
  user: '/dashboard',
}

/** Route prefixes only the listed roles may open. */
const ROUTE_GUARDS: { prefix: string; roles: Role[] }[] = [
  { prefix: '/superadmin', roles: ['superadmin'] },
  { prefix: '/reseller', roles: ['reseller', 'superadmin'] },
  { prefix: '/whitelabel', roles: ['white_label', 'superadmin'] },
  // The pre-console admin screen, kept until its features move across.
  { prefix: '/admin', roles: ['superadmin'] },
]

/** The guard covering a path, if any. Longest prefix wins. */
function guardFor(pathname: string) {
  return ROUTE_GUARDS.filter((entry) => isUnderPrefix(pathname, entry.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  )[0]
}

/**
 * Prefix match on whole segments.
 *
 * A plain startsWith would make /reseller also match /reseller-program, the
 * user-facing affiliate page, and lock ordinary users out of it.
 */
function isUnderPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isRouteAllowed(role: Role | null | undefined, pathname: string): boolean {
  const guard = guardFor(pathname)

  // Unguarded app routes are open to any signed-in role.
  if (!guard) return Boolean(role)

  return Boolean(role && guard.roles.includes(role))
}

export function isGuardedRoute(pathname: string): boolean {
  return Boolean(guardFor(pathname))
}

/**
 * Where to send a signed-out visitor who asked for a guarded page: the sign-in
 * page that owns that area, so someone deep-linked to /superadmin/users lands
 * on the superadmin door rather than the general one.
 */
export function signInRouteFor(pathname: string): string {
  const guard = guardFor(pathname)

  if (!guard || guard.prefix === '/admin') return '/login'

  return guard.prefix
}
