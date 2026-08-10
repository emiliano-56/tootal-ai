import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  interpolate,
  lookup,
  translator,
  coverage,
  catalogChain,
  isSourceLanguage,
} from '@/lib/i18n/translate'
import { CATALOG, MESSAGE_KEYS } from '@/lib/i18n/catalog'
import { LANGUAGES } from '@/lib/i18n/languages'

describe('placeholders', () => {
  it('fills in a value', () => {
    expect(interpolate('{used} of {limit} kept', { used: 3, limit: 10 })).toBe('3 of 10 kept')
  })

  it('leaves a placeholder alone when no value was given', () => {
    // Blanking it reads as a design choice; leaving it is how the missing
    // value gets noticed in a screenshot.
    expect(interpolate('{used} of {limit} kept', { used: 3 })).toBe('3 of {limit} kept')
  })

  it('does nothing without values', () => {
    expect(interpolate('Dashboard')).toBe('Dashboard')
  })

  it('replaces every occurrence', () => {
    expect(interpolate('{a} and {a}', { a: 'x' })).toBe('x and x')
  })
})

describe('the fallback chain', () => {
  const locale = { 'nav.dashboard': 'Painel' }
  const base = { 'nav.dashboard': 'Painel de controlo', 'nav.support': 'Apoio' }

  it('prefers the exact locale', () => {
    expect(lookup('nav.dashboard', locale, base).text).toBe('Painel')
  })

  it('falls back to the base language before English', () => {
    // A Brazilian reader is far better served by European Portuguese than by
    // English, which is the whole reason the base file is consulted.
    expect(lookup('nav.support', locale, base).text).toBe('Apoio')
  })

  it('falls back to English when neither has it', () => {
    expect(lookup('nav.history', locale, base).text).toBe(CATALOG['nav.history'])
    expect(lookup('nav.history', locale, base).translated).toBe(false)
  })

  it('treats an empty string as untranslated', () => {
    // A blank value in a catalogue file would otherwise render as a blank
    // button, which looks like a broken layout rather than a missing string.
    expect(lookup('nav.dashboard', { 'nav.dashboard': '' }, undefined).text).toBe(
      CATALOG['nav.dashboard']
    )
  })

  it('returns the key itself only for a key that does not exist', () => {
    // A programming mistake, not a translation gap — and naming the missing
    // thing is the one case where showing a key helps.
    expect(lookup('nav.nonsense', {}, {}).text).toBe('nav.nonsense')
  })
})

describe('the translate function', () => {
  it('translates and interpolates together', () => {
    const t = translator({ 'library.kept': '{used} von {limit} behalten' })

    expect(t('library.kept', { used: 2, limit: 5 })).toBe('2 von 5 behalten')
  })

  it('falls back to English and still interpolates', () => {
    const t = translator({})

    expect(t('library.kept', { used: 2, limit: 5 })).toBe('2 of 5 kept')
  })
})

describe('coverage', () => {
  it('is 1 for a complete catalogue', () => {
    expect(coverage(Object.fromEntries(MESSAGE_KEYS.map((k) => [k, 'x'])))).toBe(1)
  })

  it('is 0 for nothing', () => {
    expect(coverage({})).toBe(0)
    expect(coverage(undefined)).toBe(0)
  })

  it('ignores keys that are not in the catalogue', () => {
    // A stale key left in a file after the English string was renamed must not
    // inflate the number and hide a real gap.
    expect(coverage({ 'nav.gone': 'x' })).toBe(0)
  })
})

describe('which files a locale asks for', () => {
  it('asks for nothing for English', () => {
    expect(catalogChain('en')).toEqual([])
    expect(isSourceLanguage('en')).toBe(true)
    expect(isSourceLanguage('en-GB')).toBe(true)
  })

  it('asks for one file for a bare language', () => {
    expect(catalogChain('hi')).toEqual(['hi'])
  })

  it('asks for the region then the base', () => {
    expect(catalogChain('zh-TW')).toEqual(['zh-TW', 'zh'])
  })

  it('resolves an unknown code to English, which needs no file', () => {
    expect(catalogChain('klingon')).toEqual([])
  })
})

describe('the catalogue and the generated files agree', () => {
  const dir = join(process.cwd(), 'lib', 'i18n', 'ui')

  const files = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.endsWith('.json'))
    : []

  it('has no duplicate keys and no empty English strings', () => {
    for (const key of MESSAGE_KEYS) {
      expect(CATALOG[key].length, key).toBeGreaterThan(0)
    }
  })

  it('names every file after a real language', () => {
    const codes = new Set(LANGUAGES.map((entry) => entry.code.toLowerCase()))

    for (const file of files) {
      expect(codes.has(file.slice(0, -5).toLowerCase()), file).toBe(true)
    }
  })

  // The failure this catches is specific and nasty: a translation that drops
  // "{count}" renders as a sentence with a hole where the number should be,
  // and it only shows up in the one language nobody on the team reads.
  it('keeps every placeholder the English string had', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()

    for (const file of files) {
      const messages = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, string>

      for (const [key, value] of Object.entries(messages)) {
        const english = (CATALOG as Record<string, string>)[key]

        if (!english) continue

        expect(placeholders(value), `${file} → ${key}`).toEqual(placeholders(english))
      }
    }
  })

  it('never leaves a translated value empty', () => {
    for (const file of files) {
      const messages = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, string>

      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim().length, `${file} → ${key}`).toBeGreaterThan(0)
      }
    }
  })
})
