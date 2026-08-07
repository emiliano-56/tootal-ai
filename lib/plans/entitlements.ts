/**
 * What a user is allowed to do, given everything they own.
 *
 * The funnel stacks: buying OTO 2 adds to Front End rather than replacing it,
 * so entitlements are the union of every plan held. Two rules matter and are
 * easy to get backwards:
 *
 *   - Unlimited beats any number. Holding FE (10/month) and OTO 1 (unlimited)
 *     must give unlimited, not 10.
 *   - The higher number wins when two plans both cap the same feature.
 *
 * Pure functions so both can be tested exhaustively.
 */

/** Every gateable tool, keyed by its route segment. */
export const FEATURES = [
  { key: 'comic', label: 'Comic Generator', group: 'Create' },
  { key: 'coloring', label: 'Coloring Book', group: 'Create' },
  { key: 'video', label: 'Video Generator', group: 'Create' },
  { key: 'cover', label: 'Book Cover', group: 'Create' },
  { key: 'chat', label: 'Generate Prompt', group: 'Create' },
  { key: 'business-agent', label: 'Business Agent', group: 'AI Agents' },
  { key: 'comic-agent', label: 'Story to Comic', group: 'AI Agents' },
  { key: 'comic-video', label: 'Comic to Video', group: 'AI Agents' },
  { key: 'cover-designer', label: 'Cover Designer', group: 'AI Agents' },
  { key: 'landing-pages', label: 'Landing Pages', group: 'AI Agents' },
  { key: 'marketing', label: 'Marketing', group: 'AI Agents' },
  { key: 'prompt-studio', label: 'Prompt Studio', group: 'AI Agents' },
  { key: 'dfy-prompts', label: 'DFY Content Packs', group: 'Library' },
  { key: 'analytics', label: 'Analytics', group: 'Library' },
  // What OTO 2 and OTO 3 add. Neither is metered — the first is a library and
  // the second a subscription — but both are gated, which is the point.
  { key: 'dfy-business', label: 'DFY Business Packs', group: 'Done For You' },
  { key: 'autopilot', label: 'Autopilot', group: 'Automation' },
] as const

export type FeatureKey = (typeof FEATURES)[number]['key']

export const FEATURE_KEYS = FEATURES.map((feature) => feature.key)

export function featureLabel(key: string): string {
  return FEATURES.find((feature) => feature.key === key)?.label ?? key
}

export interface Plan {
  id: string
  code: string
  name: string
  isBundle: boolean
  /** Codes a bundle grants. */
  includes: string[]
  /** feature key → monthly limit, null meaning unlimited. */
  features: Record<string, number | null>
  /**
   * Step of the funnel this plan sells.
   *
   * Licence sizes are separate products — "Reseller 100" and "Reseller 150"
   * are two plans sharing the tier `oto4` — so the chain is expressed in
   * tiers: owning either one unlocks OTO 5.
   */
  tier?: string
  /** Tier that must be owned first. Null for Front End and the bundle. */
  requires?: string | null
  /** Accounts this licence allows, for the reseller and white-label tiers. */
  seats?: number | null
}

/** A plan's tier, falling back to its code for catalogues that predate tiers. */
export function tierOf(plan: Plan): string {
  return plan.tier ?? plan.code
}

/** null = unlimited; a number = that many per calendar month. */
export type Limit = number | null

export interface Entitlement {
  allowed: boolean
  limit: Limit
  used: number
  remaining: Limit
  unlimited: boolean
  exhausted: boolean
}

/**
 * Expand bundles into the plans they grant.
 *
 * A bundle that lists a plan the catalogue no longer has is ignored rather
 * than throwing — a retired plan should not break everyone who owns the bundle.
 */
export function expandPlans(owned: Plan[], catalogue: Plan[]): Plan[] {
  const byCode = new Map(catalogue.map((plan) => [plan.code, plan]))
  const resolved = new Map<string, Plan>()

  const add = (plan: Plan, depth = 0) => {
    // Guard against a bundle that includes itself, directly or in a cycle.
    if (depth > 5 || resolved.has(plan.code)) return

    resolved.set(plan.code, plan)

    if (plan.isBundle) {
      for (const code of plan.includes) {
        const included = byCode.get(code)

        if (included) add(included, depth + 1)
      }
    }
  }

  owned.forEach((plan) => add(plan))

  return [...resolved.values()]
}

/**
 * Merge every held plan into one limit per feature.
 *
 * A feature absent from every plan stays absent — that is what locks a tool,
 * as distinct from being present with a limit of 0.
 */
export function mergeLimits(plans: Plan[]): Record<string, Limit> {
  const merged: Record<string, Limit> = {}

  for (const plan of plans) {
    for (const [feature, limit] of Object.entries(plan.features)) {
      if (!(feature in merged)) {
        merged[feature] = limit
        continue
      }

      const current = merged[feature]

      // Unlimited wins outright; otherwise keep the more generous number.
      if (current === null || limit === null) merged[feature] = null
      else merged[feature] = Math.max(current, limit)
    }
  }

  return merged
}

/** Resolve one feature for a user who owns `plans` and has used `used` this month. */
export function entitlementFor(
  limits: Record<string, Limit>,
  feature: string,
  used = 0
): Entitlement {
  if (!(feature in limits)) {
    return { allowed: false, limit: 0, used, remaining: 0, unlimited: false, exhausted: true }
  }

  const limit = limits[feature]
  const safeUsed = Math.max(0, used)

  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      used: safeUsed,
      remaining: null,
      unlimited: true,
      exhausted: false,
    }
  }

  const remaining = Math.max(0, limit - safeUsed)

  return {
    allowed: remaining > 0,
    limit,
    used: safeUsed,
    remaining,
    unlimited: false,
    exhausted: remaining === 0,
  }
}

/** Which tools to show in the sidebar. */
export function unlockedFeatures(limits: Record<string, Limit>): string[] {
  return FEATURE_KEYS.filter((key) => key in limits)
}

/** First day of the current month, matching how usage rows are keyed. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// ---------------------------------------------------------------------------
//  Purchase chain
// ---------------------------------------------------------------------------

/**
 * Extra allowance granted to one account on top of its plan.
 *
 * Applied only to features the plan already unlocks: a bonus on a locked tool
 * would be a back door around the tier the customer has not bought.
 */
export function applyGrants(
  limits: Record<string, Limit>,
  grants: Record<string, number>
): Record<string, Limit> {
  const result = { ...limits }

  for (const [feature, extra] of Object.entries(grants)) {
    if (!(feature in result)) continue

    const current = result[feature]

    // Unlimited cannot be increased.
    if (current === null) continue

    result[feature] = current + Math.max(0, extra)
  }

  return result
}

export interface ChainCheck {
  allowed: boolean
  /** The tier that has to be bought first. */
  missing?: string
  reason?: string
  /** Granting this replaces another licence size of the same tier. */
  replaces?: string
}

/** Tiers an account holds, counting those a bundle grants. */
export function ownedTiers(ownedCodes: string[], catalogue: Plan[]): string[] {
  const owned = catalogue.filter((plan) => ownedCodes.includes(plan.code))

  return [...new Set(expandPlans(owned, catalogue).map(tierOf))]
}

/**
 * Whether a plan can be granted to an account that already owns `ownedCodes`.
 *
 * The tiers are sold in order, so OTO 2 without OTO 1 is not a state the
 * business supports. A bundle satisfies everything, since it grants the chain.
 *
 * Licence sizes are the one case where a tier can be granted twice: moving
 * from 100 seats to 150 is an upgrade, and it replaces rather than adds.
 */
export function canGrantPlan(
  plan: Plan,
  ownedCodes: string[],
  catalogue: Plan[]
): ChainCheck {
  // Holding any bundle short-circuits the chain.
  const holdsBundle = catalogue.some(
    (candidate) => candidate.isBundle && ownedCodes.includes(candidate.code)
  )

  if (ownedCodes.includes(plan.code)) {
    return { allowed: false, reason: 'This account already has that tier.' }
  }

  // Granted through a bundle rather than bought outright — already covered.
  if (holdsBundle && !plan.isBundle) {
    return { allowed: false, reason: 'Already included in the bundle.' }
  }

  // A different licence size of a tier they already own: an upgrade or
  // downgrade, which swaps the two rather than stacking them.
  const sameTier = catalogue.find(
    (candidate) =>
      candidate.code !== plan.code &&
      tierOf(candidate) === tierOf(plan) &&
      ownedCodes.includes(candidate.code)
  )

  if (holdsBundle || !plan.requires) {
    return sameTier ? { allowed: true, replaces: sameTier.code } : { allowed: true }
  }

  if (!ownedTiers(ownedCodes, catalogue).includes(plan.requires)) {
    const required = catalogue.find((candidate) => tierOf(candidate) === plan.requires)

    return {
      allowed: false,
      missing: plan.requires,
      reason: `${required?.name ?? plan.requires} has to be bought first.`,
    }
  }

  return sameTier ? { allowed: true, replaces: sameTier.code } : { allowed: true }
}

/**
 * Every tier an account effectively holds, including those a bundle grants.
 *
 * Distinguishes the two because they behave differently: a directly owned tier
 * can be revoked on its own, while one that arrives through a bundle only goes
 * away when the bundle does.
 */
export function effectiveHoldings(
  ownedCodes: string[],
  catalogue: Plan[]
): { code: string; direct: boolean }[] {
  const owned = catalogue.filter((plan) => ownedCodes.includes(plan.code))
  const effective = expandPlans(owned, catalogue)

  return effective.map((plan) => ({
    code: plan.code,
    direct: ownedCodes.includes(plan.code),
  }))
}

/** Whether a tier is held at all, however it was obtained. */
export function holdsPlan(code: string, ownedCodes: string[], catalogue: Plan[]): boolean {
  return effectiveHoldings(ownedCodes, catalogue).some((held) => held.code === code)
}

/**
 * Removing a tier has to take the ones above it too.
 *
 * Leaving OTO 2 in place after revoking OTO 1 would produce exactly the gap
 * the chain exists to prevent.
 */
export function dependentsOf(code: string, catalogue: Plan[]): string[] {
  const start = catalogue.find((plan) => plan.code === code)

  if (!start) return []

  const dependents: string[] = []
  const queue = [tierOf(start)]

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const plan of catalogue) {
      if (plan.isBundle) continue

      if (plan.requires === current && !dependents.includes(plan.code)) {
        dependents.push(plan.code)
        queue.push(tierOf(plan))
      }
    }
  }

  return dependents
}

/**
 * The tiers in sale order, bundle last.
 *
 * Licence sizes of the same tier come out next to each other, so the panel
 * shows "Reseller — 100" and "Reseller — 150" as the alternatives they are.
 */
export function chainOrder(catalogue: Plan[]): Plan[] {
  const bundles = catalogue.filter((plan) => plan.isBundle)
  const sellable = catalogue.filter((plan) => !plan.isBundle)

  const chain: Plan[] = []
  const seen = new Set<string>()

  const root = sellable.find((plan) => !plan.requires)
  let tier: string | undefined = root ? tierOf(root) : undefined

  while (tier && !seen.has(tier)) {
    seen.add(tier)

    const current = tier

    chain.push(...sellable.filter((plan) => tierOf(plan) === current))

    const next = sellable.find((plan) => plan.requires === current)
    tier = next ? tierOf(next) : undefined
  }

  // Anything not reachable through the chain still deserves to be listed.
  const orphans = sellable.filter((plan) => !chain.some((linked) => linked.code === plan.code))

  return [...chain, ...orphans, ...bundles]
}

/**
 * Seats an account is entitled to, added across every licence it holds.
 *
 * The Mega Bundle contains both the largest reseller licence and the largest
 * white-label one, so a bundle holder gets 150 + 25 — the two products were
 * both bought, and one must not quietly cancel the other.
 */
export function totalSeats(plans: Plan[]): { total: number | null; parts: Plan[] } {
  const parts = plans.filter((plan) => typeof plan.seats === 'number' && plan.seats > 0)

  if (parts.length === 0) return { total: null, parts: [] }

  return { total: parts.reduce((sum, plan) => sum + (plan.seats as number), 0), parts }
}
