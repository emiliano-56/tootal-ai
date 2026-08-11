import { describe, it, expect } from 'vitest'
import { generateMaze, solveMaze, isPerfect, rng, MAZE_SIZES } from '@/lib/activities/maze'
import {
  generateWordSearch,
  normaliseWord,
  wordCells,
  readAt,
  DIRECTION_SETS,
  MAX_GRID,
} from '@/lib/activities/wordsearch'
import { simplify, toDots, resample, dotToDot, SHAPES, rotateStart } from '@/lib/activities/dots'
import {
  PAPER_TYPES,
  TRIM_SIZES,
  trim,
  gutterFor,
  marginsFor,
  contentBox,
  ruleLines,
  ruleSpacing,
} from '@/lib/activities/paper'

describe('the seeded generator', () => {
  it('gives the same sequence for the same seed', () => {
    // Without this a reprinted page is a different page, and every test in
    // this file is a coin toss.
    const a = Array.from({ length: 5 }, rng(42))
    const b = Array.from({ length: 5 }, rng(42))

    expect(a).toEqual(b)
  })

  it('gives different sequences for different seeds', () => {
    expect(Array.from({ length: 5 }, rng(1))).not.toEqual(Array.from({ length: 5 }, rng(2)))
  })

  it('stays between 0 and 1', () => {
    const random = rng(7)

    for (let i = 0; i < 500; i++) {
      const value = random()

      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('mazes', () => {
  it('is always solvable — the whole point of generating rather than drawing', () => {
    // A maze from an image model looks right and has no route through it.
    for (const seed of [1, 2, 3, 99, 12345]) {
      const maze = generateMaze(12, 12, seed)
      const path = solveMaze(maze)

      expect(path.length, `seed ${seed}`).toBeGreaterThan(0)
      expect(path[0]).toEqual(maze.start)
      expect(path[path.length - 1]).toEqual(maze.end)
    }
  })

  it('reaches every cell, so there are no sealed-off pockets', () => {
    for (const seed of [1, 50, 777]) {
      expect(isPerfect(generateMaze(10, 14, seed)), `seed ${seed}`).toBe(true)
    }
  })

  it('is reproducible from its seed', () => {
    expect(generateMaze(8, 8, 2024)).toEqual(generateMaze(8, 8, 2024))
  })

  it('knocks walls out on both sides', () => {
    // One cell thinking it is open while its neighbour thinks it is walled is
    // how a maze ends up with a route the solver finds and a child cannot.
    const maze = generateMaze(6, 6, 5)

    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width - 1; x++) {
        expect(maze.cells[y][x].right, `${x},${y}`).toBe(maze.cells[y][x + 1].left)
      }
    }
  })

  it('opens a door at the start and the end', () => {
    const maze = generateMaze(9, 9, 3)

    expect(maze.cells[0][0].left).toBe(false)
    expect(maze.cells[maze.height - 1][maze.width - 1].right).toBe(false)
  })

  it('refuses to build something degenerate', () => {
    expect(generateMaze(0, 0, 1).width).toBeGreaterThanOrEqual(2)
    expect(generateMaze(500, 500, 1).width).toBeLessThanOrEqual(60)
  })

  it('every offered size builds and solves', () => {
    for (const size of MAZE_SIZES) {
      const maze = generateMaze(size.width, size.height, 11)

      expect(isPerfect(maze), size.key).toBe(true)
      expect(solveMaze(maze).length, size.key).toBeGreaterThan(0)
    }
  })
})

describe('word searches', () => {
  const words = ['CAT', 'DOG', 'BIRD', 'FISH', 'RABBIT']

  it('every placed word is actually readable in the finished grid', () => {
    // Checked by reading the grid back, not by trusting the code that wrote
    // it — two independent paths is the only way this proves anything.
    for (const seed of [1, 2, 3, 42]) {
      const puzzle = generateWordSearch(words, { size: 12, seed })

      for (const placed of puzzle.placed) {
        const read = readAt(puzzle.grid, placed.x, placed.y, placed.dx, placed.dy, placed.word.length)

        expect(read, `${placed.word} @ seed ${seed}`).toBe(placed.word)
      }
    }
  })

  it('places every word when there is room', () => {
    const puzzle = generateWordSearch(words, { size: 14, seed: 9 })

    expect(puzzle.placed).toHaveLength(words.length)
    expect(puzzle.rejected).toEqual([])
  })

  it('reports a word too long to print rather than dropping it', () => {
    // A customer who typed twelve words and got nine has a broken page, and
    // finds out when a child cannot finish it.
    const puzzle = generateWordSearch(['A'.repeat(MAX_GRID + 4)], { size: 6, seed: 1 })

    expect(puzzle.placed).toHaveLength(0)
    expect(puzzle.rejected[0].reason).toContain('Too long')
  })

  it('grows the grid to fit a long word, up to what prints legibly', () => {
    const puzzle = generateWordSearch(['ELEPHANTINE'], { size: 5, seed: 1 })

    expect(puzzle.size).toBeGreaterThanOrEqual('ELEPHANTINE'.length)
    expect(puzzle.placed).toHaveLength(1)
  })

  it('never builds a grid too big to read on a printed page', () => {
    // Without a cap one 30-letter entry makes a 30×30 puzzle — 900 letters,
    // smaller than the gridlines around them.
    const puzzle = generateWordSearch(['SUPERCALIFRAGILISTIC', 'CAT'], { size: 40, seed: 1 })

    expect(puzzle.size).toBeLessThanOrEqual(MAX_GRID)
  })

  it('strips spaces and punctuation, which cannot be found in a grid', () => {
    expect(normaliseWord('Ice  Cream!')).toBe('ICECREAM')
    expect(normaliseWord("don't")).toBe('DONT')
  })

  it('rejects a duplicate rather than placing it twice', () => {
    const puzzle = generateWordSearch(['CAT', 'CAT'], { size: 8, seed: 1 })

    expect(puzzle.placed).toHaveLength(1)
    expect(puzzle.rejected[0].reason).toContain('Already')
  })

  it('fills every cell', () => {
    const puzzle = generateWordSearch(words, { size: 10, seed: 4 })

    for (const row of puzzle.grid) {
      expect(row).toHaveLength(10)
      for (const letter of row) expect(letter).toMatch(/^[A-Z]$/)
    }
  })

  it('only goes forwards on easy, and every way on hard', () => {
    const easy = generateWordSearch(words, { size: 14, difficulty: 'easy', seed: 3 })

    for (const placed of easy.placed) {
      expect(placed.dx, placed.word).toBeGreaterThanOrEqual(0)
      expect(placed.dy, placed.word).toBeGreaterThanOrEqual(0)
    }

    expect(DIRECTION_SETS.hard.length).toBeGreaterThan(DIRECTION_SETS.easy.length)
  })

  it('lists the cells of a word for the answer page', () => {
    const cells = wordCells({ word: 'CAT', x: 2, y: 3, dx: 1, dy: 0, direction: 'across' })

    expect(cells).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ])
  })

  it('is reproducible from its seed', () => {
    expect(generateWordSearch(words, { size: 12, seed: 77 })).toEqual(
      generateWordSearch(words, { size: 12, seed: 77 })
    )
  })

  it('survives being given nothing', () => {
    const puzzle = generateWordSearch([], { size: 8, seed: 1 })

    expect(puzzle.placed).toEqual([])
    expect(puzzle.grid).toHaveLength(8)
  })
})

describe('dot-to-dot', () => {
  it('keeps the corners and drops the points on straight runs', () => {
    // Taking every nth point spaces dots along the path, so a long edge gets
    // a crowd of pointless dots and a tight curve loses its shape.
    const line = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.75, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]

    const kept = simplify(line, 0.01)

    expect(kept).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  it('leaves two points alone', () => {
    const two = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]

    expect(simplify(two, 0.5)).toEqual(two)
  })

  it('lands near the number of dots asked for', () => {
    const circle = resample(
      Array.from({ length: 200 }, (_, i) => {
        const t = (i / 200) * Math.PI * 2

        return { x: 0.5 + 0.4 * Math.cos(t), y: 0.5 + 0.4 * Math.sin(t) }
      }),
      240,
      true
    )

    const dots = toDots(circle, 24)

    expect(dots.length).toBeGreaterThanOrEqual(8)
    expect(dots.length).toBeLessThanOrEqual(40)
  })

  it('never returns fewer than three dots — two is a line, not a puzzle', () => {
    for (const entry of SHAPES) {
      const puzzle = dotToDot(entry.key, { dots: 3 })

      expect(puzzle.dots.length, entry.key).toBeGreaterThanOrEqual(3)
    }
  })

  it('builds every shape it offers', () => {
    for (const entry of SHAPES) {
      const puzzle = dotToDot(entry.key, { dots: 24 })

      expect(puzzle.dots.length, entry.key).toBeGreaterThan(3)

      for (const dot of puzzle.dots) {
        expect(Number.isFinite(dot.x), entry.key).toBe(true)
        expect(Number.isFinite(dot.y), entry.key).toBe(true)
      }
    }
  })

  it('falls back to a real shape for a name it does not know', () => {
    expect(dotToDot('banana').dots.length).toBeGreaterThan(3)
  })

  it('resamples a path to the requested number of points', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]

    expect(resample(square, 40, true)).toHaveLength(40)
  })

  it('survives a path with no length', () => {
    const same = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ]

    expect(() => resample(same, 20)).not.toThrow()
    expect(resample(same, 20).length).toBeGreaterThan(0)
  })

  it('moves the starting dot without losing any', () => {
    const dots = dotToDot('star', { dots: 10 }).dots
    const rotated = rotateStart(dots, 5)

    expect(rotated).toHaveLength(dots.length)
    expect(new Set(rotated.map((d) => `${d.x},${d.y}`)).size).toBe(
      new Set(dots.map((d) => `${d.x},${d.y}`)).size
    )
  })
})

describe('printed page geometry', () => {
  it('grows the inner margin with the page count', () => {
    // A thick book curves into its spine and swallows the inside edge. This
    // is the most common reason a manuscript is rejected.
    expect(gutterFor(50)).toBeLessThan(gutterFor(400))
    expect(gutterFor(120)).toBe(0.375)
    expect(gutterFor(250)).toBe(0.5)
    expect(gutterFor(800)).toBe(0.875)
  })

  it('treats an impossibly thin book as the minimum', () => {
    expect(gutterFor(0)).toBe(gutterFor(24))
  })

  it('puts the gutter on the binding side, and swaps it each page', () => {
    // Getting this backwards puts every second page's text into the spine,
    // and it looks perfectly fine on screen.
    const margins = marginsFor(200)

    const right = contentBox('6x9', 1, margins)
    const left = contentBox('6x9', 2, margins)

    expect(right.x).toBe(margins.inner)
    expect(left.x).toBe(margins.outer)
    expect(right.width).toBeCloseTo(left.width, 6)
  })

  it('never lets the content box leave the page', () => {
    for (const size of TRIM_SIZES) {
      for (const pages of [24, 200, 600]) {
        const margins = marginsFor(pages)

        for (const pageNumber of [1, 2]) {
          const box = contentBox(size.key, pageNumber, margins)

          expect(box.x, size.key).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, size.key).toBeLessThanOrEqual(size.width + 0.0001)
          expect(box.y + box.height, size.key).toBeLessThanOrEqual(size.height + 0.0001)
        }
      }
    }
  })

  it('falls back to a real trim size for a key it does not know', () => {
    expect(trim('a4-ish').key).toBe('6x9')
  })

  it('fits ruled lines inside the height and never past it', () => {
    const lines = ruleLines(9, 0.3)

    expect(lines.length).toBeGreaterThan(10)
    expect(Math.max(...lines)).toBeLessThanOrEqual(9)
    expect(Math.min(...lines)).toBeGreaterThan(0)
  })

  it('refuses a spacing so small it would draw a solid block', () => {
    expect(ruleLines(9, 0).length).toBeLessThan(100)
  })

  it('knows its spacings and describes every paper type', () => {
    expect(ruleSpacing('wide')).toBeGreaterThan(ruleSpacing('narrow'))
    expect(ruleSpacing('nonsense')).toBeGreaterThan(0)

    for (const entry of PAPER_TYPES) {
      expect(entry.label.length, entry.key).toBeGreaterThan(0)
      expect(entry.description.length, entry.key).toBeGreaterThan(0)
    }
  })
})
