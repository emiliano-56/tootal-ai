/**
 * Mazes, generated rather than drawn by a model.
 *
 * Every activity page in this file is procedural on purpose. A maze from an
 * image model is a picture of a maze: it looks right at a glance, the walls do
 * not join up, and there is no path from start to finish. It cannot be
 * checked, it costs a generation, and it takes a minute. This costs nothing,
 * is instant, and is solvable by construction.
 *
 * That last part is the whole argument. A recursive backtracker produces a
 * *perfect* maze — every cell reachable from every other by exactly one route
 * — so there is always a solution and never a second one to argue about.
 *
 * Pure and seeded, so the same seed gives the same maze: a customer who
 * printed page 4 and wants it again gets the same page, and every property
 * below can be tested.
 */

export interface Cell {
  /** Walls in reading order: top, right, bottom, left. */
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export interface Maze {
  width: number
  height: number
  /** Row-major, `height` rows of `width` cells. */
  cells: Cell[][]
  start: { x: number; y: number }
  end: { x: number; y: number }
  seed: number
}

export const MAZE_SIZES = [
  { key: 'tiny', label: 'Very easy', width: 8, height: 8, ages: '3-5' },
  { key: 'small', label: 'Easy', width: 12, height: 12, ages: '5-7' },
  { key: 'medium', label: 'Medium', width: 18, height: 18, ages: '7-10' },
  { key: 'large', label: 'Hard', width: 26, height: 26, ages: '10+' },
] as const

/**
 * A small deterministic generator.
 *
 * `Math.random` would make a maze that cannot be reproduced, which breaks
 * reprinting a page and makes every test here a coin toss. Mulberry32 is four
 * lines and has a long enough period for anything this draws.
 */
export function rng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let t = state

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function solidCell(): Cell {
  return { top: true, right: true, bottom: true, left: true }
}

/**
 * Carve a perfect maze.
 *
 * Iterative rather than recursive: a 26×26 maze is 676 cells deep in the
 * worst case, and browsers have blown their stack on less.
 */
export function generateMaze(width: number, height: number, seed = Date.now()): Maze {
  const w = Math.max(2, Math.min(60, Math.floor(width)))
  const h = Math.max(2, Math.min(60, Math.floor(height)))

  const random = rng(seed)

  const cells: Cell[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, solidCell)
  )

  const visited = Array.from({ length: h }, () => Array.from({ length: w }, () => false))
  const stack: { x: number; y: number }[] = [{ x: 0, y: 0 }]

  visited[0][0] = true

  while (stack.length > 0) {
    const current = stack[stack.length - 1]

    const neighbours = [
      { x: current.x, y: current.y - 1, wall: 'top', opposite: 'bottom' },
      { x: current.x + 1, y: current.y, wall: 'right', opposite: 'left' },
      { x: current.x, y: current.y + 1, wall: 'bottom', opposite: 'top' },
      { x: current.x - 1, y: current.y, wall: 'left', opposite: 'right' },
    ].filter(
      (next) => next.x >= 0 && next.x < w && next.y >= 0 && next.y < h && !visited[next.y][next.x]
    )

    if (neighbours.length === 0) {
      stack.pop()
      continue
    }

    const chosen = neighbours[Math.floor(random() * neighbours.length)]

    // Knock the wall out on both sides, or one cell would think it is walled
    // in while its neighbour thinks otherwise.
    cells[current.y][current.x][chosen.wall as keyof Cell] = false
    cells[chosen.y][chosen.x][chosen.opposite as keyof Cell] = false

    visited[chosen.y][chosen.x] = true
    stack.push({ x: chosen.x, y: chosen.y })
  }

  // Opposite corners: the longest journey the grid affords, and the two
  // places a child looks first.
  const start = { x: 0, y: 0 }
  const end = { x: w - 1, y: h - 1 }

  // Doors in the outer wall, so the entrance reads as an entrance.
  cells[start.y][start.x].left = false
  cells[end.y][end.x].right = false

  return { width: w, height: h, cells, start, end, seed }
}

/**
 * The route from start to finish.
 *
 * Used for the answer page — a colouring book of mazes without a solutions
 * section is a book of complaints — and by the tests, where it is the proof
 * that the maze can be finished at all.
 */
export function solveMaze(maze: Maze): { x: number; y: number }[] {
  const { width, height, cells, start, end } = maze

  const cameFrom = new Map<string, string | null>()
  const key = (x: number, y: number) => `${x},${y}`
  const queue: { x: number; y: number }[] = [start]

  cameFrom.set(key(start.x, start.y), null)

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.x === end.x && current.y === end.y) break

    const cell = cells[current.y][current.x]

    const options = [
      { x: current.x, y: current.y - 1, open: !cell.top },
      { x: current.x + 1, y: current.y, open: !cell.right },
      { x: current.x, y: current.y + 1, open: !cell.bottom },
      { x: current.x - 1, y: current.y, open: !cell.left },
    ]

    for (const next of options) {
      if (!next.open) continue
      if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) continue
      if (cameFrom.has(key(next.x, next.y))) continue

      cameFrom.set(key(next.x, next.y), key(current.x, current.y))
      queue.push({ x: next.x, y: next.y })
    }
  }

  if (!cameFrom.has(key(end.x, end.y))) return []

  const path: { x: number; y: number }[] = []
  let cursor: string | null = key(end.x, end.y)

  while (cursor) {
    const [x, y] = cursor.split(',').map(Number)

    path.unshift({ x, y })
    cursor = cameFrom.get(cursor) ?? null
  }

  return path
}

/** Whether every cell can be reached — the property that makes it a maze. */
export function isPerfect(maze: Maze): boolean {
  const seen = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const stack = [maze.start]

  seen.add(key(maze.start.x, maze.start.y))

  while (stack.length > 0) {
    const current = stack.pop()!
    const cell = maze.cells[current.y][current.x]

    const options = [
      { x: current.x, y: current.y - 1, open: !cell.top },
      { x: current.x + 1, y: current.y, open: !cell.right },
      { x: current.x, y: current.y + 1, open: !cell.bottom },
      { x: current.x - 1, y: current.y, open: !cell.left },
    ]

    for (const next of options) {
      if (!next.open) continue
      if (next.x < 0 || next.x >= maze.width || next.y < 0 || next.y >= maze.height) continue
      if (seen.has(key(next.x, next.y))) continue

      seen.add(key(next.x, next.y))
      stack.push(next)
    }
  }

  return seen.size === maze.width * maze.height
}
