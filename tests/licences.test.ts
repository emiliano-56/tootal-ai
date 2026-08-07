import { describe, it, expect } from 'vitest'
import {
  summariseSeats,
  canAddSeat,
  checkSeatAvailable,
  isValidLicenceTier,
  RESELLER_LICENCE_TIERS,
  WHITE_LABEL_LICENCE_TIERS,
} from '@/lib/services/licences'

describe('seat summary', () => {
  it('reports remaining seats for a partly used licence', () => {
    const summary = summariseSeats({ limit: 100, used: 40 })

    expect(summary).toMatchObject({
      purchased: 100,
      used: 40,
      remaining: 60,
      unlimited: false,
      exhausted: false,
      percentUsed: 40,
    })
  })

  it('marks a full licence as exhausted with zero remaining', () => {
    const summary = summariseSeats({ limit: 15, used: 15 })

    expect(summary.exhausted).toBe(true)
    expect(summary.remaining).toBe(0)
    expect(summary.percentUsed).toBe(100)
  })

  it('never reports negative remaining or above 100% when over-provisioned', () => {
    // Can happen if a licence is downgraded after users were created.
    const summary = summariseSeats({ limit: 15, used: 22 })

    expect(summary.remaining).toBe(0)
    expect(summary.percentUsed).toBe(100)
    expect(summary.exhausted).toBe(true)
  })

  it('treats a null limit as unlimited', () => {
    const summary = summariseSeats({ limit: null, used: 5000 })

    expect(summary.unlimited).toBe(true)
    expect(summary.exhausted).toBe(false)
    expect(summary.remaining).toBeNull()
    expect(summary.purchased).toBeNull()
  })

  it('guards against a negative used count', () => {
    expect(summariseSeats({ limit: 25, used: -3 }).used).toBe(0)
  })

  it('does not divide by zero on a zero-seat licence', () => {
    const summary = summariseSeats({ limit: 0, used: 0 })

    expect(summary.percentUsed).toBe(100)
    expect(summary.exhausted).toBe(true)
  })
})

describe('seat availability', () => {
  it('allows creation while seats remain', () => {
    expect(canAddSeat({ limit: 100, used: 99 })).toBe(true)
    expect(checkSeatAvailable({ limit: 100, used: 99 }).allowed).toBe(true)
  })

  it('blocks creation on the seat after the last one', () => {
    expect(canAddSeat({ limit: 100, used: 100 })).toBe(false)

    const check = checkSeatAvailable({ limit: 100, used: 100 })

    expect(check.allowed).toBe(false)
    expect(check.reason).toContain('100 of 100')
  })

  it('always allows creation on an unlimited tenant', () => {
    expect(canAddSeat({ limit: null, used: 10_000 })).toBe(true)
    expect(checkSeatAvailable({ limit: null, used: 10_000 }).allowed).toBe(true)
  })
})

describe('licence tiers', () => {
  it('accepts the reseller tiers from the spec', () => {
    for (const seats of RESELLER_LICENCE_TIERS) {
      expect(isValidLicenceTier('reseller', seats)).toBe(true)
    }
  })

  it('accepts the white-label tiers from the spec', () => {
    for (const seats of WHITE_LABEL_LICENCE_TIERS) {
      expect(isValidLicenceTier('white_label', seats)).toBe(true)
    }
  })

  it('rejects a tier belonging to the other account type', () => {
    expect(isValidLicenceTier('white_label', 100)).toBe(false)
    expect(isValidLicenceTier('reseller', 15)).toBe(false)
  })

  it('rejects arbitrary seat counts and the platform tenant', () => {
    expect(isValidLicenceTier('reseller', 137)).toBe(false)
    expect(isValidLicenceTier('platform', 100)).toBe(false)
  })
})
