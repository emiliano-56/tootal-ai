import { describe, it, expect } from 'vitest'
import { navFor } from '@/components/console/console-nav'
import type { Role } from '@/lib/auth/rbac'

function labels(role: Role): string[] {
  return navFor(role).flatMap((group) => group.items.map((item) => item.label))
}

function hrefs(role: Role): string[] {
  return navFor(role).flatMap((group) => group.items.map((item) => item.href))
}

describe('superadmin menu', () => {
  it('exposes the full platform', () => {
    const menu = labels('superadmin')

    expect(menu).toEqual(
      expect.arrayContaining([
        'Overview',
        'Users',
        'Bundle Users',
        'AI Providers',
        'SMTP',
        'Settings',
        'Leads',
        'Audit Logs',
      ])
    )
  })

  it('roots every link under /superadmin', () => {
    for (const href of hrefs('superadmin')) {
      expect(href.startsWith('/superadmin')).toBe(true)
    }
  })
})

describe('reseller menu', () => {
  it('hides the bundle screen, which is a platform-owner concern', () => {
    const menu = labels('reseller')

    expect(menu).not.toContain('Bundle Users')
  })

  it('hides platform configuration', () => {
    const menu = labels('reseller')

    expect(menu).not.toContain('AI Providers')
    expect(menu).not.toContain('Settings')
    expect(menu).not.toContain('SMTP')
  })

  it('hides branding, which belongs to white labels only', () => {
    const menu = labels('reseller')

    expect(menu).not.toContain('Brand')
    expect(menu).not.toContain('Domains')
  })

  it('keeps user management and reporting', () => {
    const menu = labels('reseller')

    expect(menu).toEqual(expect.arrayContaining(['Overview', 'Users', 'Analytics']))
  })

  it('no longer offers Credits, which monthly allowances replaced', () => {
    expect(labels('reseller')).not.toContain('Credits')
    expect(labels('superadmin')).not.toContain('Credits')
  })

  it('keeps Plans on the superadmin menu only', () => {
    expect(labels('superadmin')).toContain('Plans')
    expect(labels('reseller')).not.toContain('Plans')
    expect(labels('white_label')).not.toContain('Plans')
  })

  it('roots every link under /reseller', () => {
    for (const href of hrefs('reseller')) {
      expect(href.startsWith('/reseller')).toBe(true)
    }
  })
})

describe('white-label menu', () => {
  it('adds branding and domains on top of the reseller menu', () => {
    const menu = labels('white_label')

    expect(menu).toContain('Brand')
    expect(menu).toContain('Domains')
    expect(menu).toContain('SMTP')
  })

  it('still hides platform settings and other tenants', () => {
    const menu = labels('white_label')

    expect(menu).not.toContain('Settings')
    expect(menu).not.toContain('AI Providers')
    expect(menu).not.toContain('Bundle Users')
  })
})

describe('plain user', () => {
  it('gets nothing but the overview entry', () => {
    expect(labels('user')).toEqual(['Overview'])
  })
})

describe('menu hygiene', () => {
  it('drops empty groups rather than rendering bare headings', () => {
    for (const role of ['superadmin', 'reseller', 'white_label', 'user'] as Role[]) {
      for (const group of navFor(role)) {
        expect(group.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('produces no duplicate links within a role', () => {
    for (const role of ['superadmin', 'reseller', 'white_label'] as Role[]) {
      const list = hrefs(role)

      expect(new Set(list).size).toBe(list.length)
    }
  })
})

describe('IPN screen', () => {
  it('sits with the platform owner, who decides what a payment buys', () => {
    expect(labels('superadmin')).toContain('IPN')
  })

  it('is hidden from resellers and white labels', () => {
    expect(labels('reseller')).not.toContain('IPN')
    expect(labels('white_label')).not.toContain('IPN')
  })
})
