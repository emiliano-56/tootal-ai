import { describe, it, expect } from 'vitest'
import {
  effectivePolicy,
  canUsePersonalKeys,
  describePolicy,
  toPolicyMode,
  isPolicyMode,
  policyLabel,
  POLICY_MODES,
} from '@/lib/ai/policy'

describe('the master switch', () => {
  it('forces platform keys when it is off', () => {
    expect(effectivePolicy({ allowPersonalKeys: false })).toBe('platform_only')
  })

  it('overrides a per-user grant', () => {
    // The whole reason the switch exists. An owner turning it off expects
    // traffic to come back to their keys — if a per-user override survived,
    // every account that mattered would quietly carry on as before.
    expect(
      effectivePolicy({ allowPersonalKeys: false, userPolicy: 'personal_allowed' })
    ).toBe('platform_only')
  })

  it('overrides a permissive default too', () => {
    expect(effectivePolicy({ allowPersonalKeys: false, defaultPolicy: 'mixed' })).toBe(
      'platform_only'
    )
  })

  it('restores exactly what was there when switched back on', () => {
    const account = { userPolicy: 'mixed' as const, defaultPolicy: 'personal_allowed' as const }

    expect(effectivePolicy({ ...account, allowPersonalKeys: false })).toBe('platform_only')
    expect(effectivePolicy({ ...account, allowPersonalKeys: true })).toBe('mixed')
  })
})

describe('which mode applies', () => {
  it('uses the account override before the default', () => {
    expect(
      effectivePolicy({
        allowPersonalKeys: true,
        defaultPolicy: 'platform_only',
        userPolicy: 'personal_allowed',
      })
    ).toBe('personal_allowed')
  })

  it('falls back to the default when the account has no override', () => {
    expect(
      effectivePolicy({ allowPersonalKeys: true, defaultPolicy: 'mixed', userPolicy: null })
    ).toBe('mixed')
  })

  it('falls back to platform keys when neither is set', () => {
    // The behaviour every installation had before any of this existed.
    expect(effectivePolicy({ allowPersonalKeys: true })).toBe('platform_only')
  })

  it('treats a switched-on platform with a platform_only default as off', () => {
    expect(
      canUsePersonalKeys({ allowPersonalKeys: true, defaultPolicy: 'platform_only' })
    ).toBe(false)
  })
})

describe('reading a mode off stored data', () => {
  it('accepts the three real modes', () => {
    for (const entry of POLICY_MODES) expect(isPolicyMode(entry.value)).toBe(true)
  })

  it('falls back to the safest mode for anything else', () => {
    // A typo in a settings row must not take generation down.
    expect(toPolicyMode('personal-allowed')).toBe('platform_only')
    expect(toPolicyMode(undefined)).toBe('platform_only')
    expect(toPolicyMode(null)).toBe('platform_only')
    expect(toPolicyMode(42)).toBe('platform_only')
    expect(toPolicyMode({ mode: 'mixed' })).toBe('platform_only')
  })

  it('labels every mode', () => {
    for (const entry of POLICY_MODES) {
      expect(policyLabel(entry.value)).toBe(entry.label)
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })
})

describe('what the customer is told', () => {
  it('says there is nothing to do when personal keys are off', () => {
    const text = describePolicy({ allowPersonalKeys: false }, false)

    expect(text).toContain('platform')
    expect(text).toContain('nothing for you to set up')
  })

  it('invites a key when allowed and none is added', () => {
    const text = describePolicy(
      { allowPersonalKeys: true, defaultPolicy: 'personal_allowed' },
      false
    )

    expect(text).toContain('add your own')
  })

  it('promises a fallback once a key exists', () => {
    // The thing a customer most wants to know before trusting it with a job.
    const text = describePolicy(
      { allowPersonalKeys: true, defaultPolicy: 'personal_allowed' },
      true
    )

    expect(text).toContain('used first')
    expect(text).toContain('takes over')
  })

  it('describes mixed as a pool rather than a fallback', () => {
    const text = describePolicy({ allowPersonalKeys: true, defaultPolicy: 'mixed' }, true)

    expect(text).toContain('priority')
  })
})

describe('canUsePersonalKeys agrees with effectivePolicy', () => {
  // These must never disagree: one decides whether the key form is shown, the
  // other whether the key is used. A screen that saves a credential nothing
  // reads is worse than no screen at all.
  const cases = [true, false].flatMap((allowPersonalKeys) =>
    [null, 'platform_only', 'personal_allowed', 'mixed'].flatMap((defaultPolicy) =>
      [null, 'platform_only', 'personal_allowed', 'mixed'].map((userPolicy) => ({
        allowPersonalKeys,
        defaultPolicy: defaultPolicy as never,
        userPolicy: userPolicy as never,
      }))
    )
  )

  it.each(cases)('%o', (input) => {
    expect(canUsePersonalKeys(input)).toBe(effectivePolicy(input) !== 'platform_only')
  })
})
