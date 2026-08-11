import { rng } from '@/lib/activities/maze'

/**
 * Word searches, placed rather than guessed.
 *
 * Same argument as the maze: a model asked for a word search returns a grid of
 * letters that looks like one, and the words are not in it. Placement is a
 * solved problem — do it properly and every word is findable by construction,
 * with its coordinates recorded for the answer page.
 *
 * Words that will not fit are reported rather than dropped. A customer who
 * typed twelve words and got a puzzle containing nine has been quietly given
 * a broken page, and they will only find out when a child cannot finish it.
 */

export type Direction = { dx: number; dy: number; label: string }

/**
 * Directions by difficulty.
 *
 * Backwards and diagonal words are what separate a puzzle for a five-year-old
 * from one for a ten-year-old, so it is a setting rather than a constant.
 */
export const DIRECTION_SETS = {
  easy: [
    { dx: 1, dy: 0, label: 'across' },
    { dx: 0, dy: 1, label: 'down' },
  ],
  medium: [
    { dx: 1, dy: 0, label: 'across' },
    { dx: 0, dy: 1, label: 'down' },
    { dx: 1, dy: 1, label: 'diagonal' },
  ],
  hard: [
    { dx: 1, dy: 0, label: 'across' },
    { dx: 0, dy: 1, label: 'down' },
    { dx: 1, dy: 1, label: 'diagonal' },
    { dx: -1, dy: 0, label: 'backwards' },
    { dx: 0, dy: -1, label: 'up' },
    { dx: 1, dy: -1, label: 'diagonal up' },
    { dx: -1, dy: 1, label: 'diagonal back' },
    { dx: -1, dy: -1, label: 'diagonal up back' },
  ],
} as const

export type Difficulty = keyof typeof DIRECTION_SETS

export interface PlacedWord {
  word: string
  x: number
  y: number
  dx: number
  dy: number
  direction: string
}

export interface WordSearch {
  size: number
  /** Row-major grid of single uppercase letters. */
  grid: string[][]
  placed: PlacedWord[]
  /** Words that would not fit, with why. */
  rejected: { word: string; reason: string }[]
  seed: number
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The widest grid worth printing.
 *
 * Without a cap the grid grows to fit the longest word, so one 30-letter
 * entry produces a 30×30 puzzle — 900 letters on a page, unreadable at any
 * size a child can hold. Past twenty the letters are smaller than the
 * gridlines around them, so twenty is where a word gets refused instead.
 */
export const MAX_GRID = 20

/** Letters only, uppercased. Spaces and punctuation cannot be found in a grid. */
export function normaliseWord(word: string): string {
  return String(word ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

function fits(
  grid: (string | null)[][],
  word: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
  size: number
): boolean {
  for (let i = 0; i < word.length; i++) {
    const cx = x + dx * i
    const cy = y + dy * i

    if (cx < 0 || cx >= size || cy < 0 || cy >= size) return false

    const existing = grid[cy][cx]

    // Crossing another word is fine and desirable — it is what makes a grid
    // feel like a puzzle rather than a list — but only on a matching letter.
    if (existing !== null && existing !== word[i]) return false
  }

  return true
}

export function generateWordSearch(
  words: string[],
  options: { size?: number; difficulty?: Difficulty; seed?: number } = {}
): WordSearch {
  const difficulty = options.difficulty ?? 'easy'
  const seed = options.seed ?? Date.now()
  const random = rng(seed)

  const cleaned = words
    .map(normaliseWord)
    .filter((word) => word.length > 1)
    // Longest first: a long word has the fewest places it can go, so placing
    // it while the grid is empty is the difference between fitting everything
    // and running out of room for the one word that mattered.
    .sort((a, b) => b.length - a.length)

  const longest = cleaned.reduce((max, word) => Math.max(max, word.length), 0)

  // Grown to fit the longest word — otherwise it could not be placed at all —
  // but never past what prints legibly. A word longer than that is refused
  // below rather than allowed to blow the grid up.
  const size = Math.min(MAX_GRID, Math.max(options.size ?? 12, longest, 5))

  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  )

  const directions = DIRECTION_SETS[difficulty] as readonly Direction[]
  const placed: PlacedWord[] = []
  const rejected: { word: string; reason: string }[] = []
  const seen = new Set<string>()

  for (const word of cleaned) {
    if (seen.has(word)) {
      rejected.push({ word, reason: 'Already in the puzzle' })
      continue
    }

    if (word.length > size) {
      rejected.push({ word, reason: `Too long for a ${size}×${size} grid` })
      continue
    }

    seen.add(word)

    // Every starting cell and direction, shuffled, so words do not all bunch
    // into the top-left where the first candidate always is.
    const candidates: { x: number; y: number; direction: Direction }[] = []

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        for (const direction of directions) candidates.push({ x, y, direction })
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))

      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    const spot = candidates.find((candidate) =>
      fits(grid, word, candidate.x, candidate.y, candidate.direction.dx, candidate.direction.dy, size)
    )

    if (!spot) {
      rejected.push({ word, reason: 'No room left in the grid' })
      continue
    }

    for (let i = 0; i < word.length; i++) {
      grid[spot.y + spot.direction.dy * i][spot.x + spot.direction.dx * i] = word[i]
    }

    placed.push({
      word,
      x: spot.x,
      y: spot.y,
      dx: spot.direction.dx,
      dy: spot.direction.dy,
      direction: spot.direction.label,
    })
  }

  // Fill the gaps last, so a filler letter never blocks a word.
  const filled: string[][] = grid.map((row) =>
    row.map((letter) => letter ?? ALPHABET[Math.floor(random() * ALPHABET.length)])
  )

  return { size, grid: filled, placed, rejected, seed }
}

/** Every cell a placed word occupies, for the answer page. */
export function wordCells(word: PlacedWord): { x: number; y: number }[] {
  return Array.from({ length: word.word.length }, (_, i) => ({
    x: word.x + word.dx * i,
    y: word.y + word.dy * i,
  }))
}

/**
 * Read a word back out of the finished grid.
 *
 * Exists so the tests can prove the puzzle is solvable rather than trusting
 * the placement code that wrote it — the two are independent, which is the
 * only way that check means anything.
 */
export function readAt(
  grid: string[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number
): string {
  let word = ''

  for (let i = 0; i < length; i++) {
    const cy = y + dy * i
    const cx = x + dx * i

    if (cy < 0 || cy >= grid.length || cx < 0 || cx >= grid[cy].length) return ''

    word += grid[cy][cx]
  }

  return word
}
