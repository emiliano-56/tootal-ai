import { describe, it, expect } from 'vitest'
import {
  LANGUAGES,
  language,
  allowedLanguages,
  canUseLanguage,
  promptDirective,
  resolveAllowed,
  voiceTag,
  isRtl,
  preferredLanguage,
  DEFAULT_LANGUAGE,
} from '@/lib/i18n/languages'
import { LICENCES, licence, creditLine, checkTrack, rankTracks, type Track } from '@/lib/audio/licences'

const track = (extra: Partial<Track> = {}): Track => ({
  provider: 'openverse',
  externalId: '1',
  title: 'Quiet Meadow',
  artist: 'A. Composer',
  url: 'https://audio.test/a.mp3',
  licence: 'by',
  sourceUrl: 'https://openverse.test/a',
  ...extra,
})

// ---------------------------------------------------------------------------
//  Languages
// ---------------------------------------------------------------------------

describe('the language catalogue', () => {
  it('has no duplicate codes', () => {
    const codes = LANGUAGES.map((entry) => entry.code)

    expect(new Set(codes).size).toBe(codes.length)
  })

  it('gives every language a native name, which is how people find theirs', () => {
    for (const entry of LANGUAGES) {
      expect(entry.nativeName, entry.code).toBeTruthy()
    }
  })

  it('marks the right-to-left scripts', () => {
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('he')).toBe(true)
    expect(isRtl('ur')).toBe(true)
    expect(isRtl('en')).toBe(false)
  })

  it('accepts a browser locale, not just a bare code', () => {
    // navigator.language gives 'en-GB', 'hi-IN', 'pt-BR'.
    expect(language('en-GB')?.code).toBe('en')
    expect(language('pt-BR')?.code).toBe('pt')
    expect(language('HI')?.code).toBe('hi')
  })

  it('returns nothing for a language it does not have', () => {
    expect(language('klingon')).toBeUndefined()
    expect(language(null)).toBeUndefined()
  })

  it('keeps Traditional and Simplified Chinese apart', () => {
    // The catalogue holds 'zh-TW' with a capitalised region. Comparing that
    // against a lowercased input never matched, so Traditional fell through to
    // the base lookup and silently resolved to Simplified — a different script
    // and the wrong answer, in the one pair where it matters most.
    expect(language('zh-TW')?.code).toBe('zh-TW')
    expect(language('zh-tw')?.code).toBe('zh-TW')
    expect(language('zh_TW')?.code).toBe('zh-TW')
    expect(language('zh')?.code).toBe('zh')
    // A region nobody catalogued still resolves to the base language.
    expect(language('zh-HK')?.code).toBe('zh')
  })
})

describe('what the picker offers when the server has not answered', () => {
  // The bug this replaces: the hook defaulted to ['en'], so a request that was
  // in flight — or that failed — showed one language and captioned it
  // "83 more are on the higher tiers". That is a claim about someone's plan,
  // made on no evidence, and indistinguishable from a real restriction.

  it('offers everything and claims nothing before an answer arrives', () => {
    const { allowed, answered } = resolveAllowed(null)

    expect(allowed).toHaveLength(LANGUAGES.length)
    expect(answered).toBe(false)
  })

  it('does the same when the request failed', () => {
    expect(resolveAllowed(undefined).answered).toBe(false)
    expect(resolveAllowed('').answered).toBe(false)
    expect(resolveAllowed({ error: 'Not signed in' }).answered).toBe(false)
  })

  it('treats an empty list as a failure, not as "no languages"', () => {
    // No tier the business sells permits zero languages, so an empty array is
    // far more likely to be a broken query than a real restriction — and
    // rendering it would leave the customer with an empty dropdown.
    const { allowed, answered } = resolveAllowed({ allowed: [] })

    expect(allowed).toHaveLength(LANGUAGES.length)
    expect(answered).toBe(false)
  })

  it('ignores junk inside the list', () => {
    expect(resolveAllowed({ allowed: [null, 42, ''] }).answered).toBe(false)
    expect(resolveAllowed({ allowed: ['en', null, 'hi'] }).allowed).toEqual(['en', 'hi'])
  })

  it('uses a real answer exactly, and only then admits a restriction', () => {
    const { allowed, answered } = resolveAllowed({ allowed: ['en', 'es', 'fr', 'pt', 'hi'] })

    expect(allowed).toEqual(['en', 'es', 'fr', 'pt', 'hi'])
    expect(answered).toBe(true)
  })

  it('passes the full catalogue through as a real answer', () => {
    // An unrestricted account gets every code back, and that is an answer —
    // not a fallback — so `answered` must be true or the count would read as
    // provisional forever.
    const every = LANGUAGES.map((entry) => entry.code)
    const { allowed, answered } = resolveAllowed({ allowed: every })

    expect(allowed).toHaveLength(LANGUAGES.length)
    expect(answered).toBe(true)
  })
})

describe('the catalogue itself', () => {
  it('has no duplicate codes', () => {
    // A duplicate silently shadows the later entry in every lookup.
    const codes = LANGUAGES.map((entry) => entry.code.toLowerCase())

    expect(new Set(codes).size).toBe(codes.length)
  })

  it('gives every language a name, a native name and a voice tag', () => {
    for (const entry of LANGUAGES) {
      expect(entry.name.length, entry.code).toBeGreaterThan(0)
      expect(entry.nativeName.length, entry.code).toBeGreaterThan(0)
      // Speech falls back to en-US without one, which reads the text in the
      // wrong language rather than merely the wrong accent.
      expect(entry.voice, entry.code).toMatch(/^[a-z]{2,3}-[A-Za-z]{2,4}$/)
    }
  })

  it('resolves every catalogued code back to itself', () => {
    for (const entry of LANGUAGES) {
      expect(language(entry.code)?.code, entry.code).toBe(entry.code)
    }
  })

  it('starts with English', () => {
    // Every fallback and seed prompt is written in it, and the picker should
    // open on it rather than on whatever sorted first.
    expect(LANGUAGES[0].code).toBe(DEFAULT_LANGUAGE)
  })

  it('marks exactly the right-to-left scripts', () => {
    const rtl = LANGUAGES.filter((entry) => entry.rtl).map((entry) => entry.code)

    expect(rtl.sort()).toEqual(['ar', 'fa', 'he', 'ur'])
  })
})

/** Catalogue order for a set of codes, so tests do not hardcode positions. */
const inCatalogueOrder = (codes: string[]) =>
  LANGUAGES.filter((entry) => codes.includes(entry.code)).map((entry) => entry.code)

describe('which languages a tier unlocks', () => {
  it('restricts to the list a plan names', () => {
    // Asserted against catalogue order rather than a literal, so reordering
    // or extending the catalogue does not break a test about *filtering*.
    expect(allowedLanguages([['en', 'es', 'hi']])).toEqual(inCatalogueOrder(['en', 'es', 'hi']))
  })

  it('returns catalogue order, not the order the plan listed them', () => {
    // Otherwise the picker reshuffles between accounts.
    expect(allowedLanguages([['hi', 'en']])).toEqual(inCatalogueOrder(['en', 'hi']))
    // English is first in the catalogue, so it must come out first here.
    expect(allowedLanguages([['hi', 'en']])[0]).toBe('en')
  })

  it('lets an unrestricted plan lift the cap', () => {
    // Buying an upgrade must never take a language away.
    expect(allowedLanguages([['en', 'es'], []]).length).toBe(LANGUAGES.length)
  })

  it('takes the union across several restricted plans', () => {
    expect(allowedLanguages([['en', 'es'], ['fr']])).toEqual(inCatalogueOrder(['en', 'es', 'fr']))
  })

  it('always includes English', () => {
    // Every fallback and every seed prompt is written in it.
    expect(allowedLanguages([['hi']])).toContain(DEFAULT_LANGUAGE)
  })

  it('treats an account with no plans as unrestricted', () => {
    expect(allowedLanguages([]).length).toBe(LANGUAGES.length)
  })

  it('answers whether one language is allowed', () => {
    expect(canUseLanguage('hi', ['en', 'hi'])).toBe(true)
    expect(canUseLanguage('ja', ['en', 'hi'])).toBe(false)
    // A locale still resolves.
    expect(canUseLanguage('hi-IN', ['en', 'hi'])).toBe(true)
  })
})

describe('what gets added to the prompt', () => {
  it('says nothing for English', () => {
    // The existing prompts already produce English; a redundant instruction
    // only makes a model second-guess itself.
    expect(promptDirective('en')).toBe('')
    expect(promptDirective(null)).toBe('')
  })

  it('names the language both ways for anything else', () => {
    const directive = promptDirective('hi')

    expect(directive).toContain('Hindi')
    expect(directive).toContain('हिन्दी')
  })

  it('tells the model to leave JSON keys alone', () => {
    // Translating the keys would break every parser downstream.
    expect(promptDirective('ja')).toContain('JSON keys in English')
  })

  it('says nothing for a language it does not know', () => {
    expect(promptDirective('klingon')).toBe('')
  })
})

describe('fields that must stay English', () => {
  // Several agents return a mix of prose the reader sees and prompts fed
  // straight to an image model. Translating the second kind is silent damage:
  // the story reads perfectly and the artwork quietly stops matching it.

  it('names the field and says why', () => {
    const directive = promptDirective('hi', { keepEnglish: ['image_prompt'] })

    expect(directive).toContain('"image_prompt"')
    expect(directive).toContain('image model')
    // The reader-facing instruction still has to be there.
    expect(directive).toContain('Hindi')
  })

  it('lists several fields readably', () => {
    const directive = promptDirective('ar', {
      keepEnglish: ['image_prompt', 'appearance'],
    })

    expect(directive).toContain('"image_prompt" and "appearance"')
    expect(directive).toContain('They are')
  })

  it('uses the singular for one field', () => {
    expect(promptDirective('ja', { keepEnglish: ['art_prompt'] })).toContain('It is')
  })

  it('changes nothing when the list is empty', () => {
    expect(promptDirective('hi', { keepEnglish: [] })).toBe(promptDirective('hi'))
    expect(promptDirective('hi', {})).toBe(promptDirective('hi'))
  })

  it('still says nothing at all for English', () => {
    // An exception to an instruction that was never given would be nonsense,
    // and would reintroduce the redundant-instruction problem.
    expect(promptDirective('en', { keepEnglish: ['image_prompt'] })).toBe('')
  })
})

describe('speech', () => {
  it('uses the BCP-47 tag, which is not the language code', () => {
    expect(voiceTag('hi')).toBe('hi-IN')
    expect(voiceTag('pt')).toBe('pt-BR')
  })

  it('falls back to English rather than an invalid tag', () => {
    expect(voiceTag('klingon')).toBe('en-US')
  })
})

describe('the default a customer sees', () => {
  it('uses their own locale when it is unlocked', () => {
    expect(preferredLanguage('hi-IN', ['en', 'hi'])).toBe('hi')
  })

  it('falls back to English rather than offering something they cannot use', () => {
    expect(preferredLanguage('ja-JP', ['en', 'hi'])).toBe('en')
    expect(preferredLanguage(undefined, ['en'])).toBe('en')
  })
})

// ---------------------------------------------------------------------------
//  Audio licences
// ---------------------------------------------------------------------------

describe('the licence catalogue', () => {
  it('knows which licences forbid selling', () => {
    expect(licence('by-nc')?.commercial).toBe(false)
    expect(licence('by')?.commercial).toBe(true)
    expect(licence('cc0')?.commercial).toBe(true)
  })

  it('knows which need a credit', () => {
    expect(licence('cc0')?.attribution).toBe(false)
    expect(licence('pixabay')?.attribution).toBe(false)
    expect(licence('by')?.attribution).toBe(true)
  })

  it('keeps CC0 usable, which stripping the cc prefix used to break', () => {
    // 'cc0'.replace(/^cc-?/, '') is '0' — unrecognised, so the checker refused
    // the freest licence in the list. Only showed up as "why can I never use
    // the free music".
    expect(licence('cc0')?.id).toBe('cc0')
    expect(licence('CC0')?.id).toBe('cc0')
    expect(licence('CC-0')?.id).toBe('cc0')
    expect(licence('public domain')?.id).toBe('cc0')
    expect(licence('pdm')?.id).toBe('cc0')
  })

  it('tolerates the "cc-" prefix providers put on', () => {
    expect(licence('CC-BY')?.id).toBe('by')
    expect(licence('cc by-sa')?.id).toBe('by-sa')
  })

  it('explains every licence in the customer’s words', () => {
    for (const entry of LICENCES) {
      expect(entry.summary, entry.id).toBeTruthy()
    }
  })
})

describe('the credit line', () => {
  it('names the track, the artist, the source and the licence', () => {
    // A credit that omits the licence is not a valid one.
    const line = creditLine(track())

    expect(line).toContain('"Quiet Meadow"')
    expect(line).toContain('A. Composer')
    expect(line).toContain('openverse.test')
    expect(line).toContain('CC BY')
  })

  it('is empty when nothing needs crediting', () => {
    expect(creditLine(track({ licence: 'cc0' }))).toBe('')
    expect(creditLine(track({ licence: 'pixabay' }))).toBe('')
  })
})

describe('whether a track can be used', () => {
  it('refuses a non-commercial track for a monetised video', () => {
    const verdict = checkTrack(track({ licence: 'by-nc' }), 'commercial')

    expect(verdict.usable).toBe(false)
    expect(verdict.reason).toContain('non-commercial')
  })

  it('allows the same track for personal use', () => {
    expect(checkTrack(track({ licence: 'by-nc' }), 'personal').usable).toBe(true)
  })

  it('refuses no-derivatives, because fitting music to a video is an edit', () => {
    const verdict = checkTrack(track({ licence: 'by-nd' }))

    expect(verdict.usable).toBe(false)
    expect(verdict.reason).toContain('forbids edits')
  })

  it('warns that share-alike carries over to the finished video', () => {
    const verdict = checkTrack(track({ licence: 'by-sa' }))

    expect(verdict.usable).toBe(true)
    expect(verdict.warning).toContain('same licence')
  })

  it('refuses a licence it cannot identify rather than guessing', () => {
    const verdict = checkTrack(track({ licence: 'some-custom-thing' }))

    expect(verdict.usable).toBe(false)
    expect(verdict.reason).toContain('not safe to publish')
  })

  it('passes a CC0 track with nothing to warn about', () => {
    expect(checkTrack(track({ licence: 'cc0' }))).toEqual({ usable: true })
  })
})

describe('ranking results', () => {
  it('puts the least encumbered first', () => {
    const ranked = rankTracks([
      track({ externalId: 'sa', licence: 'by-sa' }),
      track({ externalId: 'nc', licence: 'by-nc' }),
      track({ externalId: 'free', licence: 'cc0' }),
      track({ externalId: 'by', licence: 'by' }),
    ])

    expect(ranked.map((entry) => entry.externalId)).toEqual(['free', 'by', 'sa', 'nc'])
  })

  it('does not mutate what it was given', () => {
    const input = [track({ externalId: 'a', licence: 'by-nc' }), track({ externalId: 'b', licence: 'cc0' })]

    rankTracks(input)

    expect(input[0].externalId).toBe('a')
  })
})
