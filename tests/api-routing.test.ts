import { describe, it, expect } from 'vitest'
import {
  buildFailoverChain,
  selectCredential,
  isUsable,
  isWithinLimits,
  type Credential,
} from '@/lib/services/api-routing'

function credential(overrides: Partial<Credential> & { id: string }): Credential {
  return {
    provider: 'openai',
    scope: 'platform',
    enabled: true,
    priority: 100,
    ...overrides,
  }
}

describe('limits', () => {
  it('treats an absent limit as unlimited', () => {
    expect(isWithinLimits(credential({ id: 'a', usedToday: 999_999 }))).toBe(true)
  })

  it('stops at the daily limit', () => {
    expect(isWithinLimits(credential({ id: 'a', dailyLimit: 10, usedToday: 9 }))).toBe(true)
    expect(isWithinLimits(credential({ id: 'a', dailyLimit: 10, usedToday: 10 }))).toBe(false)
  })

  it('stops at the monthly limit even when the daily one is fine', () => {
    const cred = credential({
      id: 'a',
      dailyLimit: 100,
      usedToday: 1,
      monthlyLimit: 500,
      usedThisMonth: 500,
    })

    expect(isWithinLimits(cred)).toBe(false)
    expect(isUsable(cred)).toBe(false)
  })

  it('excludes disabled credentials regardless of limits', () => {
    expect(isUsable(credential({ id: 'a', enabled: false }))).toBe(false)
  })
})

describe('platform_only mode', () => {
  it('ignores personal keys entirely', () => {
    const chain = buildFailoverChain(
      [
        credential({ id: 'user-key', scope: 'user', priority: 1 }),
        credential({ id: 'platform-key', scope: 'platform', priority: 50 }),
      ],
      'platform_only'
    )

    expect(chain.map((c) => c.id)).toEqual(['platform-key'])
  })

  it('returns null when the user only has personal keys', () => {
    const selected = selectCredential(
      [credential({ id: 'user-key', scope: 'user' })],
      'platform_only'
    )

    expect(selected).toBeNull()
  })
})

describe('personal_allowed mode', () => {
  it('puts the user keys first and keeps platform keys as backup', () => {
    const chain = buildFailoverChain(
      [
        credential({ id: 'platform-fast', scope: 'platform', priority: 1 }),
        credential({ id: 'user-slow', scope: 'user', priority: 900 }),
      ],
      'personal_allowed'
    )

    // The user's own key wins even with a far worse priority number.
    expect(chain.map((c) => c.id)).toEqual(['user-slow', 'platform-fast'])
  })

  it('orders within the user group by priority', () => {
    const chain = buildFailoverChain(
      [
        credential({ id: 'user-b', scope: 'user', priority: 20 }),
        credential({ id: 'user-a', scope: 'user', priority: 10 }),
        credential({ id: 'platform', scope: 'platform', priority: 1 }),
      ],
      'personal_allowed'
    )

    expect(chain.map((c) => c.id)).toEqual(['user-a', 'user-b', 'platform'])
  })
})

describe('mixed mode', () => {
  it('ranks purely on priority, ignoring ownership', () => {
    const chain = buildFailoverChain(
      [
        credential({ id: 'user-key', scope: 'user', priority: 80 }),
        credential({ id: 'platform-key', scope: 'platform', priority: 10 }),
      ],
      'mixed'
    )

    expect(chain.map((c) => c.id)).toEqual(['platform-key', 'user-key'])
  })
})

describe('health and stability', () => {
  it('sinks a credential whose last health check failed, without dropping it', () => {
    const chain = buildFailoverChain(
      [
        credential({ id: 'broken', priority: 1, lastTestOk: false }),
        credential({ id: 'healthy', priority: 50, lastTestOk: true }),
      ],
      'mixed'
    )

    expect(chain.map((c) => c.id)).toEqual(['healthy', 'broken'])
    expect(chain).toHaveLength(2)
  })

  it('breaks priority ties deterministically instead of by input order', () => {
    const forwards = buildFailoverChain(
      [credential({ id: 'bbb', priority: 10 }), credential({ id: 'aaa', priority: 10 })],
      'mixed'
    )

    const backwards = buildFailoverChain(
      [credential({ id: 'aaa', priority: 10 }), credential({ id: 'bbb', priority: 10 })],
      'mixed'
    )

    expect(forwards.map((c) => c.id)).toEqual(['aaa', 'bbb'])
    expect(backwards.map((c) => c.id)).toEqual(['aaa', 'bbb'])
  })

  it('does not mutate the array it was given', () => {
    const input = [
      credential({ id: 'b', priority: 90 }),
      credential({ id: 'a', priority: 10 }),
    ]

    buildFailoverChain(input, 'mixed')

    expect(input.map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('provider filtering', () => {
  it('narrows the chain to one provider when asked', () => {
    const chain = buildFailoverChain(
      [
        credential({ id: 'openai-1', provider: 'openai', priority: 5 }),
        credential({ id: 'claude-1', provider: 'claude', priority: 1 }),
        credential({ id: 'claude-2', provider: 'claude', priority: 9 }),
      ],
      'mixed',
      { provider: 'claude' }
    )

    expect(chain.map((c) => c.id)).toEqual(['claude-1', 'claude-2'])
  })

  it('skips exhausted credentials and falls through to the next', () => {
    const selected = selectCredential(
      [
        credential({ id: 'exhausted', priority: 1, dailyLimit: 5, usedToday: 5 }),
        credential({ id: 'next-up', priority: 2 }),
      ],
      'mixed'
    )

    expect(selected?.id).toBe('next-up')
  })

  it('returns null when nothing is usable', () => {
    expect(
      selectCredential([credential({ id: 'off', enabled: false })], 'mixed')
    ).toBeNull()

    expect(selectCredential([], 'mixed')).toBeNull()
  })
})
