/**
 * Handing a buyer a file, on terms.
 *
 * A download link that never expires and counts nothing is just publishing:
 * post it once and the thing being sold is free from then on. So a delivery
 * carries two independent limits — a date and a number of downloads — and
 * either one ending it is enough.
 *
 * Both are optional, because both have legitimate "no limit" cases: a lifetime
 * licence has no expiry, and a free lead magnet has no download cap. What is
 * not legitimate is silently having neither by accident, which is why the
 * presets below all set at least one.
 *
 * Pure, so every way a link can be dead is testable without a clock or a
 * database.
 */

export interface DeliveryLimits {
  expiresAt?: string | Date | null
  maxDownloads?: number | null
  downloads?: number
  revoked?: boolean
}

export type DeliveryState =
  | { usable: true; remaining: number | null; expiresAt: Date | null }
  | { usable: false; reason: string }

/**
 * Whether a link still works, and why not if it does not.
 *
 * The reason is shown to the buyer, so it says what they should do rather
 * than what happened: someone who arrives at an expired link needs to know to
 * contact the seller, not that a timestamp comparison failed.
 */
export function checkDelivery(limits: DeliveryLimits, now: Date = new Date()): DeliveryState {
  if (limits.revoked) {
    return { usable: false, reason: 'This link has been turned off by the seller.' }
  }

  const expiresAt = limits.expiresAt ? new Date(limits.expiresAt) : null

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    // An unreadable date is treated as expired rather than as absent. The
    // safe failure for a paid file is "no longer available", not "free".
    return { usable: false, reason: 'This link is no longer valid. Ask the seller for a new one.' }
  }

  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { usable: false, reason: 'This link has expired. Ask the seller for a new one.' }
  }

  const used = Math.max(0, limits.downloads ?? 0)
  const cap = limits.maxDownloads ?? null

  if (cap !== null && used >= cap) {
    return {
      usable: false,
      reason: 'This link has been used the maximum number of times. Ask the seller for a new one.',
    }
  }

  return { usable: true, remaining: cap === null ? null : cap - used, expiresAt }
}

/** Ready-made sets of terms, so nobody has to invent them. */
export const DELIVERY_PRESETS: {
  key: string
  label: string
  hint: string
  days: number | null
  downloads: number | null
}[] = [
  {
    key: 'single',
    label: 'One buyer, 7 days',
    hint: 'Three downloads so they can retry, then it stops. The usual choice.',
    days: 7,
    downloads: 3,
  },
  {
    key: 'generous',
    label: 'One buyer, 30 days',
    hint: 'More room for someone who buys and downloads later.',
    days: 30,
    downloads: 10,
  },
  {
    key: 'lead-magnet',
    label: 'Free giveaway',
    hint: 'No download limit, expires in 30 days. For a lead magnet.',
    days: 30,
    downloads: null,
  },
  {
    key: 'lifetime',
    label: 'Lifetime access',
    hint: 'Never expires, capped at 25 downloads so a shared link cannot run away.',
    days: null,
    downloads: 25,
  },
]

export function preset(key: string) {
  return DELIVERY_PRESETS.find((entry) => entry.key === key) ?? DELIVERY_PRESETS[0]
}

/** The expiry date `days` from now, or null for no expiry. */
export function expiryFrom(days: number | null, now: Date = new Date()): Date | null {
  if (days === null) return null

  const safe = Math.max(1, Math.min(3650, Math.floor(days)))

  return new Date(now.getTime() + safe * 24 * 60 * 60 * 1000)
}

/**
 * How long the signed storage URL should live.
 *
 * Short: it is handed to a browser that is about to follow it immediately. A
 * long-lived signed URL is a second, uncounted delivery link that none of the
 * limits above apply to — which would quietly defeat the whole feature.
 */
export const SIGNED_URL_SECONDS = 120

/**
 * A token for the URL.
 *
 * Long enough that guessing is not a strategy, and using only characters that
 * survive being pasted into an email, a chat client and a QR code without
 * being mangled or turned into a link ending in a full stop.
 */
export function makeToken(random: () => number = Math.random): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let token = ''

  for (let i = 0; i < 22; i++) {
    token += alphabet[Math.floor(random() * alphabet.length)]
  }

  return token
}

/** Human wording for what a link allows, shown to the seller. */
export function describeTerms(limits: DeliveryLimits): string {
  const parts: string[] = []
  const expiresAt = limits.expiresAt ? new Date(limits.expiresAt) : null

  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    parts.push(`expires ${expiresAt.toLocaleDateString()}`)
  } else {
    parts.push('never expires')
  }

  const cap = limits.maxDownloads ?? null

  parts.push(cap === null ? 'unlimited downloads' : `${cap} download${cap === 1 ? '' : 's'}`)

  return parts.join(' · ')
}

/** Keep an IP as a /24 — enough to spot a shared link, not a home address. */
export function ipPrefix(ip: string | null | undefined): string | null {
  const value = String(ip ?? '').trim()

  if (!value) return null

  // IPv4: drop the last octet.
  const v4 = value.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/)

  if (v4) return `${v4[1]}.0`

  // IPv6: keep the routing prefix only.
  if (value.includes(':')) return `${value.split(':').slice(0, 3).join(':')}::`

  return null
}
