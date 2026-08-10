import { describe, it, expect } from 'vitest'
import {
  parsePlan,
  compactPlan,
  planProgress,
  decideNext,
  contentKind,
  featureFor,
  drawsArtwork,
  ideaSource,
  whenPlanEnds,
  CONTENT_KINDS,
} from '@/lib/autopilot/content'

describe('content kinds', () => {
  it('falls back to a comic for anything unrecognised', () => {
    // Every campaign made before this column existed is a comic campaign.
    expect(contentKind(undefined)).toBe('comic')
    expect(contentKind('podcast')).toBe('comic')
    expect(contentKind('coloring')).toBe('coloring')
  })

  it('charges each kind against its own allowance', () => {
    expect(featureFor('comic')).toBe('comic')
    expect(featureFor('coloring')).toBe('coloring')
    expect(featureFor('video')).toBe('video')
  })

  it('knows which kinds draw', () => {
    // A run that draws nothing is far cheaper and needs no image backend.
    expect(drawsArtwork('video')).toBe(false)
    expect(drawsArtwork('comic')).toBe(true)
  })

  it('describes every kind', () => {
    for (const entry of CONTENT_KINDS) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })
})

describe('reading a pasted plan', () => {
  it('reads "N. title | prompt"', () => {
    const { items, problems } = parsePlan('1. First day | Draw a snail\n2. Second day | Draw a frog')

    expect(problems).toEqual([])
    expect(items).toEqual([
      { day: 1, title: 'First day', prompt: 'Draw a snail' },
      { day: 2, title: 'Second day', prompt: 'Draw a frog' },
    ])
  })

  it('reads a "Day N:" prefix', () => {
    const { items } = parsePlan('Day 3: Bedtime | A story about the moon')

    expect(items[0]).toEqual({ day: 3, title: 'Bedtime', prompt: 'A story about the moon' })
  })

  it('accepts a tab, which is what a spreadsheet paste actually contains', () => {
    const { items } = parsePlan('1.\tFirst day\tDraw a snail')

    expect(items[0].title).toBe('First day')
    expect(items[0].prompt).toBe('Draw a snail')
  })

  it('numbers bare prompt lines by position', () => {
    const { items } = parsePlan('Draw a snail\nDraw a frog\nDraw a bee')

    expect(items.map((i) => i.day)).toEqual([1, 2, 3])
    expect(items[2].prompt).toBe('Draw a bee')
  })

  it('invents a title from the prompt when none was given', () => {
    // Refusing a list of bare prompts would reject the most natural way to
    // paste a plan.
    const { items } = parsePlan('A snail explores a magical garden at midnight')

    expect(items[0].title).toBe('A snail explores a magical garden at midnight')
    expect(items[0].prompt).toBe('A snail explores a magical garden at midnight')
  })

  it('shortens a long invented title but keeps the whole prompt', () => {
    const long = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ')
    const { items } = parsePlan(long)

    expect(items[0].title.split(/\s+/)).toHaveLength(8)
    expect(items[0].prompt).toBe(long)
  })

  it('fills unnumbered lines into the gaps around numbered ones', () => {
    const { items } = parsePlan('2. Second | b\nfirst prompt\n5. Fifth | e\nnext free')

    expect(items.map((i) => i.day)).toEqual([1, 2, 3, 5])
    expect(items.find((i) => i.day === 1)?.prompt).toBe('first prompt')
    expect(items.find((i) => i.day === 3)?.prompt).toBe('next free')
  })

  it('reports a duplicate day rather than overwriting one', () => {
    // Two ideas for day 4 means the customer miscounted, and finding that out
    // on day 4 is too late.
    const { items, problems } = parsePlan('4. One | a\n4. Two | b')

    expect(items).toHaveLength(1)
    expect(problems[0].reason).toContain('already taken')
    expect(problems[0].line).toBe(2)
  })

  it('skips blank lines and comments without complaining', () => {
    const { items, problems } = parsePlan('# my launch plan\n\nDraw a snail\n\n// note\nDraw a frog')

    expect(items).toHaveLength(2)
    expect(problems).toEqual([])
  })

  it('reports a line with no prompt', () => {
    const { items, problems } = parsePlan('1. Just a title |   ')

    expect(items).toHaveLength(0)
    expect(problems[0].reason).toContain('No prompt')
  })

  it('returns days in order however they were pasted', () => {
    const { items } = parsePlan('3. c | c\n1. a | a\n2. b | b')

    expect(items.map((i) => i.day)).toEqual([1, 2, 3])
  })

  it('reads nothing from nothing', () => {
    expect(parsePlan('').items).toEqual([])
    expect(parsePlan('   \n\n  ').items).toEqual([])
  })

  it('refuses a day beyond a year', () => {
    const { items, problems } = parsePlan('400. too far | x')

    expect(items).toHaveLength(0)
    expect(problems[0].reason).toContain('beyond')
  })
})

describe('compacting a plan', () => {
  it('closes the gaps but keeps the order', () => {
    const compacted = compactPlan([
      { day: 5, title: 'c', prompt: 'c' },
      { day: 1, title: 'a', prompt: 'a' },
      { day: 3, title: 'b', prompt: 'b' },
    ])

    expect(compacted.map((i) => [i.day, i.title])).toEqual([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ])
  })
})

describe('progress through a plan', () => {
  it('points at the first unused day', () => {
    const progress = planProgress([
      { day: 1, used: true },
      { day: 2, used: true },
      { day: 3, used: false },
    ])

    expect(progress).toEqual({ total: 3, used: 2, remaining: 1, nextDay: 3, finished: false })
  })

  it('skips a used day in the middle rather than stopping at it', () => {
    // A run can fail and be retried out of order; the next day is the next
    // unused one, not the one after the last used one.
    expect(
      planProgress([
        { day: 1, used: true },
        { day: 2, used: false },
        { day: 3, used: true },
      ]).nextDay
    ).toBe(2)
  })

  it('is finished when everything is used', () => {
    const progress = planProgress([{ day: 1, used: true }])

    expect(progress.finished).toBe(true)
    expect(progress.nextDay).toBeNull()
  })

  it('is not "finished" when there was never a plan', () => {
    // Otherwise an AI campaign would read as a completed plan.
    expect(planProgress([]).finished).toBe(false)
  })
})

describe('what the next run should do', () => {
  const plan = [
    { day: 1, used: true },
    { day: 2, used: false },
  ]

  it('always invents for an AI campaign', () => {
    expect(decideNext({ source: 'ai', plan: [], whenEnds: 'stop' })).toEqual({ action: 'use_ai' })
  })

  it('takes the next planned day', () => {
    expect(decideNext({ source: 'planned', plan, whenEnds: 'stop' })).toEqual({
      action: 'use_planned',
      day: 2,
    })
  })

  it('stops when the plan is done and that is what was asked', () => {
    // A thirty-day launch must not post a thirty-first the customer never saw.
    const result = decideNext({
      source: 'planned',
      plan: [{ day: 1, used: true }],
      whenEnds: 'stop',
    })

    expect(result.action).toBe('stop')
    expect(result).toHaveProperty('reason')
  })

  it('hands over to the model when asked to continue', () => {
    expect(
      decideNext({ source: 'planned', plan: [{ day: 1, used: true }], whenEnds: 'continue_with_ai' })
    ).toEqual({ action: 'use_ai' })
  })

  it('goes back to day one when asked to repeat', () => {
    expect(
      decideNext({
        source: 'planned',
        plan: [
          { day: 1, used: true },
          { day: 2, used: true },
        ],
        whenEnds: 'repeat',
      })
    ).toEqual({ action: 'use_planned', day: 1 })
  })

  it('stops rather than inventing when a planned campaign has no plan', () => {
    // A setup mistake. Generating content would hide it.
    const result = decideNext({ source: 'planned', plan: [], whenEnds: 'continue_with_ai' })

    expect(result.action).toBe('stop')
  })
})

describe('reading settings off stored rows', () => {
  it('defaults to the behaviour campaigns already had', () => {
    expect(ideaSource(undefined)).toBe('ai')
    expect(ideaSource('planned')).toBe('planned')
    expect(whenPlanEnds(undefined)).toBe('stop')
    expect(whenPlanEnds('repeat')).toBe('repeat')
    expect(whenPlanEnds('nonsense')).toBe('stop')
  })
})
