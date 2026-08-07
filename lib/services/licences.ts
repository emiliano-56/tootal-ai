/**
 * Licence seat maths.
 *
 * Kept as pure functions so the rules can be tested without a database, and
 * so the dashboard counters and the create-user guard can never disagree —
 * both call the same code. The database trigger in 002 enforces the same
 * limit independently.
 */

export type TenantType = 'platform' | 'reseller' | 'white_label'

/** Seat counts the spec expects to be sold. */
export const RESELLER_LICENCE_TIERS = [100, 150] as const
export const WHITE_LABEL_LICENCE_TIERS = [15, 25] as const

export interface SeatUsage {
  limit: number | null // null = unlimited (platform tenant)
  used: number
}

export interface SeatSummary {
  purchased: number | null
  used: number
  remaining: number | null
  unlimited: boolean
  exhausted: boolean
  percentUsed: number
}

export function summariseSeats({ limit, used }: SeatUsage): SeatSummary {
  const safeUsed = Math.max(0, used)

  if (limit === null) {
    return {
      purchased: null,
      used: safeUsed,
      remaining: null,
      unlimited: true,
      exhausted: false,
      percentUsed: 0,
    }
  }

  const purchased = Math.max(0, limit)
  const remaining = Math.max(0, purchased - safeUsed)

  return {
    purchased,
    used: safeUsed,
    remaining,
    unlimited: false,
    exhausted: safeUsed >= purchased,
    // Clamped so an over-provisioned tenant does not render a >100% bar.
    percentUsed: purchased === 0 ? 100 : Math.min(100, Math.round((safeUsed / purchased) * 100)),
  }
}

export function canAddSeat(usage: SeatUsage): boolean {
  return summariseSeats(usage).unlimited || !summariseSeats(usage).exhausted
}

export interface SeatCheck {
  allowed: boolean
  reason?: string
}

/** The message shown when creation is blocked, phrased for the dashboard. */
export function checkSeatAvailable(usage: SeatUsage): SeatCheck {
  const summary = summariseSeats(usage)

  if (summary.unlimited) return { allowed: true }

  if (summary.exhausted) {
    return {
      allowed: false,
      reason: `Licence limit reached — ${summary.used} of ${summary.purchased} seats used. Upgrade the licence to add more users.`,
    }
  }

  return { allowed: true }
}

/** Valid seat tiers for a tenant type, used to validate licence assignment. */
export function isValidLicenceTier(type: TenantType, seats: number): boolean {
  if (type === 'platform') return false

  const tiers: readonly number[] =
    type === 'reseller' ? RESELLER_LICENCE_TIERS : WHITE_LABEL_LICENCE_TIERS

  return tiers.includes(seats)
}
