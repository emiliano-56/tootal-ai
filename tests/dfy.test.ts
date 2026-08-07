import { describe, it, expect } from 'vitest'
import {
  ASSET_KINDS,
  kindInfo,
  groupByKind,
  toolLinkFor,
  downloadName,
  summarise,
  marketplaceLabel,
  type DfyAsset,
  type DfyNiche,
} from '@/lib/dfy/assets'

const asset = (extra: Partial<DfyAsset> = {}): DfyAsset => ({
  id: 'a1',
  kind: 'storybook',
  title: 'The Night the Stars Went Quiet',
  summary: '',
  body: 'body',
  prompt: null,
  tool: null,
  meta: {},
  marketplaces: [],
  sortOrder: 10,
  ...extra,
})

const niche: DfyNiche = {
  id: 'n1',
  slug: 'bedtime-animal-tales',
  name: 'Bedtime Animal Tales',
  tagline: '',
  description: '',
  audience: '',
  emoji: '🌙',
  colourFrom: '#000',
  colourTo: '#fff',
  keywords: [],
}

describe('the asset catalogue', () => {
  it('covers every kind the database allows', () => {
    // The check constraint in migration 013 lists exactly these.
    expect(ASSET_KINDS.map((entry) => entry.kind).sort()).toEqual([
      'blog', 'listing', 'printable', 'rhyme', 'storybook', 'tutor', 'video', 'website',
    ])
  })

  it('gives a website an html extension and everything else a readable one', () => {
    expect(kindInfo('website').extension).toBe('html')
    expect(kindInfo('website').mime).toBe('text/html')
    expect(kindInfo('blog').extension).toBe('md')
  })

  it('falls back rather than throwing on a kind it does not know', () => {
    const unknown = kindInfo('podcast')

    expect(unknown.label).toBe('podcast')
    expect(unknown.extension).toBe('txt')
  })
})

describe('grouping a pack', () => {
  it('orders groups by the catalogue, not by the data', () => {
    // Rows arrive in whatever order the query returned; the tabs must not move.
    const groups = groupByKind([
      asset({ id: '1', kind: 'blog' }),
      asset({ id: '2', kind: 'website' }),
      asset({ id: '3', kind: 'storybook' }),
    ])

    expect(groups.map((group) => group.info.kind)).toEqual(['website', 'storybook', 'blog'])
  })

  it('drops kinds the pack has none of', () => {
    const groups = groupByKind([asset({ kind: 'website' })])

    expect(groups).toHaveLength(1)
  })

  it('sorts within a group by sort order', () => {
    const groups = groupByKind([
      asset({ id: 'second', sortOrder: 20, title: 'Book two' }),
      asset({ id: 'first', sortOrder: 10, title: 'Book one' }),
    ])

    expect(groups[0].assets.map((entry) => entry.id)).toEqual(['first', 'second'])
  })

  it('handles an empty pack', () => {
    expect(groupByKind([])).toEqual([])
  })
})

describe('finishing an asset in a tool', () => {
  it('links to the tool named on the asset', () => {
    const link = toolLinkFor(asset({ tool: 'comic-agent', prompt: 'Write a comic' }))

    expect(link?.href).toBe('/comic-agent?prompt=Write%20a%20comic')
    expect(link?.label).toBe('Open in Story to Comic')
  })

  it('falls back to the tool the kind implies', () => {
    const link = toolLinkFor(asset({ kind: 'printable', tool: null, prompt: 'A colouring page' }))

    expect(link?.href.startsWith('/coloring?prompt=')).toBe(true)
  })

  it('offers nothing when there is no prompt to carry', () => {
    // A blog post is already finished; there is nothing to generate.
    expect(toolLinkFor(asset({ kind: 'blog', prompt: null }))).toBeNull()
    expect(toolLinkFor(asset({ kind: 'storybook', prompt: null }))).toBeNull()
  })

  it('offers nothing for a kind with no tool', () => {
    expect(toolLinkFor(asset({ kind: 'listing', prompt: 'anything' }))).toBeNull()
  })

  it('escapes a prompt containing characters that would break the query', () => {
    const link = toolLinkFor(asset({ tool: 'comic-agent', prompt: 'a & b ?c #d' }))

    expect(link?.href).toContain('a%20%26%20b%20%3Fc%20%23d')
  })

  it('tolerates a tool written with or without a leading slash', () => {
    expect(toolLinkFor(asset({ tool: '/comic-agent', prompt: 'x' }))?.href).toBe(
      '/comic-agent?prompt=x'
    )
  })
})

describe('download names', () => {
  it('joins the niche and the title', () => {
    expect(downloadName(niche, asset())).toBe(
      'bedtime-animal-tales-the-night-the-stars-went-quiet.md'
    )
  })

  it('strips punctuation that a filesystem would reject', () => {
    const name = downloadName(niche, asset({ title: 'Pip: "Can\'t Sleep?" / Part 1' }))

    expect(name).not.toMatch(/[:"'?/]/)
    expect(name.endsWith('.md')).toBe(true)
  })

  it('uses the right extension for a website', () => {
    expect(downloadName(niche, asset({ kind: 'website', title: 'Site' }))).toBe(
      'bedtime-animal-tales-site.html'
    )
  })

  it('keeps a very long title to a sane length', () => {
    const name = downloadName(niche, asset({ title: 'x'.repeat(200) }))

    expect(name.length).toBeLessThan(130)
  })
})

describe('summarising a pack', () => {
  it('counts assets and collects the marketplaces', () => {
    const summary = summarise([
      asset({ marketplaces: ['kdp', 'gumroad'] }),
      asset({ id: 'b', marketplaces: ['etsy'] }),
    ])

    expect(summary.assets).toBe(2)
    expect(summary.marketplaces).toEqual(['kdp', 'etsy', 'gumroad'])
  })

  it('lists marketplaces in catalogue order so badges do not jump', () => {
    const summary = summarise([asset({ marketplaces: ['youtube', 'kdp'] })])

    expect(summary.marketplaces).toEqual(['kdp', 'youtube'])
  })

  it('de-duplicates across assets', () => {
    const summary = summarise([
      asset({ marketplaces: ['etsy'] }),
      asset({ id: 'b', marketplaces: ['etsy'] }),
    ])

    expect(summary.marketplaces).toEqual(['etsy'])
  })

  it('copes with a pack that sells nowhere yet', () => {
    expect(summarise([asset()])).toEqual({ assets: 1, marketplaces: [] })
  })
})

describe('marketplace names', () => {
  it('spells out the ones we sell on', () => {
    expect(marketplaceLabel('kdp')).toBe('Amazon KDP')
  })

  it('falls back to the id for anything else', () => {
    expect(marketplaceLabel('shopify')).toBe('shopify')
  })
})
