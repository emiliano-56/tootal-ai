import { describe, it, expect, beforeEach } from 'vitest'
import {
  isDisposableEmail,
  emailDomain,
  rateLimit,
  resetRateLimits,
  evaluateLockout,
  DEFAULT_LOCKOUT,
  detectBrowser,
  detectDevice,
  describeRequest,
  proxySignals,
  isLikelyProxied,
} from '@/lib/security/guards'

describe('disposable email detection', () => {
  it('catches well-known throwaway providers', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true)
    expect(isDisposableEmail('x@guerrillamail.com')).toBe(true)
    expect(isDisposableEmail('x@yopmail.com')).toBe(true)
  })

  it('catches sub-domains of a known provider', () => {
    expect(isDisposableEmail('x@mail.yopmail.com')).toBe(true)
  })

  it('is case and whitespace insensitive', () => {
    expect(isDisposableEmail('  Person@MAILINATOR.com ')).toBe(true)
  })

  it('allows ordinary providers', () => {
    expect(isDisposableEmail('someone@gmail.com')).toBe(false)
    expect(isDisposableEmail('person@company.co.uk')).toBe(false)
  })

  it('does not match on a substring of a legitimate domain', () => {
    // notmailinator.com must not be caught by "mailinator.com".
    expect(isDisposableEmail('x@notmailinator.com')).toBe(false)
    expect(isDisposableEmail('x@mailinator.com.example.org')).toBe(false)
  })

  it('handles malformed input without throwing', () => {
    expect(isDisposableEmail('no-at-sign')).toBe(false)
    expect(isDisposableEmail('')).toBe(false)
    expect(emailDomain('a@b.com')).toBe('b.com')
  })
})

describe('rate limiting', () => {
  beforeEach(() => resetRateLimits())

  it('allows up to the limit then blocks', () => {
    const options = { limit: 3, windowMs: 60_000, now: 1_000 }

    expect(rateLimit('ip:1', options).allowed).toBe(true)
    expect(rateLimit('ip:1', options).allowed).toBe(true)
    expect(rateLimit('ip:1', options).allowed).toBe(true)

    const blocked = rateLimit('ip:1', options)

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBe(60)
  })

  it('counts each key separately', () => {
    const options = { limit: 1, windowMs: 60_000, now: 1_000 }

    expect(rateLimit('ip:a', options).allowed).toBe(true)
    expect(rateLimit('ip:b', options).allowed).toBe(true)
    expect(rateLimit('ip:a', options).allowed).toBe(false)
  })

  it('resets once the window passes', () => {
    expect(rateLimit('ip:2', { limit: 1, windowMs: 1_000, now: 0 }).allowed).toBe(true)
    expect(rateLimit('ip:2', { limit: 1, windowMs: 1_000, now: 500 }).allowed).toBe(false)
    expect(rateLimit('ip:2', { limit: 1, windowMs: 1_000, now: 1_001 }).allowed).toBe(true)
  })

  it('reports remaining allowance while under the limit', () => {
    const options = { limit: 5, windowMs: 60_000, now: 0 }

    expect(rateLimit('ip:3', options).remaining).toBe(4)
    expect(rateLimit('ip:3', options).remaining).toBe(3)
  })
})

describe('brute force lockout', () => {
  const now = 1_000_000

  it('stays unlocked below the threshold', () => {
    const attempts = [now - 1000, now - 2000, now - 3000, now - 4000]

    expect(evaluateLockout(attempts, DEFAULT_LOCKOUT, now)).toMatchObject({
      locked: false,
      failures: 4,
    })
  })

  it('locks on the fifth recent failure', () => {
    const attempts = Array.from({ length: 5 }, (_, i) => now - i * 1000)
    const state = evaluateLockout(attempts, DEFAULT_LOCKOUT, now)

    expect(state.locked).toBe(true)
    expect(state.retryAfter).toBeGreaterThan(0)
  })

  it('ignores failures older than the window', () => {
    const old = now - DEFAULT_LOCKOUT.windowMs - 1
    const attempts = Array.from({ length: 10 }, () => old)

    expect(evaluateLockout(attempts, DEFAULT_LOCKOUT, now).locked).toBe(false)
  })

  it('unlocks once the lockout period has elapsed', () => {
    const trippedAt = now - DEFAULT_LOCKOUT.lockoutMs - 1
    const attempts = Array.from({ length: 5 }, () => trippedAt)

    expect(evaluateLockout(attempts, DEFAULT_LOCKOUT, now).locked).toBe(false)
  })

  it('measures the lock from the most recent failure, not the first', () => {
    // Four old failures plus one just now must still lock.
    const attempts = [now - 60_000, now - 59_000, now - 58_000, now - 57_000, now - 10]
    const state = evaluateLockout(attempts, DEFAULT_LOCKOUT, now)

    expect(state.locked).toBe(true)
    expect(state.retryAfter).toBeGreaterThan(DEFAULT_LOCKOUT.lockoutMs / 1000 - 60)
  })

  it('handles an empty history', () => {
    expect(evaluateLockout([], DEFAULT_LOCKOUT, now)).toMatchObject({ locked: false, failures: 0 })
  })
})

describe('client detection', () => {
  it('identifies Edge and Opera before Chrome', () => {
    // Both advertise Chrome in their UA, so order of checks matters.
    expect(detectBrowser('Mozilla/5.0 Chrome/120 Safari/537 Edg/120')).toBe('Edge')
    expect(detectBrowser('Mozilla/5.0 Chrome/120 Safari/537 OPR/106')).toBe('Opera')
    expect(detectBrowser('Mozilla/5.0 Chrome/120 Safari/537')).toBe('Chrome')
  })

  it('identifies Safari and Firefox', () => {
    expect(detectBrowser('Mozilla/5.0 Version/17 Safari/605')).toBe('Safari')
    expect(detectBrowser('Mozilla/5.0 Firefox/121')).toBe('Firefox')
  })

  it('classifies device types', () => {
    expect(detectDevice('iPhone Mobile Safari')).toBe('Mobile')
    expect(detectDevice('iPad tablet')).toBe('Tablet')
    expect(detectDevice('Windows NT 10.0 Chrome')).toBe('Desktop')
  })

  it('returns null without a user agent', () => {
    expect(detectBrowser(null)).toBeNull()
    expect(detectDevice(null)).toBeNull()
  })
})

describe('request description', () => {
  it('takes the client IP from the front of x-forwarded-for', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178',
      'user-agent': 'Mozilla/5.0 Firefox/121',
    })

    expect(describeRequest(headers)).toMatchObject({ ip: '203.0.113.7', browser: 'Firefox' })
  })

  it('falls back through the other IP headers', () => {
    expect(describeRequest(new Headers({ 'x-real-ip': '198.51.100.4' })).ip).toBe('198.51.100.4')
    expect(describeRequest(new Headers({ 'cf-connecting-ip': '198.51.100.9' })).ip).toBe('198.51.100.9')
  })

  it('returns nulls when nothing is present', () => {
    expect(describeRequest(new Headers()).ip).toBeNull()
  })
})

describe('proxy signals', () => {
  it('flags a long forwarding chain', () => {
    const headers = new Headers({ 'x-forwarded-for': 'a, b, c' })

    expect(proxySignals(headers)).toContain('multiple-forwarded-hops')
    expect(isLikelyProxied(headers)).toBe(true)
  })

  it('does not flag a normal single-proxy request', () => {
    // One CDN hop is ordinary and must not be treated as anonymising.
    expect(isLikelyProxied(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe(false)
    expect(isLikelyProxied(new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' }))).toBe(false)
  })

  it('flags explicit proxy headers', () => {
    expect(proxySignals(new Headers({ via: '1.1 squid' }))).toContain('via')
    expect(proxySignals(new Headers({ 'x-tor': '1' }))).toContain('anonymiser-header')
  })

  it('reports nothing for a clean request', () => {
    expect(proxySignals(new Headers({ 'user-agent': 'Mozilla/5.0' }))).toEqual([])
  })
})
