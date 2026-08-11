import { describe, it, expect } from 'vitest'
import {
  checkDelivery,
  DELIVERY_PRESETS,
  preset,
  expiryFrom,
  makeToken,
  describeTerms,
  ipPrefix,
} from '@/lib/delivery/links'
import {
  isDue,
  composeCaption,
  captionProblems,
  roundToSlot,
  groupByDay,
  CAPTION_LIMITS,
  MAX_ATTEMPTS,
  STALE_POSTING_MS,
  MAX_LATENESS_MS,
} from '@/lib/social/calendar'

const now = new Date('2026-08-11T09:00:00.000Z')
const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()

describe('whether a delivery link still works', () => {
  it('works when it is inside both limits', () => {
    const state = checkDelivery({ expiresAt: iso(86_400_000), maxDownloads: 3, downloads: 1 }, now)

    expect(state.usable).toBe(true)
    expect(state.usable && state.remaining).toBe(2)
  })

  it('stops on the expiry date', () => {
    expect(checkDelivery({ expiresAt: iso(-1) }, now).usable).toBe(false)
    // Exactly at the moment counts as expired, not as the last second.
    expect(checkDelivery({ expiresAt: now.toISOString() }, now).usable).toBe(false)
  })

  it('stops once the downloads run out', () => {
    const state = checkDelivery({ maxDownloads: 3, downloads: 3 }, now)

    expect(state.usable).toBe(false)
    expect(state.usable === false && state.reason).toContain('maximum number of times')
  })

  it('stops when the seller turns it off', () => {
    expect(checkDelivery({ revoked: true, maxDownloads: 99 }, now).usable).toBe(false)
  })

  it('treats an unreadable date as dead, not as absent', () => {
    // The safe failure for a paid file is "no longer available", not "free".
    expect(checkDelivery({ expiresAt: 'not a date' }, now).usable).toBe(false)
  })

  it('allows no expiry and no cap when both are genuinely absent', () => {
    const state = checkDelivery({}, now)

    expect(state.usable).toBe(true)
    expect(state.usable && state.remaining).toBeNull()
  })

  it('is not confused by a negative download count', () => {
    expect(checkDelivery({ maxDownloads: 1, downloads: -5 }, now).usable).toBe(true)
  })

  it('tells the buyer what to do, not what failed', () => {
    const state = checkDelivery({ expiresAt: iso(-1000) }, now)

    expect(state.usable === false && state.reason).toContain('Ask the seller')
  })
})

describe('delivery presets', () => {
  it('every preset sets at least one limit', () => {
    // Neither limit by accident is just publishing the file.
    for (const entry of DELIVERY_PRESETS) {
      expect(entry.days !== null || entry.downloads !== null, entry.key).toBe(true)
      expect(entry.hint.length, entry.key).toBeGreaterThan(0)
    }
  })

  it('falls back to a real preset for an unknown key', () => {
    expect(preset('nonsense').key).toBe(DELIVERY_PRESETS[0].key)
  })

  it('turns a number of days into a date, and null into no expiry', () => {
    expect(expiryFrom(null)).toBeNull()
    expect(expiryFrom(7, now)?.toISOString()).toBe('2026-08-18T09:00:00.000Z')
  })

  it('refuses a nonsense number of days rather than making a date in the past', () => {
    expect(expiryFrom(-5, now)!.getTime()).toBeGreaterThan(now.getTime())
    expect(expiryFrom(99999, now)!.getTime()).toBeLessThan(
      now.getTime() + 3651 * 86_400_000
    )
  })
})

describe('tokens', () => {
  it('is long, and avoids characters that get mangled in an email', () => {
    const token = makeToken()

    expect(token).toHaveLength(22)
    // No l/o/0/1: they are misread when someone types a link off a screen.
    expect(token).toMatch(/^[abcdefghijkmnpqrstuvwxyz23456789]+$/)
  })

  it('does not repeat itself', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => makeToken()))

    expect(tokens.size).toBe(500)
  })
})

describe('describing the terms to the seller', () => {
  it('says both halves', () => {
    expect(describeTerms({ expiresAt: iso(86_400_000), maxDownloads: 3 })).toContain('3 downloads')
    expect(describeTerms({ maxDownloads: null })).toContain('unlimited downloads')
    expect(describeTerms({})).toContain('never expires')
  })

  it('says "1 download" rather than "1 downloads"', () => {
    expect(describeTerms({ maxDownloads: 1 })).toMatch(/\b1 download$/)
    expect(describeTerms({ maxDownloads: 2 })).toMatch(/\b2 downloads$/)
  })
})

describe('keeping an IP without keeping an address', () => {
  it('drops the last octet of an IPv4', () => {
    expect(ipPrefix('203.0.113.42')).toBe('203.0.113.0')
  })

  it('keeps only the routing prefix of an IPv6', () => {
    expect(ipPrefix('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3::')
  })

  it('returns nothing for nothing', () => {
    expect(ipPrefix('')).toBeNull()
    expect(ipPrefix(null)).toBeNull()
    expect(ipPrefix('not-an-ip')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
//  Scheduling
// ---------------------------------------------------------------------------

const post = (over: Partial<Parameters<typeof isDue>[0]> = {}) => ({
  status: 'scheduled' as const,
  scheduledFor: iso(-60_000),
  attempts: 0,
  ...over,
})

describe('when a scheduled post is due', () => {
  it('is due once its time has passed', () => {
    expect(isDue(post(), now).due).toBe(true)
  })

  it('is not due before its time', () => {
    expect(isDue(post({ scheduledFor: iso(60_000) }), now).due).toBe(false)
  })

  it('still goes out if the scheduler was briefly down', () => {
    // A customer who scheduled 9am does not want it silently skipped because
    // a cron tick was missed.
    expect(isDue(post({ scheduledFor: iso(-MAX_LATENESS_MS + 1000) }), now).due).toBe(true)
  })

  it('refuses to post something hours late at the wrong moment', () => {
    const check = isDue(post({ scheduledFor: iso(-MAX_LATENESS_MS - 1000) }), now)

    expect(check.due).toBe(false)
    expect(check.reason).toContain('six hours late')
  })

  it('leaves a post that is currently going out alone', () => {
    expect(isDue(post({ status: 'posting', startedAt: iso(-1000) }), now).due).toBe(false)
  })

  it('reclaims one whose worker died halfway', () => {
    // Left alone it would sit in `posting` forever and never be retried.
    expect(
      isDue(post({ status: 'posting', startedAt: iso(-STALE_POSTING_MS - 1000) }), now).due
    ).toBe(true)
  })

  it('never reposts something already posted, or something cancelled', () => {
    expect(isDue(post({ status: 'posted' }), now).due).toBe(false)
    expect(isDue(post({ status: 'cancelled' }), now).due).toBe(false)
  })

  it('gives up after the attempt limit', () => {
    const check = isDue(post({ attempts: MAX_ATTEMPTS }), now)

    expect(check.due).toBe(false)
    expect(check.reason).toContain('Gave up')
  })

  it('does not retry forever on an unreadable time', () => {
    expect(isDue(post({ scheduledFor: 'whenever' }), now).due).toBe(false)
  })
})

describe('composing a caption', () => {
  it('puts hashtags on their own line at the end', () => {
    // What every network's own composer does, and a tag folded into a
    // sentence stops being clickable on some clients.
    const text = composeCaption('A new comic!', ['comics', 'kidlit'])

    expect(text).toBe('A new comic!\n\n#comics #kidlit')
  })

  it('adds a single # and does not double one already there', () => {
    expect(composeCaption('x', ['#one', 'two'])).toContain('#one #two')
  })

  it('drops duplicate tags, which get a post flagged as spam', () => {
    expect(composeCaption('x', ['art', 'art', 'ART'])).toContain('#art #ART')
  })

  it('slots a link between the words and the tags', () => {
    const text = composeCaption('Read it', ['comics'], 'https://example.com/a')

    expect(text.indexOf('https://')).toBeGreaterThan(text.indexOf('Read it'))
    expect(text.indexOf('https://')).toBeLessThan(text.indexOf('#comics'))
  })

  it('produces nothing from nothing', () => {
    expect(composeCaption('', [])).toBe('')
  })
})

describe('caption limits', () => {
  it('names the network that would refuse it, and by how much', () => {
    // Found while the customer is looking at it, not at 9am on Friday in a
    // failure log.
    const problems = captionProblems('x'.repeat(300), ['twitter', 'facebook'])

    expect(problems).toHaveLength(1)
    expect(problems[0].platform).toBe('twitter')
    expect(problems[0].over).toBe(300 - CAPTION_LIMITS.twitter)
  })

  it('says nothing when it fits everywhere', () => {
    expect(captionProblems('short', Object.keys(CAPTION_LIMITS))).toEqual([])
  })

  it('counts characters, not bytes', () => {
    // An emoji is one character to a network's counter, not four.
    expect(captionProblems('😀'.repeat(200), ['twitter'])).toEqual([])
  })

  it('ignores a network it has no limit for', () => {
    expect(captionProblems('x'.repeat(9000), ['mastodon'])).toEqual([])
  })
})

describe('slots and grouping', () => {
  it('rounds up to the next slot, because the scheduler ticks', () => {
    expect(roundToSlot(new Date('2026-08-11T09:02:00Z')).toISOString()).toBe(
      '2026-08-11T09:05:00.000Z'
    )
  })

  it('leaves a time already on a slot alone', () => {
    expect(roundToSlot(new Date('2026-08-11T09:05:00Z')).toISOString()).toBe(
      '2026-08-11T09:05:00.000Z'
    )
  })

  it('groups by day, in order, with each day in order', () => {
    const grouped = groupByDay([
      { scheduledFor: '2026-08-12T15:00:00Z' },
      { scheduledFor: '2026-08-11T09:00:00Z' },
      { scheduledFor: '2026-08-12T08:00:00Z' },
    ])

    expect(grouped.map((entry) => entry.day)).toEqual(['2026-08-11', '2026-08-12'])
    expect(grouped[1].posts.map((p) => p.scheduledFor)).toEqual([
      '2026-08-12T08:00:00Z',
      '2026-08-12T15:00:00Z',
    ])
  })

  it('skips a row with an unreadable time rather than throwing', () => {
    expect(groupByDay([{ scheduledFor: 'nope' }])).toEqual([])
  })
})
