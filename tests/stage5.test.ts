import { describe, it, expect } from 'vitest'
import {
  toSnapshot,
  fromSnapshot,
  isDifferent,
  describeChange,
  VERSION_LIMIT,
  type Snapshot,
} from '@/lib/projects/versions'
import {
  parseIdeas,
  nextItem,
  progressOf,
  jobStatus,
  estimateSeconds,
  describeEstimate,
  MAX_ATTEMPTS,
  MAX_ITEMS,
  STALE_RUNNING_MS,
  SECONDS_PER_ITEM,
  type BulkItem,
} from '@/lib/bulk/queue'
import type { EditablePanel } from '@/lib/comic/editor'

const panel = (id: string, over: Partial<EditablePanel> = {}): EditablePanel => ({
  id,
  pageNumber: 1,
  panelNumber: 1,
  image: `data:image/png;base64,BIG${id}`,
  rawImage: `data:image/png;base64,RAW${id}`,
  prompt: `draw ${id}`,
  dialogues: [],
  ...over,
})

// ---------------------------------------------------------------------------
//  Version history
// ---------------------------------------------------------------------------

describe('what a snapshot stores', () => {
  it('leaves the images out', () => {
    // Twenty-four data URLs is a 24MB row per save — slow to write, slow to
    // read, and it fills the database in a week.
    const snapshot = toSnapshot({ panels: [panel('a'), panel('b')] })
    const text = JSON.stringify(snapshot)

    expect(text).not.toContain('BIGa')
    expect(text).not.toContain('RAWa')
    expect(text).toContain('draw a')
  })

  it('keeps everything needed to rebuild', () => {
    const snapshot = toSnapshot({
      title: 'Pip Goes North',
      artStyle: 'Pixar 3D',
      layouts: { 1: 'grid-4' },
      castIds: ['c1'],
      panels: [panel('a', { dialogues: [{ speaker: 'Pip', text: 'Hi', x: 0.1, y: 0.1, type: 'speech' }] })],
    })

    expect(snapshot.title).toBe('Pip Goes North')
    expect(snapshot.artStyle).toBe('Pixar 3D')
    expect(snapshot.layouts).toEqual({ 1: 'grid-4' })
    expect(snapshot.castIds).toEqual(['c1'])
    expect(snapshot.panels[0].dialogues[0].text).toBe('Hi')
  })

  it('copies the dialogues rather than sharing them', () => {
    const source = [panel('a', { dialogues: [{ speaker: '', text: 'Hi', x: 0, y: 0, type: 'speech' }] })]
    const snapshot = toSnapshot({ panels: source })

    source[0].dialogues[0].text = 'Changed'

    expect(snapshot.panels[0].dialogues[0].text).toBe('Hi')
  })
})

describe('restoring a snapshot', () => {
  it('brings back the artwork that is still correct', () => {
    // Most restores undo a caption or a reorder, not a redraw. Throwing away
    // artwork that still matches would charge for those.
    const current = [panel('a'), panel('b')]
    const snapshot = toSnapshot({ panels: current })

    const restored = fromSnapshot(snapshot, current)

    expect(restored.panels[0].image).toBe(current[0].image)
    expect(restored.needsRedraw).toBe(0)
  })

  it('says how many panels need redrawing when the artwork is gone', () => {
    const snapshot = toSnapshot({ panels: [panel('a'), panel('b')] })
    const restored = fromSnapshot(snapshot, [])

    expect(restored.needsRedraw).toBe(2)
    expect(restored.panels[0].image).toBe('')
  })

  it('matches artwork by id, not by position', () => {
    // After a reorder the panel at index 0 is a different panel, and taking
    // its image would put the wrong picture on it.
    const snapshot = toSnapshot({ panels: [panel('b'), panel('a')] })
    const restored = fromSnapshot(snapshot, [panel('a'), panel('b')])

    expect(restored.panels[0].id).toBe('b')
    expect(restored.panels[0].image).toContain('BIGb')
  })
})

describe('whether a version is worth saving', () => {
  const base = toSnapshot({ panels: [panel('a')] })

  it('always saves the first', () => {
    expect(isDifferent(null, base)).toBe(true)
  })

  it('does not save one identical to the last', () => {
    // A history of indistinguishable entries makes finding the version you
    // wanted harder, not easier.
    expect(isDifferent(base, toSnapshot({ panels: [panel('a')] }))).toBe(false)
  })

  it('saves when the words changed', () => {
    const next = toSnapshot({ panels: [panel('a', { prompt: 'draw something else' })] })

    expect(isDifferent(base, next)).toBe(true)
  })
})

describe('describing what changed', () => {
  const before = toSnapshot({ panels: [panel('a'), panel('b')] })

  it('counts panels added and removed', () => {
    expect(describeChange(before, toSnapshot({ panels: [panel('a')] }))).toBe('Removed 1 panel')
    expect(
      describeChange(before, toSnapshot({ panels: [panel('a'), panel('b'), panel('c')] }))
    ).toBe('Added 1 panel')
  })

  it('names a rewording', () => {
    const after = toSnapshot({ panels: [panel('a', { prompt: 'new' }), panel('b')] })

    expect(describeChange(before, after)).toBe('Reworded 1 panel')
  })

  it('names a speech edit', () => {
    const after = toSnapshot({
      panels: [
        panel('a', { dialogues: [{ speaker: '', text: 'Hi', x: 0, y: 0, type: 'speech' }] }),
        panel('b'),
      ],
    })

    expect(describeChange(before, after)).toBe('Edited speech on 1 panel')
  })

  it('names a reorder', () => {
    expect(describeChange(before, toSnapshot({ panels: [panel('b'), panel('a')] }))).toBe(
      'Reordered panels'
    )
  })

  it('names a layout change', () => {
    const after = toSnapshot({ panels: [panel('a'), panel('b')], layouts: { 1: 'splash' } })

    expect(describeChange(before, after)).toBe('Changed layout')
  })

  it('calls the first one the first one', () => {
    expect(describeChange(null, before)).toBe('First version')
  })

  it('keeps a browsable number of versions', () => {
    expect(VERSION_LIMIT).toBeGreaterThan(5)
    expect(VERSION_LIMIT).toBeLessThan(200)
  })
})

// ---------------------------------------------------------------------------
//  Bulk runs
// ---------------------------------------------------------------------------

describe('reading a pasted list of ideas', () => {
  it('takes one per line', () => {
    expect(parseIdeas('A snail goes north\nA frog loses a boot').ideas).toEqual([
      'A snail goes north',
      'A frog loses a boot',
    ])
  })

  it('strips list formatting', () => {
    // "1. A snail goes north" would otherwise generate a comic about the
    // number one, which looks like the AI is broken.
    expect(parseIdeas('1. A snail\n2) A frog\n- A bee\n• A wasp').ideas).toEqual([
      'A snail',
      'A frog',
      'A bee',
      'A wasp',
    ])
  })

  it('skips blank lines and comments', () => {
    const { ideas, problems } = parseIdeas('# my list\n\nA snail\n\n// note\nA frog')

    expect(ideas).toEqual(['A snail', 'A frog'])
    expect(problems).toEqual([])
  })

  it('reports a duplicate rather than generating it twice', () => {
    const { ideas, problems } = parseIdeas('A snail\na SNAIL')

    expect(ideas).toHaveLength(1)
    expect(problems[0].reason).toContain('Already')
  })

  it('reports a line too short to generate from', () => {
    const { problems } = parseIdeas('ok')

    expect(problems[0].reason).toContain('Too short')
  })

  it('stops at the limit and says so', () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => `Idea number ${i}`).join('\n')
    const { ideas, problems } = parseIdeas(many)

    expect(ideas).toHaveLength(MAX_ITEMS)
    expect(problems.length).toBeGreaterThan(0)
  })

  it('reads nothing from nothing', () => {
    expect(parseIdeas('').ideas).toEqual([])
  })
})

describe('picking the next idea', () => {
  const item = (over: Partial<BulkItem>): BulkItem => ({
    id: 'i',
    position: 1,
    idea: 'x',
    status: 'queued',
    attempts: 0,
    ...over,
  })

  const now = new Date('2026-08-11T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it('goes in the order the list was written', () => {
    // A series generated out of order is a series with the wrong numbers.
    const next = nextItem(
      [item({ id: 'c', position: 3 }), item({ id: 'a', position: 1 }), item({ id: 'b', position: 2 })],
      now
    )

    expect(next.item?.id).toBe('a')
  })

  it('skips what is finished', () => {
    const next = nextItem(
      [
        item({ id: 'a', position: 1, status: 'done' }),
        item({ id: 'b', position: 2, status: 'skipped' }),
        item({ id: 'c', position: 3 }),
      ],
      now
    )

    expect(next.item?.id).toBe('c')
  })

  it('retries a failure until the limit, then moves on', () => {
    expect(nextItem([item({ status: 'failed', attempts: 1 })], now).item).not.toBeNull()
    expect(nextItem([item({ status: 'failed', attempts: MAX_ATTEMPTS })], now).item).toBeNull()
  })

  it('leaves one that is genuinely running alone', () => {
    const next = nextItem([item({ status: 'running', startedAt: ago(1000) })], now)

    expect(next.item).toBeNull()
    expect(next.reason).toContain('already being generated')
  })

  it('reclaims one whose worker died', () => {
    const next = nextItem(
      [item({ status: 'running', startedAt: ago(STALE_RUNNING_MS + 1000) })],
      now
    )

    expect(next.item).not.toBeNull()
  })

  it('says when there is nothing left', () => {
    expect(nextItem([item({ status: 'done' })], now).reason).toContain('finished')
    expect(nextItem([], now).item).toBeNull()
  })
})

describe('job progress', () => {
  const item = (status: ItemStatusShim, attempts = 0): BulkItem => ({
    id: Math.random().toString(),
    position: 1,
    idea: 'x',
    status,
    attempts,
  })

  type ItemStatusShim = BulkItem['status']

  it('counts what is settled, not what is running', () => {
    const progress = progressOf([item('done'), item('done'), item('running'), item('queued')])

    expect(progress).toMatchObject({ total: 4, done: 2, remaining: 2, percent: 50 })
    expect(progress.finished).toBe(false)
  })

  it('counts a failure as settled only once it has given up', () => {
    expect(progressOf([item('failed', 1)]).remaining).toBe(1)
    expect(progressOf([item('failed', MAX_ATTEMPTS)]).remaining).toBe(0)
  })

  it('is not "finished" when there was never anything in it', () => {
    // Otherwise an empty job reads as success for work never set up.
    expect(progressOf([]).finished).toBe(false)
  })

  it('reports the job done when some succeeded and failed when none did', () => {
    expect(jobStatus([item('done'), item('failed', MAX_ATTEMPTS)], 'running')).toBe('done')
    expect(jobStatus([item('failed', MAX_ATTEMPTS)], 'running')).toBe('failed')
  })

  it('leaves a paused or cancelled job alone', () => {
    expect(jobStatus([item('queued')], 'paused')).toBe('paused')
    expect(jobStatus([item('done')], 'cancelled')).toBe('cancelled')
  })

  it('goes back to running while an item is in flight', () => {
    expect(jobStatus([item('running'), item('queued')], 'queued')).toBe('running')
  })
})

describe('telling the customer how long it will take', () => {
  it('is honest about a big batch', () => {
    // "Twenty comics" sounds instant and is closer to forty minutes. A
    // customer who did not know closes the tab and assumes it broke.
    expect(estimateSeconds(20)).toBe(20 * SECONDS_PER_ITEM)
    expect(describeEstimate(20)).toContain('minutes')
  })

  it('says hours when it is hours', () => {
    // A round number of hours reads as hours; anything else gets the minutes
    // too, because "about 2 hours" for 1h50m is a worse answer than the truth.
    const roundHour = Math.round(3600 / SECONDS_PER_ITEM)

    expect(describeEstimate(roundHour)).toMatch(/h|hour/)
    expect(describeEstimate(60)).toBe('About 1h 50m')
  })

  it('says finished when there is nothing left', () => {
    expect(describeEstimate(0)).toBe('Finished')
  })
})
