import { describe, it, expect } from 'vitest'
import { normaliseSiteUrl, absoluteUrl, looksInternal } from '@/lib/settings/site-url'

/**
 * Every generated link on the platform is built from this value, so a bad one
 * does not break a page — it breaks share links, OAuth redirects and the
 * sign-in link in welcome emails all at once, and only for customers.
 */

describe('what an operator typed', () => {
  it('accepts a bare host, which is what people paste', () => {
    expect(normaliseSiteUrl('abc.com')).toBe('https://abc.com')
  })

  it('keeps an explicit scheme', () => {
    expect(normaliseSiteUrl('https://abc.com')).toBe('https://abc.com')
    expect(normaliseSiteUrl('http://abc.com')).toBe('http://abc.com')
  })

  it('drops a trailing slash, which would double up in every link', () => {
    expect(normaliseSiteUrl('https://abc.com/')).toBe('https://abc.com')
    expect(normaliseSiteUrl('https://abc.com///')).toBe('https://abc.com')
  })

  it('throws away a path, query or fragment', () => {
    // Pasting the address bar from a dashboard is an easy mistake, and the
    // path would be concatenated onto every link on the platform.
    expect(normaliseSiteUrl('https://abc.com/superadmin/settings')).toBe('https://abc.com')
    expect(normaliseSiteUrl('https://abc.com/?tab=1#x')).toBe('https://abc.com')
  })

  it('keeps a port, so a non-standard deployment still works', () => {
    expect(normaliseSiteUrl('https://abc.com:8443')).toBe('https://abc.com:8443')
  })

  it('keeps a subdomain', () => {
    expect(normaliseSiteUrl('app.abc.com')).toBe('https://app.abc.com')
  })

  it('trims surrounding whitespace', () => {
    expect(normaliseSiteUrl('  abc.com  ')).toBe('https://abc.com')
  })

  it('allows localhost, for testing before a domain exists', () => {
    expect(normaliseSiteUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('returns null rather than something half-formed', () => {
    // A broken value here would be stamped into every email the platform
    // sends, so refusing is much better than guessing.
    expect(normaliseSiteUrl('')).toBeNull()
    expect(normaliseSiteUrl('   ')).toBeNull()
    expect(normaliseSiteUrl(null)).toBeNull()
    expect(normaliseSiteUrl(undefined)).toBeNull()
    expect(normaliseSiteUrl('not a url')).toBeNull()
    expect(normaliseSiteUrl('nodots')).toBeNull()
  })
})

describe('joining a path on', () => {
  it('does not double or drop the slash', () => {
    expect(absoluteUrl('https://abc.com', 'login')).toBe('https://abc.com/login')
    expect(absoluteUrl('https://abc.com', '/login')).toBe('https://abc.com/login')
    expect(absoluteUrl('https://abc.com/', 'login')).toBe('https://abc.com/login')
    expect(absoluteUrl('https://abc.com/', '/login')).toBe('https://abc.com/login')
  })
})

describe('spotting an unrewritten proxy origin', () => {
  it('recognises the hosts that mean nobody set X-Forwarded-Host', () => {
    // The symptom is customers receiving links to localhost, which is
    // baffling until you have seen it once.
    expect(looksInternal('http://localhost:3000')).toBe(true)
    expect(looksInternal('http://127.0.0.1:8080')).toBe(true)
    expect(looksInternal('http://0.0.0.0')).toBe(true)
    expect(looksInternal('http://myserver.local')).toBe(true)
  })

  it('leaves a real domain alone', () => {
    expect(looksInternal('https://abc.com')).toBe(false)
    expect(looksInternal('https://app.comictale.ai')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
//  Site URL vs the Domains screen
// ---------------------------------------------------------------------------
//  They answer different questions, and mixing them up breaks white label.

import fs from 'node:fs'

describe('which address a link gets', () => {
  it('sends customer-facing links to the tenant\u2019s own domain', () => {
    // A white label's share link on the platform's domain would put our brand
    // on their work, which is the one thing white label is sold to prevent.
    for (const file of ['app/api/share/route.ts', 'app/api/autopilot/route.ts', 'app/api/cron/autopilot/route.ts']) {
      expect(fs.readFileSync(file, 'utf8'), file).toContain('tenantSiteUrl')
    }
  })

  it('keeps anything registered with a third party on the platform address', () => {
    // An OAuth redirect URI and the IPN webhook are registered once with an
    // outside service and cannot vary per tenant.
    for (const file of [
      'app/api/social/route.ts',
      'app/api/social/callback/[platform]/route.ts',
      'app/api/console/social/route.ts',
      'app/api/ipn/[vendor]/route.ts',
    ]) {
      const source = fs.readFileSync(file, 'utf8')

      expect(source, file).toContain('siteUrl(')
      expect(source, `${file} must not vary the redirect per tenant`).not.toContain('tenantSiteUrl')
    }
  })

  it('only advertises a domain that is both verified and approved', () => {
    // Verified means the DNS is right; approved means the platform owner
    // allowed it. Advertising an unapproved one would leak a half-set-up
    // domain into live links.
    const source = fs.readFileSync('lib/settings/site-url.server.ts', 'utf8')

    expect(source).toMatch(/\.eq\('verified', true\)/)
    expect(source).toMatch(/\.eq\('approved', true\)/)
    expect(source).toMatch(/\.eq\('purpose', 'portal'\)/)
  })

  it('tells customers to point their CNAME at the configured address', () => {
    // Taken from the host header, a reverse proxy that does not rewrite it
    // would have every customer aiming their domain at "localhost".
    const source = fs.readFileSync('app/api/console/domains/route.ts', 'utf8')

    expect(source).toContain('await siteUrl(')
    expect(source).toMatch(/new URL\(configured\)\.host/)
  })
})
