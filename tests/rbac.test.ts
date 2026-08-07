import { describe, it, expect } from 'vitest'
import {
  ROLES,
  can,
  canAny,
  canCreateRole,
  creatableRoles,
  isRouteAllowed,
  isGuardedRoute,
  signInRouteFor,
  HOME_ROUTE,
  type Role,
} from '@/lib/auth/rbac'

describe('creation hierarchy', () => {
  it('lets a superadmin create every account type', () => {
    expect(creatableRoles('superadmin').sort()).toEqual(['reseller', 'user', 'white_label'])
  })

  it('restricts resellers and white labels to plain users', () => {
    expect(creatableRoles('reseller')).toEqual(['user'])
    expect(creatableRoles('white_label')).toEqual(['user'])
  })

  it('never lets a reseller create another reseller or a white label', () => {
    expect(canCreateRole('reseller', 'reseller')).toBe(false)
    expect(canCreateRole('reseller', 'white_label')).toBe(false)
    expect(canCreateRole('reseller', 'superadmin')).toBe(false)
  })

  it('never lets a white label create another white label or a reseller', () => {
    expect(canCreateRole('white_label', 'white_label')).toBe(false)
    expect(canCreateRole('white_label', 'reseller')).toBe(false)
    expect(canCreateRole('white_label', 'superadmin')).toBe(false)
  })

  it('gives plain users no creation rights at all', () => {
    expect(creatableRoles('user')).toEqual([])

    for (const role of ROLES) {
      expect(canCreateRole('user', role)).toBe(false)
    }
  })

  it('treats a missing role as powerless', () => {
    expect(creatableRoles(null)).toEqual([])
    expect(canCreateRole(undefined, 'user')).toBe(false)
  })
})

describe('permissions', () => {
  it('gives plain users no console permissions', () => {
    expect(can('user', 'users.create')).toBe(false)
    expect(can('user', 'analytics.view.own_tenant')).toBe(false)
    expect(can('user', 'branding.manage')).toBe(false)
  })

  it('keeps platform configuration superadmin-only', () => {
    const platformOnly = [
      'apis.manage',
      'settings.manage',
      'plans.manage',
      'licences.assign',
      'domains.approve',
      'users.impersonate',
      'resellers.manage',
      'white_labels.manage',
    ] as const

    for (const permission of platformOnly) {
      expect(can('superadmin', permission)).toBe(true)
      expect(can('reseller', permission)).toBe(false)
      expect(can('white_label', permission)).toBe(false)
    }
  })

  it('denies resellers any branding control', () => {
    // Resellers sell the official product, so branding stays locked.
    expect(can('reseller', 'branding.manage')).toBe(false)
    expect(can('reseller', 'domains.manage')).toBe(false)
    expect(can('reseller', 'marketing_assets.edit')).toBe(false)
    expect(can('reseller', 'marketing_assets.view')).toBe(true)
  })

  it('grants white labels branding on top of reseller rights', () => {
    expect(can('white_label', 'branding.manage')).toBe(true)
    expect(can('white_label', 'domains.manage')).toBe(true)
    expect(can('white_label', 'marketing_assets.edit')).toBe(true)

    // …but still no platform settings.
    expect(can('white_label', 'settings.manage')).toBe(false)
  })

  it('lets both tenant admins manage their own users and credits', () => {
    for (const role of ['reseller', 'white_label'] as Role[]) {
      expect(can(role, 'users.create')).toBe(true)
      expect(can(role, 'users.suspend')).toBe(true)
      expect(can(role, 'users.reset_password')).toBe(true)
      expect(can(role, 'users.read.own_tenant')).toBe(true)

      // Reading every user in the platform stays superadmin-only.
      expect(can(role, 'users.read.all')).toBe(false)
    }
  })

  it('treats a null role as having nothing', () => {
    expect(can(null, 'users.create')).toBe(false)
    expect(canAny(undefined, ['users.create', 'settings.manage'])).toBe(false)
  })

  it('canAny passes when at least one permission matches', () => {
    expect(canAny('reseller', ['settings.manage', 'users.create'])).toBe(true)
    expect(canAny('reseller', ['settings.manage', 'apis.manage'])).toBe(false)
  })
})

describe('route guarding', () => {
  it('recognises the guarded prefixes', () => {
    expect(isGuardedRoute('/admin')).toBe(true)
    expect(isGuardedRoute('/admin/users')).toBe(true)
    expect(isGuardedRoute('/reseller/users')).toBe(true)
    expect(isGuardedRoute('/whitelabel')).toBe(true)
    expect(isGuardedRoute('/dashboard')).toBe(false)
  })

  it('keeps /admin superadmin-only', () => {
    expect(isRouteAllowed('superadmin', '/admin')).toBe(true)
    expect(isRouteAllowed('reseller', '/admin')).toBe(false)
    expect(isRouteAllowed('white_label', '/admin')).toBe(false)
    expect(isRouteAllowed('user', '/admin')).toBe(false)
    expect(isRouteAllowed(null, '/admin')).toBe(false)
  })

  it('stops a reseller reaching the white-label portal and vice versa', () => {
    expect(isRouteAllowed('reseller', '/whitelabel')).toBe(false)
    expect(isRouteAllowed('white_label', '/reseller')).toBe(false)
  })

  it('lets a superadmin into the tenant portals for support', () => {
    expect(isRouteAllowed('superadmin', '/reseller')).toBe(true)
    expect(isRouteAllowed('superadmin', '/whitelabel')).toBe(true)
  })

  it('allows any signed-in role onto unguarded app routes', () => {
    for (const role of ROLES) {
      expect(isRouteAllowed(role, '/dashboard')).toBe(true)
      expect(isRouteAllowed(role, '/my-comics')).toBe(true)
    }
  })

  it('blocks signed-out visitors from unguarded app routes too', () => {
    expect(isRouteAllowed(null, '/dashboard')).toBe(false)
    expect(isRouteAllowed(undefined, '/my-comics')).toBe(false)
  })

  it('matches nested paths, not just exact prefixes', () => {
    expect(isRouteAllowed('user', '/admin/users/123/edit')).toBe(false)
    expect(isRouteAllowed('superadmin', '/admin/users/123/edit')).toBe(true)
  })

  it('matches whole segments, not string prefixes', () => {
    // /reseller-program is the user-facing affiliate page. A startsWith match
    // on '/reseller' would guard it and lock ordinary users out.
    expect(isGuardedRoute('/reseller-program')).toBe(false)
    expect(isRouteAllowed('user', '/reseller-program')).toBe(true)

    // Likewise /white-labels is a dashboard page, not the /whitelabel portal.
    expect(isGuardedRoute('/white-labels')).toBe(false)
    expect(isRouteAllowed('user', '/white-labels')).toBe(true)
  })

  it('sends a signed-out deep link to the right sign-in page', () => {
    expect(signInRouteFor('/superadmin/users')).toBe('/superadmin')
    expect(signInRouteFor('/reseller/leads')).toBe('/reseller')
    expect(signInRouteFor('/whitelabel/branding')).toBe('/whitelabel')
    expect(signInRouteFor('/dashboard')).toBe('/login')
  })

  it('gives every role a home route', () => {
    for (const role of ROLES) {
      expect(HOME_ROUTE[role]).toMatch(/^\//)
    }

    expect(HOME_ROUTE.user).toBe('/dashboard')
    expect(HOME_ROUTE.superadmin).toBe('/superadmin')
  })
})
