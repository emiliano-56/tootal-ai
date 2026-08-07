/**
 * DNS record naming and shape rules.
 *
 * Kept free of `server-only` so the rules can be unit tested: the lookups
 * themselves need Node, but deciding what to look up does not.
 */

export const TXT_PREFIX = '_comictale'

/** Where the ownership TXT record must live for a given domain. */
export function txtRecordName(domain: string): string {
  return `${TXT_PREFIX}.${normaliseHost(domain)}`
}

/**
 * Hostnames compare case-insensitively and a trailing dot is legal in DNS,
 * so both are normalised before comparing.
 */
export function normaliseHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '')
}

/**
 * A CNAME cannot coexist with the other records a zone apex must carry, which
 * is why root domains need an ALIAS/ANAME instead. Flagged before saving so
 * the customer hears it now rather than after DNS quietly fails.
 */
export function isApexDomain(domain: string): boolean {
  const labels = normaliseHost(domain).split('.')

  // Two labels is a plain apex (example.com). Three is ambiguous because of
  // multi-part suffixes like co.uk, so only the common ones count as apex.
  if (labels.length === 2) return true

  if (labels.length === 3) {
    const twoPartSuffixes = ['co.uk', 'com.au', 'co.in', 'co.nz', 'co.za', 'com.br', 'co.jp']

    return twoPartSuffixes.includes(labels.slice(1).join('.'))
  }

  return false
}
