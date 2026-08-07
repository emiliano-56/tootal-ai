import { describe, it, expect } from 'vitest'
import {
  NETWORKS,
  POSTABLE,
  network,
  shareUrl,
  captionFor,
  fallbackUrl,
  fitCaption,
  type ShareTarget,
} from '@/lib/social/networks'

const target: ShareTarget = {
  url: 'https://comictale.ai/s/abc123',
  title: 'The Night the Stars Went Quiet',
  text: 'A bedtime story about listening',
  hashtags: ['kidsbooks', 'bedtimestories'],
}

describe('the network catalogue', () => {
  it('covers every network the customer asked for', () => {
    expect(NETWORKS.map((entry) => entry.id).sort()).toEqual([
      'facebook', 'instagram', 'linkedin', 'quora', 'reddit', 'telegram', 'twitter', 'whatsapp',
    ])
  })

  it('says why a network cannot do something', () => {
    // Every limitation has to be explainable to a customer, or they will
    // assume it is broken.
    for (const entry of NETWORKS) {
      if (!entry.canShare || !entry.canAutoPost) {
        expect(entry.note, `${entry.id} needs a note`).toBeTruthy()
      }
    }
  })

  it('marks Telegram as the one that works without a developer app', () => {
    expect(network('telegram')?.connect).toBe('token')
    expect(network('telegram')?.needsReview).toBeUndefined()
  })

  it('marks the platforms that make you pass review', () => {
    expect(network('facebook')?.needsReview).toBe(true)
    expect(network('instagram')?.needsReview).toBe(true)
    expect(network('linkedin')?.needsReview).toBe(true)
  })

  it('gives every auto-posting network a way to connect', () => {
    for (const entry of POSTABLE) {
      expect(entry.connect, `${entry.id} can post but has no connect method`).toBeTruthy()
    }
  })

  it('returns nothing for a network that is not in the list', () => {
    expect(network('myspace')).toBeUndefined()
  })
})

describe('share links', () => {
  it('builds a Facebook sharer link', () => {
    expect(shareUrl('facebook', target)).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcomictale.ai%2Fs%2Fabc123'
    )
  })

  it('puts the caption and hashtags on X', () => {
    const url = shareUrl('twitter', target)!

    expect(url).toContain('twitter.com/intent/tweet')
    expect(decodeURIComponent(url)).toContain('A bedtime story about listening')
    expect(decodeURIComponent(url)).toContain('#kidsbooks')
  })

  it('puts the link inside the message for WhatsApp, which takes only one field', () => {
    const url = shareUrl('whatsapp', target)!
    const decoded = decodeURIComponent(url.replace('https://wa.me/?text=', ''))

    expect(decoded).toContain('A bedtime story')
    expect(decoded).toContain('https://comictale.ai/s/abc123')
  })

  it('sends the title to Reddit, which asks for one', () => {
    expect(decodeURIComponent(shareUrl('reddit', target)!)).toContain(
      'title=The Night the Stars Went Quiet'
    )
  })

  it('returns nothing for Instagram and Quora, which have no share link', () => {
    // Not an oversight — neither platform publishes a share intent.
    expect(shareUrl('instagram', target)).toBeNull()
    expect(shareUrl('quora', target)).toBeNull()
  })

  it('escapes a title containing characters that would break the query', () => {
    const url = shareUrl('reddit', { ...target, title: 'Pip & Moss: "Can\'t Sleep?"' })!

    expect(url).not.toMatch(/[&?]title=[^&]*&(?!amp)/)
    expect(decodeURIComponent(url)).toContain('Pip & Moss')
  })

  it('falls back to the title when there is no caption', () => {
    const url = shareUrl('telegram', { url: 'https://x.com', title: 'Just a title' })!

    expect(decodeURIComponent(url)).toContain('Just a title')
  })

  it('normalises a hashtag that already has its hash', () => {
    const url = shareUrl('twitter', { ...target, hashtags: ['#already', 'plain'] })!

    expect(decodeURIComponent(url)).toContain('#already')
    expect(decodeURIComponent(url)).not.toContain('##already')
  })
})

describe('the caption on the clipboard', () => {
  it('joins the text, the tags and the link', () => {
    const caption = captionFor(target)

    expect(caption).toContain('A bedtime story about listening')
    expect(caption).toContain('#kidsbooks #bedtimestories')
    expect(caption).toContain('https://comictale.ai/s/abc123')
  })

  it('uses the title when there is no separate caption', () => {
    expect(captionFor({ url: 'https://x.com', title: 'Only a title' })).toContain('Only a title')
  })
})

describe('where to send someone we cannot hand a link to', () => {
  it('opens Quora and Instagram so the caption can be pasted', () => {
    expect(fallbackUrl('quora')).toBe('https://www.quora.com/')
    expect(fallbackUrl('instagram')).toBe('https://www.instagram.com/')
  })

  it('has no fallback for a network that takes the link properly', () => {
    expect(fallbackUrl('facebook')).toBeNull()
  })
})

describe('fitting a caption to the network', () => {
  it('leaves a short caption alone', () => {
    expect(fitCaption('twitter', 'Short and sweet')).toBe('Short and sweet')
  })

  it('trims for X, allowing for the link X counts as 23 characters', () => {
    const long = 'a'.repeat(400)
    const fitted = fitCaption('twitter', long)

    expect(fitted.length).toBeLessThanOrEqual(256)
    expect(fitted.endsWith('…')).toBe(true)
  })

  it('gives X the full allowance when there is no link', () => {
    const fitted = fitCaption('twitter', 'b'.repeat(400), false)

    expect(fitted.length).toBeLessThanOrEqual(280)
    expect(fitted.length).toBeGreaterThan(256)
  })

  it('respects the much larger limits elsewhere', () => {
    const caption = 'c'.repeat(2000)

    expect(fitCaption('facebook', caption)).toBe(caption)
    expect(fitCaption('telegram', caption).length).toBeLessThanOrEqual(1024)
  })

  it('leaves a network with no documented limit alone', () => {
    const caption = 'd'.repeat(5000)

    expect(fitCaption('whatsapp', caption)).toBe(caption)
  })
})

// ---------------------------------------------------------------------------
//  Regressions
// ---------------------------------------------------------------------------
//  Each of these was a real bug found in review. They are cheap to re-break
//  and expensive to notice, so they are pinned here.

import fs from 'node:fs'

describe('credentials never reach the browser', () => {
  const source = fs.readFileSync('app/api/social/route.ts', 'utf8')

  it('filters a connection\u2019s settings through an allow-list', () => {
    // `settings` holds the Telegram bot token, which is the whole credential.
    // Returning the object wholesale leaked it to anyone signed in.
    expect(source).toContain('PUBLIC_SETTINGS')
    expect(source).toContain('safeSettings')

    const allowList = source.match(/const PUBLIC_SETTINGS = \[([^\]]+)\]/)?.[1] ?? ''

    expect(allowList).not.toContain('botToken')
    expect(allowList).not.toContain('accessToken')
  })

  it('applies the filter on the way out, not just defining it', () => {
    expect(source).toMatch(/settings:\s*safeSettings\(/)
  })

  it('keeps the console from echoing the app credentials back', () => {
    const console = fs.readFileSync('app/api/console/social/route.ts', 'utf8')

    expect(console).toContain('hasSecret')
    // The secret itself, and the free-form bag that may hold more of them.
    expect(console).not.toMatch(/clientSecret:\s*app\.client_secret/)
    expect(console).not.toMatch(/extra:\s*app\.extra/)
  })
})

describe('upsert keys', () => {
  it('keeps account_id NOT NULL, so reconnecting updates instead of duplicating', () => {
    // Postgres treats two NULLs as distinct inside a unique key, so a nullable
    // account_id defeated the upsert and grew a new row on every reconnect.
    const migration = fs.readFileSync('supabase/migrations/015_sharing_and_social.sql', 'utf8')

    expect(migration).toMatch(/account_id\s+text not null default ''/)
    expect(migration).toContain('unique (user_id, platform, account_id)')
  })

  it('never writes a null account id', () => {
    const callback = fs.readFileSync('app/api/social/callback/[platform]/route.ts', 'utf8')

    expect(callback).toMatch(/account_id: result\.accountId \?\? ''/)
  })
})

describe('link previews', () => {
  it('only offers an image a network can render', () => {
    // A comic is a PDF. Handed to Facebook as og:image it produced a card with
    // a broken picture, which is worse than the plain text card.
    const page = fs.readFileSync('app/s/[token]/page.tsx', 'utf8')

    expect(page).toContain('looksLikeImage')
    expect(page).toMatch(/png\|jpe\?g\|webp\|gif/)
  })
})

describe('Autopilot volume', () => {
  it('promises one episode per run, which is what the engine makes', () => {
    // The API used to accept up to five per run while runCampaign wrote one,
    // so the "~N a month" figure on the card was untrue.
    const route = fs.readFileSync('app/api/autopilot/route.ts', 'utf8')

    expect(route).toContain('episodes_per_run: 1')
    expect(route).not.toContain('Number(body.episodesPerRun)')
  })
})

describe('preview images', () => {
  const images = fs.readFileSync('lib/ai/images.ts', 'utf8')

  it('converts to JPEG, which is the only format Instagram accepts', () => {
    // Measured against the live backend: it returns a 2048px PNG. Instagram
    // refuses a PNG outright, so without this every Instagram post failed.
    expect(images).toContain('toJpeg')
    expect(images).toContain("contentType: 'image/jpeg'")
    expect(images).toMatch(/storePreview[\s\S]{0,200}await toJpeg/)
  })

  it('degrades rather than failing when sharp is missing', () => {
    // A deployment without sharp should still post something Facebook and
    // Telegram accept.
    expect(images).toMatch(/catch[\s\S]{0,200}return image/)
  })

  it('downloads the image instead of storing the backend URL', () => {
    // The backend hands back an /ephemeral/ URL that stops resolving. Storing
    // it would leave every older post with a dead picture.
    expect(images).toContain('await file.arrayBuffer()')
    expect(images).toContain('PREVIEW_BUCKET')
  })

  it('bounds the wait on a generation that never returns', () => {
    expect(images).toContain('AbortSignal.timeout(IMAGE_TIMEOUT_MS)')

    const timeout = Number(images.match(/IMAGE_TIMEOUT_MS = ([\d_]+)/)?.[1].replace(/_/g, ''))

    // Measured at 48-64s, so anything under about 90s would cut off a normal
    // render on a slow day.
    expect(timeout).toBeGreaterThanOrEqual(90_000)
  })
})

describe('run budget', () => {
  it('allows a run long enough to draw an image', () => {
    // A run writes the episode and draws the cover; the drawing alone measures
    // 48-64 seconds. The default function timeout would cut it off partway.
    for (const file of ['app/api/autopilot/route.ts', 'app/api/cron/autopilot/route.ts']) {
      expect(fs.readFileSync(file, 'utf8'), file).toMatch(/export const maxDuration = 300/)
    }
  })

  it('caps panels per run so a campaign cannot overrun the budget', () => {
    // Four images at ~64s each would exceed the 300s ceiling.
    const migration = fs.readFileSync('supabase/migrations/016_previews.sql', 'utf8')

    expect(migration).toContain('render_panels between 0 and 2')
  })
})

describe('preview ownership', () => {
  it('refuses a preview image that is not the caller\u2019s own storage', () => {
    // og:image is served from our domain, so an arbitrary URL would let
    // someone build a card showing anything under our name.
    const route = fs.readFileSync('app/api/share/route.ts', 'utf8')

    expect(route).toContain('ownedStorageUrl')
    expect(route).toMatch(/previewUrl && !ownedStorageUrl\(previewUrl\)/)
  })
})

describe('the share dialog', () => {
  const bar = fs.readFileSync('components/share-bar.tsx', 'utf8')

  it('renders through a portal, escaping any transformed ancestor', () => {
    // My Library's cards animate with translate-y. A transformed ancestor
    // becomes the containing block for position:fixed, so the dialog was
    // trapped inside the card and clipped by its overflow-hidden — taking its
    // own close button with it.
    expect(bar).toContain('createPortal')
    expect(bar).toMatch(/createPortal\([\s\S]*document\.body\s*\)/)
  })

  it('can be closed three ways, so it is never a trap', () => {
    // Backdrop click.
    expect(bar).toMatch(/onClick=\{onClose\}/)
    // Escape.
    expect(bar).toMatch(/event\.key === 'Escape'/)
    // A button that stays reachable however far the panel is scrolled.
    expect(bar).toContain('aria-label="Close"')
    expect(bar).toContain('sticky top-0')
  })

  it('does not close when the panel itself is clicked', () => {
    // Without this the backdrop handler fires for every click inside.
    expect(bar).toMatch(/event\.stopPropagation\(\)/)
  })

  it('restores page scrolling when it closes', () => {
    expect(bar).toContain("document.body.style.overflow = 'hidden'")
    expect(bar).toMatch(/document\.body\.style\.overflow = previous/)
  })

  it('announces itself to assistive technology', () => {
    expect(bar).toContain('role="dialog"')
    expect(bar).toContain('aria-modal="true"')
  })

  it('draws real brand marks rather than a letter in a circle', () => {
    expect(bar).toContain('BrandMark')

    // One glyph per network the bar offers.
    for (const id of ['facebook', 'twitter', 'linkedin', 'telegram', 'whatsapp', 'reddit', 'instagram', 'quora']) {
      expect(bar, `${id} has no brand mark`).toMatch(new RegExp(`case '${id}':`))
    }
  })
})
