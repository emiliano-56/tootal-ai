/**
 * Sign-in security checks.
 *
 * Pure functions plus an in-memory rate limiter, so the rules can be tested
 * exhaustively without a database or a live request. Persistent tracking of
 * attempts lives in `login_history`; this module decides what to do about them.
 */

// ---------------------------------------------------------------------------
//  Disposable email
// ---------------------------------------------------------------------------

/**
 * Known throwaway providers.
 *
 * A list, not a lookup service: a network call on the signup path adds a
 * failure mode and a dependency for something that only needs to catch the
 * common cases. Extend it rather than replacing it with an API.
 */
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', 'guerrillamail.com', 'guerrillamail.net',
  'sharklasers.com', 'mailinator.com', 'mailinator.net', 'trashmail.com',
  'yopmail.com', 'yopmail.net', 'temp-mail.org', 'tempmail.com', 'tempmailo.com',
  'throwawaymail.com', 'getnada.com', 'nada.email', 'dispostable.com',
  'maildrop.cc', 'fakeinbox.com', 'mytemp.email', 'mohmal.com', 'emailondeck.com',
  'burnermail.io', 'spamgourmet.com', 'grr.la', 'spam4.me', 'tempr.email',
  'discard.email', 'mailnesia.com', 'trbvm.com', 'mail-temporaire.fr',
  'inboxkitten.com', 'tmpmail.org', 'moakt.com', 'luxusmail.org', 'vomoto.com',
  'harakirimail.com', 'anonaddy.me', 'byom.de', 'einrot.com', 'tafmail.com',
])

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email)

  if (!domain) return false
  if (DISPOSABLE_DOMAINS.has(domain)) return true

  // Sub-domains of a known provider, e.g. mail.yopmail.com
  return [...DISPOSABLE_DOMAINS].some((known) => domain.endsWith(`.${known}`))
}

// ---------------------------------------------------------------------------
//  Rate limiting
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets. */
  retryAfter: number
}

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Fixed-window limiter.
 *
 * In-process: it protects a single server and resets on deploy, which is the
 * honest limitation. Behind several instances it becomes per-instance — move
 * the bucket into Postgres or Redis before relying on it as the only defence.
 */
export function rateLimit(
  key: string,
  { limit, windowMs, now = Date.now() }: { limit: number; windowMs: number; now?: number }
): RateLimitResult {
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })

    return { allowed: true, remaining: limit - 1, retryAfter: 0 }
  }

  bucket.count++

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)

  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfter }
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfter }
}

/** Test helper — the map is module state and would otherwise leak between cases. */
export function resetRateLimits(): void {
  buckets.clear()
}

// ---------------------------------------------------------------------------
//  Brute force
// ---------------------------------------------------------------------------

export interface LockoutPolicy {
  /** Failures before the account is locked. */
  maxFailures: number
  /** How long the lock lasts. */
  lockoutMs: number
  /** Failures older than this no longer count. */
  windowMs: number
}

export const DEFAULT_LOCKOUT: LockoutPolicy = {
  maxFailures: 5,
  lockoutMs: 15 * 60 * 1000,
  windowMs: 15 * 60 * 1000,
}

export interface LockoutState {
  locked: boolean
  failures: number
  /** Seconds until the account can try again. */
  retryAfter: number
}

/**
 * Decide whether recent failures should block a sign-in.
 *
 * Takes the timestamps rather than querying, so the caller controls the source
 * and this stays testable.
 */
export function evaluateLockout(
  failedAttempts: number[],
  policy: LockoutPolicy = DEFAULT_LOCKOUT,
  now: number = Date.now()
): LockoutState {
  const recent = failedAttempts.filter((at) => now - at < policy.windowMs).sort((a, b) => a - b)

  if (recent.length < policy.maxFailures) {
    return { locked: false, failures: recent.length, retryAfter: 0 }
  }

  // The lock runs from the failure that tripped it, not from the first one.
  const trippedAt = recent[recent.length - 1]
  const unlockAt = trippedAt + policy.lockoutMs

  if (now >= unlockAt) {
    return { locked: false, failures: recent.length, retryAfter: 0 }
  }

  return {
    locked: true,
    failures: recent.length,
    retryAfter: Math.ceil((unlockAt - now) / 1000),
  }
}

// ---------------------------------------------------------------------------
//  Request metadata
// ---------------------------------------------------------------------------

export interface RequestInfo {
  ip: string | null
  userAgent: string | null
  browser: string | null
  device: string | null
}

/** Best-effort client details for the login history. */
export function describeRequest(headers: Headers): RequestInfo {
  // x-forwarded-for is a chain; the first entry is the client.
  const forwarded = headers.get('x-forwarded-for')
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    null

  const userAgent = headers.get('user-agent')

  return { ip, userAgent, browser: detectBrowser(userAgent), device: detectDevice(userAgent) }
}

export function detectBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null

  // Order matters: Edge and Opera both advertise Chrome.
  if (/edg\//i.test(userAgent)) return 'Edge'
  if (/opr\/|opera/i.test(userAgent)) return 'Opera'
  if (/chrome|crios/i.test(userAgent)) return 'Chrome'
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox'
  if (/safari/i.test(userAgent)) return 'Safari'

  return 'Other'
}

export function detectDevice(userAgent: string | null): string | null {
  if (!userAgent) return null

  if (/ipad|tablet/i.test(userAgent)) return 'Tablet'
  if (/mobile|iphone|android/i.test(userAgent)) return 'Mobile'

  return 'Desktop'
}

// ---------------------------------------------------------------------------
//  Proxy / VPN
// ---------------------------------------------------------------------------

/**
 * Signals that a request is being proxied.
 *
 * Header-based only. This cannot identify a commercial VPN — that needs an IP
 * reputation service — so it reports what is observable rather than implying
 * certainty. Treat a hit as a reason to look, not to block.
 */
export function proxySignals(headers: Headers): string[] {
  const signals: string[] = []

  const forwarded = headers.get('x-forwarded-for')

  // More than two hops usually means an anonymising chain rather than a CDN.
  if (forwarded && forwarded.split(',').length > 2) signals.push('multiple-forwarded-hops')

  for (const header of ['via', 'forwarded', 'x-proxy-id', 'proxy-connection']) {
    if (headers.get(header)) signals.push(header)
  }

  if (headers.get('x-anonymous') || headers.get('x-tor')) signals.push('anonymiser-header')

  return signals
}

export function isLikelyProxied(headers: Headers): boolean {
  return proxySignals(headers).length > 0
}
