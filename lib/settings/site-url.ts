/**
 * The one address the platform calls itself by.
 *
 * Every generated link — a share, an OAuth redirect, the sign-in URL in a
 * welcome email — has to be absolute, and until now each was built from the
 * incoming request. That is right most of the time and wrong in three cases
 * that all matter:
 *
 *   - Behind a reverse proxy. Shared hosting and nginx often forward without
 *     setting X-Forwarded-Host, so the app sees `localhost:3000` and stamps
 *     that into links it emails to customers.
 *   - The scheduler. Cron calls in from outside, and whatever URL it happens
 *     to use becomes the origin for every share link Autopilot creates.
 *   - OAuth. A redirect URI must match what was registered with the platform
 *     character for character, so it cannot be allowed to vary at all.
 *
 * A configured value settles all three. The request origin stays as the
 * fallback, so nothing breaks before it is set.
 *
 * Kept free of `server-only` so the normalising can be tested; the database
 * lookup lives in the server half below.
 */

/**
 * Clean up what an operator typed.
 *
 * People paste `abc.com`, `https://abc.com/`, and occasionally the whole
 * dashboard URL. Anything unusable returns null rather than a half-formed
 * value that would silently break every link on the platform.
 */
export function normaliseSiteUrl(input: string | null | undefined): string | null {
  if (!input) return null

  let value = String(input).trim()

  if (!value) return null

  // A bare host is the most common thing to paste.
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`

  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    // `localhost` is the one dotless host worth allowing, for local testing.
    if (parsed.hostname !== 'localhost') return null
  }

  // Only the origin matters. A path, query or fragment would be concatenated
  // onto every link and break all of them.
  return `${parsed.protocol}//${parsed.host}`
}

/** Join a path onto the site URL without doubling or dropping the slash. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Whether a request origin looks like it came through a proxy that forgot to
 * rewrite it.
 *
 * Used only to warn in the console: an operator whose share links all say
 * `localhost` should be told where the setting is, rather than discovering it
 * from a customer.
 */
export function looksInternal(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)(:\d+)?$/i.test(origin)
}
