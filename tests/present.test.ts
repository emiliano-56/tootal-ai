import { describe, it, expect } from 'vitest'
import { presentRun, presentInput, presentedToText, type Block } from '@/lib/agents/present'
import { limitWithGrant, quotaFor } from '@/lib/library/quota'

/**
 * The history page used to print JSON.stringify(output) into a <pre>. A
 * customer opening their own story saw `{"pages":[{"panels":[{"image_prompt"…`
 * and had no way to tell whether the run was any good.
 */

const find = (blocks: Block[], type: Block['type']) => blocks.find((block) => block.type === type)

describe('a comic run', () => {
  const output = {
    title: 'The Night the Stars Went Quiet',
    logline: 'Moss walks the meadow to find out why.',
    story: 'Once, the stars hummed.',
    characters: [{ name: 'Moss', description: 'a kind hedgehog', appearance: 'brown quills' }],
    pages: [
      {
        page_number: 1,
        scene_title: 'The hollow',
        scene_summary: 'Moss notices the silence.',
        panels: [
          {
            panel_number: 1,
            image_prompt: 'a hedgehog under a leaf, 3d pixar style, volumetric lighting',
            dialogues: [{ speaker: 'Moss', text: 'Can you hear that?' }],
          },
        ],
      },
    ],
  }

  const presented = presentRun('story_to_comic', output)

  it('leads with the title and logline, not a brace', () => {
    expect(presented.title).toBe('The Night the Stars Went Quiet')
    expect(presented.subtitle).toBe('Moss walks the meadow to find out why.')
  })

  it('shows the dialogue a reader would read', () => {
    const pages = find(presented.blocks, 'pages')

    expect(pages).toBeDefined()
    if (pages?.type === 'pages') {
      expect(pages.pages[0].heading).toContain('Page 1')
      expect(pages.pages[0].lines).toContain('Moss: Can you hear that?')
    }
  })

  it('leaves the image prompt out of the reading view', () => {
    // Production detail. It belongs in the download, not in front of someone
    // trying to read their story.
    expect(JSON.stringify(presented.blocks)).not.toContain('volumetric lighting')
  })

  it('lists the cast by name', () => {
    const pairs = find(presented.blocks, 'pairs')

    if (pairs?.type === 'pairs') {
      expect(pairs.items[0]).toEqual({ name: 'Moss', value: 'a kind hedgehog' })
    }
  })

  it('never renders raw JSON for a shape it understands', () => {
    expect(find(presented.blocks, 'raw')).toBeUndefined()
  })
})

describe('the other agents', () => {
  it('reads a cover run as pictures', () => {
    const presented = presentRun('cover_designer', {
      title: 'Bedtime Tales',
      images: ['https://x.test/a.png', 'https://x.test/b.png'],
      taglines: ['Sleep tight'],
    })

    const gallery = find(presented.blocks, 'gallery')

    expect(gallery?.type === 'gallery' && gallery.images).toHaveLength(2)
  })

  it('reads a marketing kit as lists of copy', () => {
    const presented = presentRun('marketing_content', {
      headlines: ['Big news'],
      captions: ['Out now'],
      hashtags: ['#kidsbooks'],
    })

    expect(presented.blocks.filter((block) => block.type === 'list')).toHaveLength(3)
  })

  it('reads a landing page as a previewable page', () => {
    const presented = presentRun('landing_page', {
      headline: 'Stories that settle',
      html: '<h1>Hi</h1>',
      benefits: ['Calm', 'Short'],
    })

    expect(presented.title).toBe('Stories that settle')
    expect(find(presented.blocks, 'html')).toBeDefined()
  })

  it('reads a video run as scenes', () => {
    const presented = presentRun('comic_to_video', {
      title: 'Episode 1',
      shots: [{ narration: 'Once upon a time', duration: '5s' }],
    })

    const pages = find(presented.blocks, 'pages')

    if (pages?.type === 'pages') {
      expect(pages.pages[0].heading).toContain('5s')
      expect(pages.pages[0].lines).toContain('Once upon a time')
    }
  })
})

describe('shapes it does not recognise', () => {
  it('still shows something for an agent added later', () => {
    // A new agent must not make history render an empty card.
    const presented = presentRun('brand_new_agent', { anything: 'at all' })

    expect(find(presented.blocks, 'raw')).toBeDefined()
  })

  it('falls back when a known agent returns an unexpected shape', () => {
    const presented = presentRun('story_to_comic', { unexpected: true })

    expect(find(presented.blocks, 'raw')).toBeDefined()
  })

  it('does not throw on a null or primitive output', () => {
    expect(presentRun('story_to_comic', null).blocks).toEqual([])
    expect(presentRun('story_to_comic', 'a string').blocks).toEqual([])
  })

  it('drops empty sections rather than printing bare headings', () => {
    const presented = presentRun('cover_designer', {
      title: 'Cover',
      images: ['https://x.test/a.png'],
      taglines: [],
    })

    expect(find(presented.blocks, 'list')).toBeUndefined()
  })
})

describe('what the customer typed', () => {
  it('reads back in words', () => {
    const pairs = presentInput({ idea: 'A hedgehog', pages: 3, panelsPerPage: 4 })

    expect(pairs).toContainEqual({ name: 'Idea', value: 'A hedgehog' })
    expect(pairs).toContainEqual({ name: 'Panels per page', value: '4' })
  })

  it('skips nested objects that would print as [object Object]', () => {
    const pairs = presentInput({ idea: 'x', nested: { a: 1 } })

    expect(pairs).toHaveLength(1)
  })

  it('skips blanks', () => {
    expect(presentInput({ idea: '', style: 'Pixar' })).toHaveLength(1)
  })

  it('copes with no input at all', () => {
    expect(presentInput(null)).toEqual([])
  })
})

describe('the download', () => {
  it('is readable text, not JSON', () => {
    const text = presentedToText(
      presentRun('story_to_comic', {
        title: 'A Story',
        logline: 'Short.',
        pages: [{ page_number: 1, scene_summary: 'It begins.', panels: [] }],
      })
    )

    expect(text.startsWith('A Story')).toBe(true)
    expect(text).toContain('Page 1')
    expect(text).not.toContain('{"')
  })
})

describe('a personal grant on top of the plan', () => {
  it('adds to the plan rather than replacing it', () => {
    // A superadmin should be able to say "this customer keeps thirty" without
    // moving them to a plan they do not otherwise want.
    expect(limitWithGrant(10, 20)).toBe(30)
  })

  it('changes nothing when there is no grant', () => {
    expect(limitWithGrant(10)).toBe(10)
    expect(limitWithGrant(10, 0)).toBe(10)
  })

  it('is a no-op on an unlimited plan rather than an error', () => {
    expect(limitWithGrant(null, 50)).toBeNull()
  })

  it('ignores a negative grant', () => {
    expect(limitWithGrant(10, -5)).toBe(10)
  })

  it('actually lifts the ceiling', () => {
    const before = quotaFor(limitWithGrant(10), 10)
    const after = quotaFor(limitWithGrant(10, 5), 10)

    expect(before.full).toBe(true)
    expect(after.full).toBe(false)
    expect(after.remaining).toBe(5)
  })
})
