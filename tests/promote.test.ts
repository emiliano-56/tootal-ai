import { describe, it, expect } from 'vitest'
import { roleFromPlans, seatBreakdown, type PlanWithRole } from '@/lib/plans/roles'

const plan = (code: string, extra: Partial<PlanWithRole> = {}): PlanWithRole => ({
  id: code,
  code,
  name: code.toUpperCase(),
  isBundle: false,
  includes: [],
  features: {},
  tier: code,
  grantsRole: null,
  seats: null,
  ...extra,
})

const CATALOGUE: PlanWithRole[] = [
  plan('fe'),
  plan('oto1', { requires: 'fe' }),
  plan('oto2', { requires: 'oto1' }),
  plan('oto3', { requires: 'oto2' }),
  plan('oto4_100', { tier: 'oto4', requires: 'oto3', grantsRole: 'reseller', seats: 100 }),
  plan('oto4_150', { tier: 'oto4', requires: 'oto3', grantsRole: 'reseller', seats: 150 }),
  plan('oto5_15', { tier: 'oto5', requires: 'oto4', grantsRole: 'white_label', seats: 15 }),
  plan('oto5_25', { tier: 'oto5', requires: 'oto4', grantsRole: 'white_label', seats: 25 }),
  plan('mega', {
    tier: 'bundle',
    isBundle: true,
    includes: ['fe', 'oto1', 'oto2', 'oto3', 'oto4_150', 'oto5_25'],
  }),
]

describe('account type from purchases', () => {
  it('leaves an ordinary customer as a plain user', () => {
    expect(roleFromPlans(['fe', 'oto1'], CATALOGUE).role).toBeNull()
  })

  it('makes an OTO 4 buyer a reseller with the seats they bought', () => {
    const small = roleFromPlans(['fe', 'oto1', 'oto2', 'oto3', 'oto4_100'], CATALOGUE)
    const large = roleFromPlans(['fe', 'oto1', 'oto2', 'oto3', 'oto4_150'], CATALOGUE)

    expect(small.role).toBe('reseller')
    expect(small.seats).toBe(100)
    expect(large.seats).toBe(150)
  })

  it('makes an OTO 5 buyer a white label', () => {
    expect(roleFromPlans(['oto4_100', 'oto5_15'], CATALOGUE).role).toBe('white_label')
  })

  it('gives white label precedence when both tiers are held', () => {
    // A profile carries one role, so the higher tier has to win — otherwise
    // buying OTO 5 could downgrade someone to reseller.
    expect(roleFromPlans(['oto5_15', 'oto4_100'], CATALOGUE).role).toBe('white_label')
    expect(roleFromPlans(['oto4_100', 'oto5_15'], CATALOGUE).role).toBe('white_label')
  })

  it('adds the seats of both licences together', () => {
    // They bought two products. One must not silently cancel the other.
    const both = roleFromPlans(['oto4_100', 'oto5_15'], CATALOGUE)

    expect(both.seats).toBe(115)
    expect(seatBreakdown(both.licences)).toBe('15 white label + 100 reseller')
  })

  it('gives a bundle holder the largest licence of each tier', () => {
    const { role, plan: source, seats } = roleFromPlans(['mega'], CATALOGUE)

    expect(role).toBe('white_label')
    expect(source?.code).toBe('oto5_25')
    expect(seats).toBe(175)
  })

  it('returns nothing for an account with no plans', () => {
    expect(roleFromPlans([], CATALOGUE).role).toBeNull()
  })

  it('ignores a code that is not in the catalogue', () => {
    expect(roleFromPlans(['ghost'], CATALOGUE).role).toBeNull()
  })

  it('drops back to no role once the tiers are gone', () => {
    // Revoking OTO 4 has to leave nothing granting an account type.
    const gone = roleFromPlans(['fe', 'oto1'], CATALOGUE)

    expect(gone.role).toBeNull()
    expect(gone.seats).toBeNull()
  })
})
