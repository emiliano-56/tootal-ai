import { expandPlans, totalSeats, type Plan } from '@/lib/plans/entitlements'
import type { Role } from '@/lib/auth/rbac'

/**
 * Which account type a set of purchases entitles someone to, and how many
 * seats come with it.
 *
 * OTO 4 sells a reseller licence, OTO 5 a white-label one, and the Mega Bundle
 * contains both. A profile carries one role, so the higher tier wins —
 * otherwise buying the top tier could quietly demote someone.
 *
 * Seats add up rather than replace. Someone holding the bundle bought both the
 * 150-seat reseller licence and the 25-seat white-label one, so they get 175
 * accounts, not whichever the code happened to look at last.
 *
 * Kept free of `server-only` so the rules can be unit tested; the database work
 * that acts on them lives in lib/plans/promote.ts.
 */

const ROLE_RANK: Record<string, number> = { reseller: 1, white_label: 2 }

export interface PlanWithRole extends Plan {
  grantsRole?: Role | null
}

export interface RoleEntitlement {
  role: Role | null
  /** The licence that decided the role. */
  plan: PlanWithRole | null
  /** Every licence contributing seats, largest tier first. */
  licences: PlanWithRole[]
  seats: number | null
}

export function roleFromPlans(
  ownedCodes: string[],
  catalogue: PlanWithRole[]
): RoleEntitlement {
  const owned = catalogue.filter((plan) => ownedCodes.includes(plan.code))

  // Expanded first, so a bundle holder is promoted by the tiers it contains
  // even though they never bought them individually.
  const effective = expandPlans(owned, catalogue) as PlanWithRole[]

  const licences = effective
    .filter((plan) => plan.grantsRole)
    .sort((a, b) => ROLE_RANK[b.grantsRole!] - ROLE_RANK[a.grantsRole!])

  const best = licences[0] ?? null
  const { total } = totalSeats(licences)

  return { role: best?.grantsRole ?? null, plan: best, licences, seats: total }
}

/** "150 reseller + 25 white label" — how the seat count was arrived at. */
export function seatBreakdown(licences: PlanWithRole[]): string {
  return licences
    .filter((plan) => typeof plan.seats === 'number' && plan.seats > 0)
    .map((plan) => `${plan.seats} ${plan.grantsRole?.replace('_', ' ') ?? ''}`.trim())
    .join(' + ')
}
