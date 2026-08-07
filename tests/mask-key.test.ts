import { describe, it, expect } from 'vitest'
import { maskKey } from '@/lib/services/mask'

describe('credential masking', () => {
  it('shows only the first and last four characters', () => {
    expect(maskKey('sk-abcdef1234567890wxyz')).toBe('sk-a••••wxyz')
  })

  it('never leaks the middle of the key', () => {
    const key = 'sk-SUPERSECRETMIDDLEPART9999'

    expect(maskKey(key)).not.toContain('SUPERSECRET')
    expect(maskKey(key)).not.toContain('MIDDLE')
  })

  it('fully masks a short key rather than revealing most of it', () => {
    // An 8-character key would otherwise be shown in full by a first/last-four rule.
    expect(maskKey('12345678')).toBe('••••')
    expect(maskKey('abc')).toBe('••••')
  })

  it('handles the URL-only backend, which stores no key', () => {
    expect(maskKey('')).toBe('••••')
  })

  it('output length never hints at the real key length', () => {
    expect(maskKey('sk-' + 'x'.repeat(200))).toHaveLength('sk-x••••xxxx'.length)
  })
})
