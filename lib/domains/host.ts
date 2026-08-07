/**
 * Host resolution for mapped white-label domains.
 *
 * Pure helpers so the matching rules can be tested without a request: getting
 * these wrong either breaks the platform's own hostname or serves one tenant's
 * portal on another's domain.
 */

/** Strip the port and normalise, so `Portal.Example.com:443` matches. */
export function hostname(host: string | null | undefined): string {
  if (!host) return ''

  return host.trim().toLowerCase().split(':')[0].replace(/\.$/, '')
}

/**
 * Hosts that are the platform itself rather than a customer's domain.
 *
 * Localhost and the deployment URL must never be looked up as mapped domains —
 * a stray row claiming `localhost` would otherwise hijack development.
 */
export function isPlatformHost(host: string, platformHosts: string[]): boolean {
  const name = hostname(host)

  if (!name) return true
  if (name === 'localhost' || name.endsWith('.localhost')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return true

  return platformHosts.some((candidate) => {
    const platform = hostname(candidate)

    if (!platform) return false

    // Exact match, or a subdomain of the platform's own domain.
    return name === platform || name.endsWith(`.${platform}`)
  })
}

/** Hosts treated as the platform, from the environment. */
export function platformHostsFromEnv(env: Record<string, string | undefined>): string[] {
  return [env.NEXT_PUBLIC_SITE_URL, env.VERCEL_URL, env.NEXT_PUBLIC_VERCEL_URL]
    .filter(Boolean)
    .map((value) => hostname(value!.replace(/^https?:\/\//, '')))
}
