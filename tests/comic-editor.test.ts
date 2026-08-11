import { describe, it, expect } from 'vitest'
import {
  movePanel,
  removePanel,
  duplicatePanel,
  renumber,
  byPage,
  removePage,
  movePage,
  clampPosition,
  addBubble,
  updateBubble,
  removeBubble,
  initHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_LIMIT,
  sourceImage,
  type EditablePanel,
} from '@/lib/comic/editor'
import {
  PAGE_LAYOUTS,
  layout,
  layoutsFor,
  autoLayout,
  gridLayout,
  toPixels,
  coverCrop,
} from '@/lib/comic/layouts'

const panel = (id: string, page = 1, number = 1): EditablePanel => ({
  id,
  pageNumber: page,
  panelNumber: number,
  image: `data:${id}`,
  prompt: `prompt ${id}`,
  dialogues: [],
})

describe('moving panels', () => {
  const panels = [panel('a'), panel('b'), panel('c')]

  it('moves one place forward and back', () => {
    expect(movePanel(panels, 0, 1).map((p) => p.id)).toEqual(['b', 'a', 'c'])
    expect(movePanel(panels, 2, -1).map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('does nothing at the ends rather than wrapping', () => {
    // Wrapping would send the first panel to the back of the book, which is
    // never what a click on "up" meant.
    expect(movePanel(panels, 0, -1)).toBe(panels)
    expect(movePanel(panels, 2, 1)).toBe(panels)
  })

  it('ignores an index that is not there', () => {
    expect(movePanel(panels, 9, -1)).toBe(panels)
    expect(movePanel(panels, -1, 1)).toBe(panels)
  })

  it('never mutates the original', () => {
    const before = panels.map((p) => p.id)

    movePanel(panels, 0, 1)

    expect(panels.map((p) => p.id)).toEqual(before)
  })
})

describe('removing and duplicating', () => {
  const panels = [panel('a'), panel('b'), panel('c')]

  it('removes by index', () => {
    expect(removePanel(panels, 1).map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('ignores an index that is not there', () => {
    expect(removePanel(panels, 9)).toBe(panels)
  })

  it('drops a copy in right after the original', () => {
    const next = duplicatePanel(panels, 0, () => 'a2')

    expect(next.map((p) => p.id)).toEqual(['a', 'a2', 'b', 'c'])
  })

  it('gives the copy its own dialogues', () => {
    // Sharing the array would tie the copy's speech to the original's, which
    // reads as a haunting rather than a bug when you hit it.
    const withSpeech = [{ ...panel('a'), dialogues: addBubble([], { text: 'Hello' }) }]
    const next = duplicatePanel(withSpeech, 0, () => 'a2')

    next[1].dialogues[0].text = 'Changed'

    expect(next[0].dialogues[0].text).toBe('Hello')
  })
})

describe('which image bubbles get painted onto', () => {
  // The bug this prevents: bubbles are burned into the pixels, so
  // compositing onto the displayed image draws the new bubbles on top of the
  // old ones. There is no way back from that without spending a generation.

  it('uses the clean drawing when there is one', () => {
    expect(sourceImage({ ...panel('a'), image: 'withBubbles', rawImage: 'clean' })).toBe('clean')
  })

  it('falls back to the shown image on a panel made before the editor existed', () => {
    // Right for a panel that never had bubbles, and merely imperfect for one
    // that did — which beats refusing to open the editor.
    expect(sourceImage({ ...panel('a'), image: 'only' })).toBe('only')
  })

  it('falls back when the clean copy is an empty string', () => {
    expect(sourceImage({ ...panel('a'), image: 'shown', rawImage: '' })).toBe('shown')
  })

  it('a duplicate carries the clean drawing too', () => {
    // Otherwise the copy's bubbles would be editable exactly once.
    const source = [{ ...panel('a'), image: 'composited', rawImage: 'clean' }]
    const next = duplicatePanel(source, 0, () => 'a2')

    expect(sourceImage(next[1])).toBe('clean')
  })
})

describe('numbering', () => {
  it('renumbers pages and panels to read 1..n', () => {
    const panels = [panel('a'), panel('b'), panel('c'), panel('d'), panel('e')]
    const next = renumber(panels, 2)

    expect(next.map((p) => `${p.pageNumber}.${p.panelNumber}`)).toEqual([
      '1.1',
      '1.2',
      '2.1',
      '2.2',
      '3.1',
    ])
  })

  it('survives a nonsense panels-per-page', () => {
    expect(renumber([panel('a')], 0)[0].pageNumber).toBe(1)
    expect(renumber([panel('a')], -3)[0].pageNumber).toBe(1)
  })
})

describe('pages', () => {
  const panels = [
    panel('a', 1, 1),
    panel('b', 1, 2),
    panel('c', 2, 1),
    panel('d', 3, 1),
  ]

  it('groups in order, panels sorted within a page', () => {
    const pages = byPage([panel('b', 1, 2), panel('a', 1, 1)])

    expect(pages).toHaveLength(1)
    expect(pages[0].panels.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('removes a whole page', () => {
    expect(removePage(panels, 1).map((p) => p.id)).toEqual(['c', 'd'])
  })

  it('moves a page and keeps its panels together and in order', () => {
    const next = movePage(panels, 2, -1)

    expect(next.map((p) => p.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('does nothing moving the first page up', () => {
    expect(movePage(panels, 1, -1)).toBe(panels)
  })

  it('does nothing for a page that is not there', () => {
    expect(movePage(panels, 9, 1)).toBe(panels)
  })
})

describe('bubbles', () => {
  it('keeps a bubble inside the panel', () => {
    expect(clampPosition(-5, 2)).toEqual({ x: 0.02, y: 0.98 })
    expect(clampPosition(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('recovers from a non-number rather than putting a bubble nowhere', () => {
    // Anything not finite falls to the centre of the panel: it is visible,
    // it is obviously wrong, and it is draggable. A bubble at the edge would
    // look deliberate and one at NaN would not render at all.
    expect(clampPosition(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ x: 0.5, y: 0.5 })
    expect(clampPosition(Number.NEGATIVE_INFINITY, Number.NaN)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('adds a bubble high and left, away from faces', () => {
    const [bubble] = addBubble([])

    expect(bubble.x).toBeLessThan(0.2)
    expect(bubble.y).toBeLessThan(0.2)
    expect(bubble.type).toBe('speech')
  })

  it('updates one bubble and clamps what it is given', () => {
    const dialogues = addBubble([], { text: 'Hi' })
    const next = updateBubble(dialogues, 0, { text: 'Bye', x: 9 })

    expect(next[0].text).toBe('Bye')
    expect(next[0].x).toBe(0.98)
  })

  it('ignores an index that is not there', () => {
    const dialogues = addBubble([])

    expect(updateBubble(dialogues, 5, { text: 'x' })).toBe(dialogues)
    expect(removeBubble(dialogues, 5)).toBe(dialogues)
  })

  it('removes by index', () => {
    const two = addBubble(addBubble([], { text: 'one' }), { text: 'two' })

    expect(removeBubble(two, 0).map((d) => d.text)).toEqual(['two'])
  })
})

describe('undo and redo', () => {
  it('starts with nothing to undo', () => {
    const history = initHistory('a')

    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('goes back and forward', () => {
    let history = commit(commit(initHistory('a'), 'b'), 'c')

    expect(history.present).toBe('c')

    history = undo(history)
    expect(history.present).toBe('b')

    history = undo(history)
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)

    history = redo(history)
    expect(history.present).toBe('b')
  })

  it('drops the redo stack once something new is done', () => {
    // Having undone and then done something else, the old future is no longer
    // reachable — offering it would redo something that never happened.
    let history = commit(commit(initHistory('a'), 'b'), 'c')

    history = undo(history)
    history = commit(history, 'd')

    expect(canRedo(history)).toBe(false)
    expect(history.present).toBe('d')
  })

  it('forgets the oldest steps rather than growing without limit', () => {
    let history = initHistory(0)

    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) history = commit(history, i)

    expect(history.past).toHaveLength(HISTORY_LIMIT)
  })

  it('does nothing at either end', () => {
    const history = initHistory('a')

    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })
})

describe('page layouts', () => {
  it('every layout covers the page with the panels it claims', () => {
    for (const entry of PAGE_LAYOUTS) {
      expect(entry.rects, entry.key).toHaveLength(entry.panels)

      const area = entry.rects.reduce((sum, rect) => sum + rect.w * rect.h, 0)

      // A layout that does not fill the page leaves a white hole on a printed
      // book, which is the sort of thing nobody notices until it is printed.
      expect(area, entry.key).toBeCloseTo(1, 4)

      for (const rect of entry.rects) {
        expect(rect.x, entry.key).toBeGreaterThanOrEqual(0)
        expect(rect.y, entry.key).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.w, entry.key).toBeLessThanOrEqual(1.0001)
        expect(rect.y + rect.h, entry.key).toBeLessThanOrEqual(1.0001)
      }
    }
  })

  it('finds layouts by key and by panel count', () => {
    expect(layout('splash')?.panels).toBe(1)
    expect(layout('nope')).toBeUndefined()
    expect(layoutsFor(4).map((l) => l.key)).toEqual(['grid-4', 'feature-4'])
  })

  it('picks a designed layout when there is one', () => {
    expect(autoLayout(3).key).toBe('strip-3')
    expect(autoLayout(1).key).toBe('splash')
  })

  it('falls back to a grid rather than refusing an odd count', () => {
    // Five panels is unusual, not an error — dropping the fifth loses work.
    const five = autoLayout(5)

    expect(five.rects).toHaveLength(5)
    expect(five.rects.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(1, 4)
  })

  it('never makes a grid more than three columns wide', () => {
    // A four-across panel on a portrait page is a letterbox slot too narrow
    // to read a face in.
    for (const count of [4, 9, 12, 16]) {
      const widths = new Set(gridLayout(count).rects.map((r) => Math.round(1 / r.w)))

      expect(Math.max(...widths), String(count)).toBeLessThanOrEqual(3)
    }
  })

  it('spreads a short last row across the full width', () => {
    // Otherwise a seven-panel page ends with a lone panel and a hole beside it.
    const seven = gridLayout(7)
    const lastRowY = Math.max(...seven.rects.map((r) => r.y))
    const lastRow = seven.rects.filter((r) => r.y === lastRowY)

    expect(lastRow.reduce((sum, r) => sum + r.w, 0)).toBeCloseTo(1, 4)
  })
})

describe('turning layouts into pixels', () => {
  it('scales to the page size', () => {
    const [rect] = toPixels([{ x: 0.5, y: 0, w: 0.5, h: 1 }], 1000, 800)

    expect(rect).toEqual({ x: 500, y: 0, w: 500, h: 800 })
  })

  it('takes the gutter out of the panels, not off the page', () => {
    // Adding it around each panel is how artwork ends up in the trim on a
    // printed book.
    const rects = toPixels(
      [
        { x: 0, y: 0, w: 0.5, h: 1 },
        { x: 0.5, y: 0, w: 0.5, h: 1 },
      ],
      1000,
      500,
      20
    )

    // Outer edges stay flush with the page.
    expect(rects[0].x).toBe(0)
    expect(rects[1].x + rects[1].w).toBe(1000)
    // And there is a full gutter between them.
    expect(rects[1].x - (rects[0].x + rects[0].w)).toBe(20)
  })

  it('never produces a panel with no area', () => {
    const [rect] = toPixels([{ x: 0.25, y: 0.25, w: 0.01, h: 0.01 }], 100, 100, 40)

    expect(rect.w).toBeGreaterThan(0)
    expect(rect.h).toBeGreaterThan(0)
  })
})

describe('fitting a square drawing into a page slot', () => {
  it('trims the sides of an image that is too wide', () => {
    const crop = coverCrop(2000, 1000, 500, 500)

    expect(crop.sh).toBe(1000)
    expect(crop.sw).toBe(1000)
    expect(crop.sx).toBe(500)
  })

  it('trims a tall image from the top and bottom, biased upward', () => {
    // Faces sit in the top half of a character panel far more often than the
    // bottom, so an even crop cuts heads off.
    const crop = coverCrop(1000, 2000, 500, 500)

    expect(crop.sw).toBe(1000)
    expect(crop.sh).toBe(1000)
    expect(crop.sy).toBeLessThan((2000 - 1000) / 2)
  })

  it('does not distort a matching aspect ratio', () => {
    const crop = coverCrop(1000, 1000, 500, 500)

    expect(crop).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 1000 })
  })

  it('survives nonsense dimensions', () => {
    expect(() => coverCrop(0, 0, 100, 100)).not.toThrow()
    expect(coverCrop(0, 0, 100, 100).sw).toBeGreaterThan(0)
  })
})
