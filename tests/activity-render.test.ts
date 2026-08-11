import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Exercising the canvas renderers.
 *
 * The pure generators are tested elsewhere; this is about the drawing code,
 * where the failures are different in kind: a NaN coordinate, an undefined
 * variable in one switch branch, a loop that never advances. None of those
 * show up in a type check, and all of them produce a blank or hung page.
 *
 * A recording context stands in for a real one. It cannot tell us the page
 * *looks* right — nothing automated can — but it proves every branch runs to
 * completion and that nothing was asked to draw at a coordinate that is not
 * a number, which is what actually breaks these.
 */

interface Call {
  method: string
  args: unknown[]
}

let calls: Call[] = []

/** Numbers that would silently produce an invisible or corrupt drawing. */
function badNumbers(entries: Call[]): { method: string; args: unknown[] }[] {
  return entries.filter((call) =>
    call.args.some((arg) => typeof arg === 'number' && !Number.isFinite(arg))
  )
}

function fakeContext() {
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args })
    }

  return new Proxy(
    {
      canvas: { width: 2550, height: 3300 },
      measureText: (text: string) => ({ width: String(text).length * 8 }),
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
      save() {},
      restore() {},
      setLineDash: record('setLineDash'),
      drawImage: record('drawImage'),
    } as Record<string, unknown>,
    {
      get(target, property: string) {
        if (property in target) return target[property]

        // Anything unset is a drawing call we want recorded; anything read as
        // a value (fillStyle, font) reads back as a plain string.
        return typeof property === 'string' && /^[a-z]/.test(property)
          ? record(property)
          : undefined
      },
      set() {
        return true
      },
    }
  ) as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  calls = []

  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag !== 'canvas') return {}

      return {
        width: 0,
        height: 0,
        getContext: () => fakeContext(),
        toDataURL: () => 'data:image/png;base64,STUB',
      }
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('activity page renderers', () => {
  it('draws a maze, and its solution, without a single bad coordinate', async () => {
    const { generateMaze } = await import('@/lib/activities/maze')
    const { renderMaze } = await import('@/lib/activities/render')

    const maze = generateMaze(12, 12, 7)

    for (const showSolution of [false, true]) {
      calls = []

      const png = renderMaze(maze, { trimKey: '8.5x11', title: 'Find the way', showSolution })

      expect(png).toContain('data:image/png')
      expect(calls.length).toBeGreaterThan(50)
      expect(badNumbers(calls), `solution=${showSolution}`).toEqual([])
    }
  })

  it('draws a word search and its answer rings', async () => {
    const { generateWordSearch } = await import('@/lib/activities/wordsearch')
    const { renderWordSearch } = await import('@/lib/activities/render')

    const puzzle = generateWordSearch(['CAT', 'DOG', 'RABBIT', 'ELEPHANT'], { size: 12, seed: 3 })

    for (const showSolution of [false, true]) {
      calls = []

      expect(renderWordSearch(puzzle, { showSolution })).toContain('data:image/png')
      expect(badNumbers(calls), `solution=${showSolution}`).toEqual([])
    }
  })

  it('draws every dot-to-dot shape', async () => {
    const { dotToDot, SHAPES } = await import('@/lib/activities/dots')
    const { renderDotToDot } = await import('@/lib/activities/render')

    for (const shape of SHAPES) {
      calls = []

      const puzzle = dotToDot(shape.key, { dots: 20, seed: 1 })

      expect(renderDotToDot(puzzle, { showSolution: true })).toContain('data:image/png')
      expect(badNumbers(calls), shape.key).toEqual([])
    }
  })

  it('draws every journal and planner page, on every trim size', async () => {
    // The switch in renderPaper has eleven branches, and a mistake in a rarely
    // chosen one would sit there until a customer picked it.
    const { PAPER_TYPES, TRIM_SIZES } = await import('@/lib/activities/paper')
    const { renderPaper } = await import('@/lib/activities/render')

    for (const paper of PAPER_TYPES) {
      for (const trim of TRIM_SIZES) {
        calls = []

        const png = renderPaper(paper.key, { trimKey: trim.key, title: 'Notes', spacing: 'wide' })

        expect(png, `${paper.key} @ ${trim.key}`).toContain('data:image/png')
        expect(badNumbers(calls), `${paper.key} @ ${trim.key}`).toEqual([])
      }
    }
  })

  it('draws a blank page without drawing anything on it', async () => {
    const { renderPaper } = await import('@/lib/activities/render')

    calls = []
    renderPaper('blank', {})

    // Only the background fill — a "blank" page with rules on it is not blank.
    expect(calls.filter((call) => call.method === 'stroke')).toHaveLength(0)
  })

  it('falls back to ruled lines for a page type it does not know', async () => {
    const { renderPaper } = await import('@/lib/activities/render')

    calls = []
    renderPaper('origami', {})

    expect(calls.filter((call) => call.method === 'stroke').length).toBeGreaterThan(0)
    expect(badNumbers(calls)).toEqual([])
  })

  it('puts the gutter on the binding side, which alternates', async () => {
    const { renderPaper } = await import('@/lib/activities/render')

    const firstX = (pageNumber: number) => {
      calls = []
      renderPaper('lined', { trimKey: '6x9', pageNumber, pageCount: 400 })

      const move = calls.find((call) => call.method === 'moveTo')

      return move?.args[0] as number
    }

    // A right-hand page is bound on the left, so its content starts further
    // in. Getting this backwards puts every second page into the spine.
    expect(firstX(1)).toBeGreaterThan(firstX(2))
  })
})
