/**
 * How much a customer may keep, and what to do when it is full.
 *
 * Distinct from the monthly allowance, which counts how many times you may
 * *generate*. This counts how many you may *keep*. A Front End customer makes
 * ten comics a month and keeps ten comics — running out of the second does not
 * stop them working, it just means something has to go first.
 *
 * That distinction decides the whole flow: hitting this limit must never lose
 * work. The customer is asked, and every answer keeps the file somewhere —
 * downloaded, backed up to their Drive, or knowingly replaced.
 *
 * Pure, so every branch can be tested without a database.
 */

export type LibraryKind = 'comic' | 'coloring' | 'video' | 'cover' | 'episode'

export const LIBRARY_KINDS: { kind: LibraryKind; label: string; plural: string }[] = [
  { kind: 'comic', label: 'Comic', plural: 'Comics' },
  { kind: 'coloring', label: 'Colouring book', plural: 'Colouring books' },
  { kind: 'video', label: 'Video', plural: 'Videos' },
  { kind: 'cover', label: 'Book cover', plural: 'Book covers' },
  { kind: 'episode', label: 'Episode', plural: 'Episodes' },
]

/** null = unlimited, a number = that many kept at once. */
export type LibraryLimit = number | null

/**
 * The limit for someone holding several plans.
 *
 * Same rule as the monthly allowances, and for the same reason: buying a
 * bigger tier must never reduce what you already had. Unlimited wins outright;
 * otherwise the larger number does.
 */
export function mergeLibraryLimits(limits: (number | null | undefined)[]): LibraryLimit {
  const known = limits.filter((value) => value !== undefined)

  if (known.length === 0) return null

  // An explicit null means unlimited and beats every number.
  if (known.some((value) => value === null)) return null

  return Math.max(...(known as number[]))
}

export interface Quota {
  limit: LibraryLimit
  used: number
  remaining: LibraryLimit
  unlimited: boolean
  full: boolean
}

/**
 * The limit for one account, after any grant made to them personally.
 *
 * A superadmin needs to be able to say "this customer keeps thirty" without
 * moving them to a plan they do not otherwise want. The grant adds to the plan
 * rather than replacing it, so upgrading later still helps.
 *
 * An extra on an unlimited plan is a no-op rather than an error — there is
 * nothing above unlimited, and refusing would only confuse whoever typed it.
 */
export function limitWithGrant(planLimit: LibraryLimit, extra = 0): LibraryLimit {
  if (planLimit === null) return null

  return Math.max(0, planLimit) + Math.max(0, extra)
}

export function quotaFor(limit: LibraryLimit, used: number): Quota {
  const safeUsed = Math.max(0, used)

  if (limit === null) {
    return { limit: null, used: safeUsed, remaining: null, unlimited: true, full: false }
  }

  const capped = Math.max(0, limit)

  return {
    limit: capped,
    used: safeUsed,
    remaining: Math.max(0, capped - safeUsed),
    unlimited: false,
    full: safeUsed >= capped,
  }
}

export interface OldestItem {
  id: string
  title: string
  createdAt: string
  /** Already copied to the customer's Drive, so removing it loses nothing. */
  backedUp: boolean
}

export type SaveChoice =
  /** Room to spare — save without asking. */
  | { action: 'save' }
  /** Full. The customer has to choose before anything is written. */
  | {
      action: 'choose'
      quota: Quota
      oldest: OldestItem | null
      /** Offered only when Drive is connected. */
      canBackup: boolean
      /** Already in Drive, so "replace oldest" is the safe default. */
      oldestIsSafe: boolean
    }

/**
 * What should happen when the customer asks to save something.
 *
 * Never decides to delete on its own. The one thing this flow must not do is
 * silently drop work the customer thought was kept — so a full library always
 * returns `choose`, even when the oldest item is already backed up.
 */
export function decideOnSave(input: {
  quota: Quota
  oldest: OldestItem | null
  driveConnected: boolean
}): SaveChoice {
  if (!input.quota.full) return { action: 'save' }

  return {
    action: 'choose',
    quota: input.quota,
    oldest: input.oldest,
    canBackup: input.driveConnected,
    oldestIsSafe: Boolean(input.oldest?.backedUp),
  }
}

/** "10 of 10 comics kept" — the line under a progress bar. */
export function describeQuota(quota: Quota, kind: LibraryKind): string {
  const label = LIBRARY_KINDS.find((entry) => entry.kind === kind)?.plural.toLowerCase() ?? kind

  if (quota.unlimited) return `${quota.used} ${label} kept · unlimited`

  return `${quota.used} of ${quota.limit} ${label} kept`
}

/**
 * How many have to go before `wanted` more will fit.
 *
 * Used when a batch is saved at once, and to word the dialog when a library is
 * over its limit — which happens legitimately after a downgrade.
 */
export function overBy(quota: Quota, wanted = 1): number {
  if (quota.unlimited) return 0

  return Math.max(0, quota.used + wanted - quota.limit!)
}
