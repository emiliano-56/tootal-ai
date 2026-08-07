import { describe, it, expect } from 'vitest'
import {
  PORTALS,
  PORTAL_PATHS,
  DEFAULT_PORTAL,
  getPortal,
  isPortalPath,
  resolvePortalAccess,
  resolveRoleFromProfile,
} from '@/lib/auth/portals'
import { ROLES, type Role } from '@/lib/auth/rbac'

describe('portal definitions', () => {
  it('exposes the four sign-in URLs', () => {
    expect(PORTAL_PATHS).toEqual(['/login', '/superadmin', '/reseller', '/whitelabel'])
  })

  it('defaults to the plain user portal', () => {
    expect(DEFAULT_PORTAL.path).toBe('/login')
    expect(DEFAULT_PORTAL.role).toBeNull()
  })

  it('covers every privileged role exactly once', () => {
    const covered = PORTALS.map((portal) => portal.role).filter(Boolean)

    expect(new Set(covered)).toEqual(new Set(['superadmin', 'reseller', 'white_label']))
    expect(covered).toHaveLength(3)
  })

  it('looks portals up by slug', () => {
    expect(getPortal('superadmin')?.role).toBe('superadmin')
    expect(getPortal('whitelabel')?.role).toBe('white_label')
    expect(getPortal('nope')).toBeUndefined()
  })

  it('recognises portal paths and nothing else', () => {
    expect(isPortalPath('/login')).toBe(true)
    expect(isPortalPath('/superadmin')).toBe(true)
    expect(isPortalPath('/dashboard')).toBe(false)
    expect(isPortalPath('/superadmin/extra')).toBe(false)
  })

  it('does not collide with the white-labels dashboard page', () => {
    // /whitelabel is the portal; /white-labels stays a user dashboard page.
    expect(PORTAL_PATHS).not.toContain('/white-labels')
  })
})

describe('reading the role off a profile row', () => {
  it('uses the role column when 002 has been applied', () => {
    expect(resolveRoleFromProfile({ role: 'reseller' })).toBe('reseller')
    expect(resolveRoleFromProfile({ role: 'white_label' })).toBe('white_label')
  })

  it('falls back to the legacy is_admin flag before 002', () => {
    // The pre-migration schema has no role column at all.
    expect(resolveRoleFromProfile({ email: 'a@b.com', is_admin: true })).toBe('superadmin')
    expect(resolveRoleFromProfile({ email: 'a@b.com', is_admin: false })).toBe('user')
    expect(resolveRoleFromProfile({ email: 'a@b.com' })).toBe('user')
  })

  it('prefers the role column over the legacy flag once both exist', () => {
    expect(resolveRoleFromProfile({ role: 'user', is_admin: true })).toBe('user')
  })

  it('ignores an unrecognised role value rather than trusting it', () => {
    expect(resolveRoleFromProfile({ role: 'root' })).toBe('user')
    expect(resolveRoleFromProfile({ role: 42 })).toBe('user')
  })

  it('returns null when there is no profile row at all', () => {
    expect(resolveRoleFromProfile(null)).toBeNull()
    expect(resolveRoleFromProfile(undefined)).toBeNull()
  })
})

describe('portal access after authentication', () => {
  it('lets the matching role through to its own console', () => {
    const access = resolvePortalAccess(getPortal('superadmin')!, 'superadmin')

    expect(access.allowed).toBe(true)
    expect(access.redirectTo).toBe('/superadmin')
  })

  it('refuses a plain user at the superadmin portal', () => {
    // Correct password, wrong door.
    const access = resolvePortalAccess(getPortal('superadmin')!, 'user')

    expect(access.allowed).toBe(false)
    expect(access.redirectTo).toBeUndefined()
    expect(access.error).toContain('cannot sign in here')
  })

  it('refuses a reseller at the white-label portal and vice versa', () => {
    expect(resolvePortalAccess(getPortal('whitelabel')!, 'reseller').allowed).toBe(false)
    expect(resolvePortalAccess(getPortal('reseller')!, 'white_label').allowed).toBe(false)
  })

  it('refuses a superadmin at a tenant portal, so staff use their own door', () => {
    expect(resolvePortalAccess(getPortal('reseller')!, 'superadmin').allowed).toBe(false)
  })

  it('admits every role at the default portal and routes them home', () => {
    for (const role of ROLES as readonly Role[]) {
      const access = resolvePortalAccess(DEFAULT_PORTAL, role)

      expect(access.allowed).toBe(true)
      expect(access.redirectTo).toMatch(/^\//)
    }

    expect(resolvePortalAccess(DEFAULT_PORTAL, 'user').redirectTo).toBe('/dashboard')
    expect(resolvePortalAccess(DEFAULT_PORTAL, 'superadmin').redirectTo).toBe('/superadmin')
  })

  it('fails closed when the role cannot be read', () => {
    const access = resolvePortalAccess(DEFAULT_PORTAL, null)

    expect(access.allowed).toBe(false)
    expect(access.redirectTo).toBeUndefined()
  })
})
