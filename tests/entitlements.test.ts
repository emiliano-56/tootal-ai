import { describe, it, expect } from 'vitest'
import {
  expandPlans,
  mergeLimits,
  entitlementFor,
  unlockedFeatures,
  currentPeriod,
  totalSeats,
  featureLabel,
  FEATURE_KEYS,
  type Plan,
} from '@/lib/plans/entitlements'

const plan = (code: string, features: Record<string, number | null>, extra: Partial<Plan> = {}): Plan => ({
  id: code,
  code,
  name: code.toUpperCase(),
  isBundle: false,
  includes: [],
  features,
  ...extra,
})

const FE = plan('fe', { comic: 10, coloring: 10, video: 10, cover: 10, chat: 10 })
const OTO1 = plan('oto1', { comic: null, coloring: null, video: null, cover: null, chat: null })
const OTO2 = plan('oto2', { 'comic-agent': null, 'comic-video': null })
const OTO3 = plan('oto3', { 'business-agent': null, marketing: null })
const OTO4 = plan('oto4', {})
const OTO5 = plan('oto5', {})
const MEGA = plan('mega', {}, { isBundle: true, includes: ['fe', 'oto1', 'oto2', 'oto3', 'oto4', 'oto5'] })

const CATALOGUE = [FE, OTO1, OTO2, OTO3, OTO4, OTO5, MEGA]

describe('bundle expansion', () => {
  it('grants every included plan', () => {
    const codes = expandPlans([MEGA], CATALOGUE).map((p) => p.code).sort()

    expect(codes).toEqual(['fe', 'mega', 'oto1', 'oto2', 'oto3', 'oto4', 'oto5'])
  })

  it('leaves an ordinary plan alone', () => {
    expect(expandPlans([FE], CATALOGUE).map((p) => p.code)).toEqual(['fe'])
  })

  it('does not duplicate a plan owned both directly and through the bundle', () => {
    const codes = expandPlans([FE, MEGA], CATALOGUE).map((p) => p.code)

    expect(codes.filter((c) => c === 'fe')).toHaveLength(1)
  })

  it('ignores an included plan that no longer exists', () => {
    // A retired plan must not break everyone holding the bundle.
    const stale = plan('bundle', {}, { isBundle: true, includes: ['fe', 'removed'] })

    expect(expandPlans([stale], CATALOGUE).map((p) => p.code).sort()).toEqual(['bundle', 'fe'])
  })

  it('survives a bundle that includes itself', () => {
    const loop = plan('loop', {}, { isBundle: true, includes: ['loop'] })

    expect(() => expandPlans([loop], [loop])).not.toThrow()
  })

  it('returns nothing for an account with no plans', () => {
    expect(expandPlans([], CATALOGUE)).toEqual([])
  })
})

describe('merging limits across stacked plans', () => {
  it('unlimited beats a number, whichever order they stack', () => {
    // FE caps comics at 10; OTO 1 removes the cap. Owning both is unlimited.
    expect(mergeLimits([FE, OTO1]).comic).toBeNull()
    expect(mergeLimits([OTO1, FE]).comic).toBeNull()
  })

  it('keeps the more generous number when both are capped', () => {
    const small = plan('a', { comic: 10 })
    const large = plan('b', { comic: 50 })

    expect(mergeLimits([small, large]).comic).toBe(50)
    expect(mergeLimits([large, small]).comic).toBe(50)
  })

  it('adds features from each plan without dropping the others', () => {
    const merged = mergeLimits([FE, OTO2])

    expect(merged.comic).toBe(10)
    expect(merged['comic-agent']).toBeNull()
  })

  it('leaves an unowned feature absent rather than zero', () => {
    // Absent means locked; present-with-zero would mean "ran out".
    expect('marketing' in mergeLimits([FE])).toBe(false)
  })

  it('gives the Mega Bundle everything, unlimited where OTO 1 applies', () => {
    const merged = mergeLimits(expandPlans([MEGA], CATALOGUE))

    expect(merged.comic).toBeNull()
    expect(merged['business-agent']).toBeNull()
    expect(merged.marketing).toBeNull()
  })

  it('returns nothing for no plans', () => {
    expect(mergeLimits([])).toEqual({})
  })
})

describe('per-feature entitlement', () => {
  const feLimits = mergeLimits([FE])

  it('allows use while under the monthly limit', () => {
    expect(entitlementFor(feLimits, 'comic', 3)).toMatchObject({
      allowed: true,
      limit: 10,
      used: 3,
      remaining: 7,
      unlimited: false,
      exhausted: false,
    })
  })

  it('blocks once the limit is reached', () => {
    const result = entitlementFor(feLimits, 'comic', 10)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.exhausted).toBe(true)
  })

  it('never reports negative remaining if usage overshot', () => {
    expect(entitlementFor(feLimits, 'comic', 15).remaining).toBe(0)
  })

  it('reports unlimited without a remaining count', () => {
    const result = entitlementFor(mergeLimits([FE, OTO1]), 'comic', 9999)

    expect(result).toMatchObject({ allowed: true, unlimited: true, remaining: null })
  })

  it('denies a feature the account does not own', () => {
    expect(entitlementFor(feLimits, 'marketing', 0)).toMatchObject({
      allowed: false,
      exhausted: true,
    })
  })

  it('treats a zero limit as owned but exhausted', () => {
    expect(entitlementFor({ comic: 0 }, 'comic', 0)).toMatchObject({
      allowed: false,
      limit: 0,
      exhausted: true,
    })
  })
})

describe('sidebar unlocking', () => {
  it('shows only the tools a plan grants', () => {
    const unlocked = unlockedFeatures(mergeLimits([FE]))

    expect(unlocked).toContain('comic')
    expect(unlocked).not.toContain('marketing')
  })

  it('shows everything for the Mega Bundle', () => {
    const unlocked = unlockedFeatures(mergeLimits(expandPlans([MEGA], CATALOGUE)))

    expect(unlocked).toContain('comic')
    expect(unlocked).toContain('business-agent')
    expect(unlocked).toContain('comic-agent')
  })

  it('shows nothing for an account with no plan', () => {
    expect(unlockedFeatures({})).toEqual([])
  })

  it('only ever returns known feature keys', () => {
    const unlocked = unlockedFeatures({ comic: 1, 'not-a-feature': 1 })

    expect(unlocked).toEqual(['comic'])
    expect(unlocked.every((key) => FEATURE_KEYS.includes(key as never))).toBe(true)
  })
})

describe('usage period', () => {
  it('keys usage to the first of the month in UTC', () => {
    expect(currentPeriod(new Date('2026-08-17T23:30:00Z'))).toBe('2026-08-01')
    expect(currentPeriod(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-01')
  })

  it('pads single-digit months', () => {
    expect(currentPeriod(new Date('2026-03-05T00:00:00Z'))).toBe('2026-03-01')
  })
})

describe('seats', () => {
  it('adds the licences up', () => {
    // Someone holding both products bought both, so the seats stack.
    const { total, parts } = totalSeats([
      { ...OTO4, seats: 150 },
      { ...OTO5, seats: 25 },
    ])

    expect(total).toBe(175)
    expect(parts).toHaveLength(2)
  })

  it('reports no seats when nothing sells any', () => {
    expect(totalSeats([FE, OTO1]).total).toBeNull()
  })

  it('skips plans with a zero or missing seat count', () => {
    expect(totalSeats([FE, { ...OTO4, seats: 100 }, { ...OTO5, seats: 0 }]).total).toBe(100)
  })
})

describe('feature labels', () => {
  it('gives a readable name for every known key', () => {
    for (const key of FEATURE_KEYS) {
      expect(featureLabel(key)).not.toBe(key)
    }
  })

  it('falls back to the key for an unknown feature', () => {
    expect(featureLabel('mystery')).toBe('mystery')
  })
})

// ---------------------------------------------------------------------------
//  Purchase chain
// ---------------------------------------------------------------------------

import { applyGrants, canGrantPlan, dependentsOf, chainOrder } from '@/lib/plans/entitlements'

const CHAIN: Plan[] = [
  { ...FE, requires: null },
  { ...OTO1, requires: 'fe' },
  { ...OTO2, requires: 'oto1' },
  { ...OTO3, requires: 'oto2' },
  { ...OTO4, requires: 'oto3' },
  { ...OTO5, requires: 'oto4' },
  { ...MEGA, requires: null },
]

const byCode = (code: string) => CHAIN.find((p) => p.code === code)!

describe('purchase chain', () => {
  it('allows Front End with nothing owned', () => {
    expect(canGrantPlan(byCode('fe'), [], CHAIN).allowed).toBe(true)
  })

  it('refuses OTO 1 before Front End', () => {
    const check = canGrantPlan(byCode('oto1'), [], CHAIN)

    expect(check.allowed).toBe(false)
    expect(check.missing).toBe('fe')
    expect(check.reason).toContain('has to be bought first')
  })

  it('allows OTO 1 once Front End is owned', () => {
    expect(canGrantPlan(byCode('oto1'), ['fe'], CHAIN).allowed).toBe(true)
  })

  it('refuses a tier two steps ahead', () => {
    // Owning FE is not enough for OTO 2 — OTO 1 sits between them.
    expect(canGrantPlan(byCode('oto2'), ['fe'], CHAIN).missing).toBe('oto1')
  })

  it('walks the whole chain in order', () => {
    const owned: string[] = []

    for (const code of ['fe', 'oto1', 'oto2', 'oto3', 'oto4', 'oto5']) {
      expect(canGrantPlan(byCode(code), owned, CHAIN).allowed).toBe(true)
      owned.push(code)
    }
  })

  it('lets the bundle be granted on its own', () => {
    expect(canGrantPlan(byCode('mega'), [], CHAIN).allowed).toBe(true)
  })

  it('does not offer a bundle holder a tier they already have through it', () => {
    // The bundle grants the whole chain, so granting a tier separately would
    // add a row that changes nothing.
    const check = canGrantPlan(byCode('oto5'), ['mega'], CHAIN)

    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('bundle')
  })

  it('refuses a tier the account already owns', () => {
    expect(canGrantPlan(byCode('fe'), ['fe'], CHAIN).allowed).toBe(false)
  })
})

describe('revoking a tier', () => {
  it('lists every tier above the one being removed', () => {
    expect(dependentsOf('oto1', CHAIN)).toEqual(['oto2', 'oto3', 'oto4', 'oto5'])
  })

  it('lists the whole chain above Front End', () => {
    expect(dependentsOf('fe', CHAIN)).toEqual(['oto1', 'oto2', 'oto3', 'oto4', 'oto5'])
  })

  it('reports nothing above the top tier', () => {
    expect(dependentsOf('oto5', CHAIN)).toEqual([])
  })

  it('reports nothing for the standalone bundle', () => {
    expect(dependentsOf('mega', CHAIN)).toEqual([])
  })
})

describe('chain ordering', () => {
  it('lists the tiers in sale order with the bundle last', () => {
    expect(chainOrder(CHAIN).map((p) => p.code)).toEqual([
      'fe', 'oto1', 'oto2', 'oto3', 'oto4', 'oto5', 'mega',
    ])
  })

  it('still lists a plan that sits outside the chain', () => {
    const stray = plan('extra', {})
    const codes = chainOrder([...CHAIN, stray]).map((p) => p.code)

    expect(codes).toContain('extra')
  })
})

describe('per-account extra allowance', () => {
  it('adds the extra on top of the plan limit', () => {
    expect(applyGrants({ comic: 10 }, { comic: 5 }).comic).toBe(15)
  })

  it('leaves unlimited alone', () => {
    expect(applyGrants({ comic: null }, { comic: 5 }).comic).toBeNull()
  })

  it('ignores a bonus on a tool the plan does not include', () => {
    // Otherwise a grant would unlock a tier the customer has not bought.
    const result = applyGrants({ comic: 10 }, { marketing: 20 })

    expect('marketing' in result).toBe(false)
  })

  it('treats a negative bonus as zero', () => {
    expect(applyGrants({ comic: 10 }, { comic: -5 }).comic).toBe(10)
  })

  it('does not mutate the limits it was given', () => {
    const limits = { comic: 10 }

    applyGrants(limits, { comic: 5 })

    expect(limits.comic).toBe(10)
  })
})

import { effectiveHoldings, holdsPlan } from '@/lib/plans/entitlements'

describe('what a bundle holder effectively owns', () => {
  it('reports every tier the bundle grants, not just the bundle row', () => {
    // The console shows checkboxes from this: a bundle holder must see the
    // whole chain ticked, because that is what they can actually use.
    const codes = effectiveHoldings(['mega'], CHAIN).map((h) => h.code).sort()

    expect(codes).toEqual(['fe', 'mega', 'oto1', 'oto2', 'oto3', 'oto4', 'oto5'])
  })

  it('marks bundle-granted tiers as indirect', () => {
    const holdings = effectiveHoldings(['mega'], CHAIN)

    expect(holdings.find((h) => h.code === 'mega')!.direct).toBe(true)
    expect(holdings.find((h) => h.code === 'oto3')!.direct).toBe(false)
  })

  it('marks a separately bought tier as direct even alongside a bundle', () => {
    const holdings = effectiveHoldings(['fe', 'mega'], CHAIN)

    expect(holdings.find((h) => h.code === 'fe')!.direct).toBe(true)
  })

  it('reports only what was bought when there is no bundle', () => {
    const codes = effectiveHoldings(['fe', 'oto1'], CHAIN).map((h) => h.code).sort()

    expect(codes).toEqual(['fe', 'oto1'])
  })

  it('answers holdsPlan through the bundle', () => {
    expect(holdsPlan('oto5', ['mega'], CHAIN)).toBe(true)
    expect(holdsPlan('oto5', ['fe'], CHAIN)).toBe(false)
  })

  it('reports nothing for an account with no plans', () => {
    expect(effectiveHoldings([], CHAIN)).toEqual([])
  })
})

describe('granting alongside a bundle', () => {
  it('refuses a tier the bundle already covers', () => {
    const check = canGrantPlan(byCode('oto2'), ['mega'], CHAIN)

    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('Already included in the bundle')
  })

  it('still allows the bundle itself to be granted to someone mid-chain', () => {
    expect(canGrantPlan(byCode('mega'), ['fe', 'oto1'], CHAIN).allowed).toBe(true)
  })
})


// ---------------------------------------------------------------------------
//  Licence variants
// ---------------------------------------------------------------------------
//  The 100 and 150 seat reseller products are two plans on one tier. The chain
//  is expressed in tiers so that either of them unlocks OTO 5.

import { ownedTiers, tierOf } from '@/lib/plans/entitlements'

const VARIANTS: Plan[] = [
  { ...FE, tier: 'fe', requires: null },
  { ...OTO1, tier: 'oto1', requires: 'fe' },
  { ...OTO2, tier: 'oto2', requires: 'oto1' },
  { ...OTO3, tier: 'oto3', requires: 'oto2' },
  { ...plan('oto4_100', {}), tier: 'oto4', requires: 'oto3', seats: 100 },
  { ...plan('oto4_150', {}), tier: 'oto4', requires: 'oto3', seats: 150 },
  { ...plan('oto5_15', {}), tier: 'oto5', requires: 'oto4', seats: 15 },
  { ...plan('oto5_25', {}), tier: 'oto5', requires: 'oto4', seats: 25 },
  {
    ...MEGA,
    tier: 'bundle',
    includes: ['fe', 'oto1', 'oto2', 'oto3', 'oto4_150', 'oto5_25'],
  },
]

const variant = (code: string) => VARIANTS.find((p) => p.code === code)!

describe('licence variants', () => {
  it('falls back to the code when a catalogue has no tiers', () => {
    expect(tierOf(FE)).toBe('fe')
    expect(tierOf(variant('oto4_150'))).toBe('oto4')
  })

  it('unlocks the next tier from either licence size', () => {
    const base = ['fe', 'oto1', 'oto2', 'oto3']

    expect(canGrantPlan(variant('oto5_15'), [...base, 'oto4_100'], VARIANTS).allowed).toBe(true)
    expect(canGrantPlan(variant('oto5_15'), [...base, 'oto4_150'], VARIANTS).allowed).toBe(true)
  })

  it('still refuses a tier whose prerequisite is missing', () => {
    const check = canGrantPlan(variant('oto5_25'), ['fe', 'oto1', 'oto2', 'oto3'], VARIANTS)

    expect(check.allowed).toBe(false)
    expect(check.missing).toBe('oto4')
  })

  it('treats the other licence size as a replacement, not an addition', () => {
    const owned = ['fe', 'oto1', 'oto2', 'oto3', 'oto4_100']
    const check = canGrantPlan(variant('oto4_150'), owned, VARIANTS)

    expect(check.allowed).toBe(true)
    expect(check.replaces).toBe('oto4_100')
  })

  it('refuses the licence size already held', () => {
    const owned = ['fe', 'oto1', 'oto2', 'oto3', 'oto4_100']

    expect(canGrantPlan(variant('oto4_100'), owned, VARIANTS).allowed).toBe(false)
  })

  it('counts the tiers a bundle grants', () => {
    expect(ownedTiers(['mega'], VARIANTS).sort()).toEqual([
      'bundle', 'fe', 'oto1', 'oto2', 'oto3', 'oto4', 'oto5',
    ])
  })

  it('lists the licence sizes of a tier next to each other', () => {
    expect(chainOrder(VARIANTS).map((p) => p.code)).toEqual([
      'fe', 'oto1', 'oto2', 'oto3', 'oto4_100', 'oto4_150', 'oto5_15', 'oto5_25', 'mega',
    ])
  })

  it('takes every licence size above a revoked tier', () => {
    // Removing OTO 3 has to clear both reseller sizes and both white-label
    // ones, or the account keeps a tier with nothing beneath it.
    expect(dependentsOf('oto3', VARIANTS)).toEqual([
      'oto4_100', 'oto4_150', 'oto5_15', 'oto5_25',
    ])
  })

  it('does not treat one licence size as depending on the other', () => {
    expect(dependentsOf('oto4_100', VARIANTS)).toEqual(['oto5_15', 'oto5_25'])
  })
})
