/**
 * Music a customer can legally publish.
 *
 * "Copyright free" is not a licence — it is a phrase people use for several
 * quite different ones, and the differences matter to whoever gets the strike:
 *
 *   - CC0 and the Pixabay licence ask for nothing.
 *   - CC BY needs a credit. Publishing without it is an infringement, not a
 *     discourtesy.
 *   - CC BY-SA needs a credit *and* makes the finished video share-alike,
 *     which most customers selling a product do not want.
 *   - CC BY-NC forbids commercial use outright, which for this audience —
 *     people publishing to monetised channels — usually means unusable.
 *
 * So every track carries its licence, the credit line is generated rather than
 * left to the customer, and the ones that would cause trouble are flagged
 * before they are chosen rather than after.
 */

export interface Licence {
  id: string
  label: string
  /** Must the artist be credited? */
  attribution: boolean
  /** May the result be sold or monetised? */
  commercial: boolean
  /** Does it force the finished work to carry the same licence? */
  shareAlike: boolean
  url?: string
  /** Said plainly, for the customer rather than for a lawyer. */
  summary: string
}

export const LICENCES: Licence[] = [
  {
    id: 'cc0',
    label: 'CC0 / Public Domain',
    attribution: false,
    commercial: true,
    shareAlike: false,
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    summary: 'Do anything with it. No credit needed.',
  },
  {
    id: 'pixabay',
    label: 'Pixabay licence',
    attribution: false,
    commercial: true,
    shareAlike: false,
    url: 'https://pixabay.com/service/license-summary/',
    summary: 'Free for commercial use. No credit needed.',
  },
  {
    id: 'by',
    label: 'CC BY',
    attribution: true,
    commercial: true,
    shareAlike: false,
    url: 'https://creativecommons.org/licenses/by/4.0/',
    summary: 'Free to sell — but you must credit the artist.',
  },
  {
    id: 'by-sa',
    label: 'CC BY-SA',
    attribution: true,
    commercial: true,
    shareAlike: true,
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    summary: 'Credit the artist, and your video must carry the same licence.',
  },
  {
    id: 'by-nc',
    label: 'CC BY-NC',
    attribution: true,
    commercial: false,
    shareAlike: false,
    url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    summary: 'Credit needed, and you may not sell or monetise the result.',
  },
  {
    id: 'by-nc-sa',
    label: 'CC BY-NC-SA',
    attribution: true,
    commercial: false,
    shareAlike: true,
    url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    summary: 'No selling, credit needed, and the same licence carries over.',
  },
  {
    id: 'by-nd',
    label: 'CC BY-ND',
    attribution: true,
    commercial: true,
    shareAlike: false,
    url: 'https://creativecommons.org/licenses/by-nd/4.0/',
    summary: 'No edits allowed — which rules out cutting it to length.',
  },
]

/**
 * Providers spell the same licence several ways.
 *
 * Openverse says `cc0` and `pdm`, others say `CC-BY-SA` or `public domain`.
 * The stripping of a `cc` prefix has to leave CC0 alone — taking it off turns
 * the freest licence in the list into the unrecognised string `0`, which the
 * checker then refuses. That is exactly backwards, and it is the sort of bug
 * that only shows up as "why can I never use the free music".
 */
export function normaliseLicence(id: string | null | undefined): string {
  if (!id) return ''

  const value = String(id).toLowerCase().trim().replace(/\s+/g, '-')

  // Public domain, however it was spelled.
  if (/^(cc-?0|pdm|public-?domain)/.test(value)) return 'cc0'
  if (value === 'pixabay' || value.startsWith('pixabay')) return 'pixabay'

  // `cc-by-sa` and `ccby` both mean `by-sa` / `by`; `cc0` is already handled.
  return value.replace(/^cc-?(?=[a-z])/, '')
}

export function licence(id: string | null | undefined): Licence | undefined {
  const normalised = normaliseLicence(id)

  if (!normalised) return undefined

  return LICENCES.find((entry) => entry.id === normalised)
}

export interface Track {
  provider: string
  externalId: string
  title: string
  artist: string
  url: string
  duration?: number
  licence: string
  licenceUrl?: string
  /** Where the track came from, for the credit line. */
  sourceUrl?: string
}

/**
 * The line to paste into a video description.
 *
 * Generated rather than left to the customer, because the required form is
 * specific — title, artist, source, licence — and a credit that omits the
 * licence is not a valid one.
 */
export function creditLine(track: Track): string {
  const info = licence(track.licence)

  if (info && !info.attribution) return ''

  const parts = [`"${track.title}"`]

  if (track.artist) parts.push(`by ${track.artist}`)
  if (track.sourceUrl) parts.push(`(${track.sourceUrl})`)

  const label = info?.label ?? track.licence

  if (label) parts.push(`licensed under ${label}`)
  if (info?.url) parts.push(info.url)

  return parts.join(' ')
}

export type UseCase = 'personal' | 'commercial'

export interface Verdict {
  usable: boolean
  /** Fine, but there is something the customer must do. */
  warning?: string
  reason?: string
}

/**
 * Whether this track suits what the customer intends to do with it.
 *
 * Checked before they pick it. Someone publishing to a monetised channel
 * needs to know that a non-commercial track is a problem now, not after the
 * video is rendered and uploaded.
 */
export function checkTrack(track: Track, useCase: UseCase = 'commercial'): Verdict {
  const info = licence(track.licence)

  if (!info) {
    return {
      usable: false,
      reason: `The licence on this track ("${track.licence || 'unknown'}") could not be identified, so it is not safe to publish.`,
    }
  }

  // No-derivatives cannot be cut to length, and every use here does that.
  if (info.id === 'by-nd') {
    return {
      usable: false,
      reason: 'This licence forbids edits, and fitting music to a video means editing it.',
    }
  }

  if (useCase === 'commercial' && !info.commercial) {
    return {
      usable: false,
      reason: 'This track is for non-commercial use only — it cannot go on a monetised video.',
    }
  }

  if (info.shareAlike) {
    return {
      usable: true,
      warning: 'Share-alike: your finished video would have to carry this same licence.',
    }
  }

  if (info.attribution) {
    return { usable: true, warning: 'You must credit the artist — the line is copied for you.' }
  }

  return { usable: true }
}

/** Order results so the least encumbered come first. */
export function rankTracks(tracks: Track[], useCase: UseCase = 'commercial'): Track[] {
  const score = (track: Track) => {
    const info = licence(track.licence)

    if (!info) return 99

    const verdict = checkTrack(track, useCase)

    if (!verdict.usable) return 50
    if (info.shareAlike) return 3
    if (info.attribution) return 2

    return 1
  }

  return [...tracks].sort((a, b) => score(a) - score(b))
}
