/**
 * Interior pages for journals, planners and notebooks.
 *
 * Low-content books — lined journals, habit trackers, weekly planners — are a
 * large part of what this audience actually sells, and they need no AI at all.
 * A page is a handful of rules and a grid, described here and drawn by the
 * renderer, so a hundred-page notebook costs nothing and takes a second.
 *
 * Everything is in inches, because that is the unit print is specified in:
 * a 6×9 book with a 0.5" margin is a sentence a customer can check against
 * their KDP dashboard, and 1800×2700 pixels is not.
 */

export interface PaperSpec {
  key: string
  label: string
  description: string
  /** Which family it belongs to, for grouping in the picker. */
  group: 'Writing' | 'Planning' | 'Drawing'
}

export const PAPER_TYPES: PaperSpec[] = [
  {
    key: 'lined',
    label: 'Lined',
    description: 'Ruled lines. The default notebook page.',
    group: 'Writing',
  },
  {
    key: 'lined-header',
    label: 'Lined with header',
    description: 'A title line and a date box above the rules.',
    group: 'Writing',
  },
  {
    key: 'dot-grid',
    label: 'Dot grid',
    description: 'Dots instead of lines. What bullet journals use.',
    group: 'Writing',
  },
  {
    key: 'graph',
    label: 'Graph',
    description: 'A full squared grid.',
    group: 'Writing',
  },
  {
    key: 'blank',
    label: 'Blank',
    description: 'Nothing at all, with the margins still right for print.',
    group: 'Drawing',
  },
  {
    key: 'half-drawing',
    label: 'Draw and write',
    description: 'A box to draw in on top, lines to write on underneath.',
    group: 'Drawing',
  },
  {
    key: 'handwriting',
    label: 'Handwriting practice',
    description: 'Four-line rules with a dashed middle, for learning letters.',
    group: 'Writing',
  },
  {
    key: 'weekly',
    label: 'Weekly planner',
    description: 'Seven days down the page with room to write.',
    group: 'Planning',
  },
  {
    key: 'daily',
    label: 'Daily planner',
    description: 'Hourly slots with a priorities box.',
    group: 'Planning',
  },
  {
    key: 'habit',
    label: 'Habit tracker',
    description: 'A month of ticks across a list of habits.',
    group: 'Planning',
  },
  {
    key: 'todo',
    label: 'To-do list',
    description: 'Checkboxes with room for notes.',
    group: 'Planning',
  },
]

export function paper(key: string): PaperSpec | undefined {
  return PAPER_TYPES.find((entry) => entry.key === key)
}

/** The trim sizes KDP actually sells, in inches. */
export const TRIM_SIZES = [
  { key: '6x9', label: '6 × 9 in', width: 6, height: 9, note: 'The most common book size' },
  { key: '5x8', label: '5 × 8 in', width: 5, height: 8, note: 'Compact' },
  { key: '5.5x8.5', label: '5.5 × 8.5 in', width: 5.5, height: 8.5, note: 'Digest' },
  { key: '7x10', label: '7 × 10 in', width: 7, height: 10, note: 'Workbooks' },
  { key: '8x10', label: '8 × 10 in', width: 8, height: 10, note: 'Activity books' },
  { key: '8.5x11', label: '8.5 × 11 in', width: 8.5, height: 11, note: 'Letter — colouring books' },
] as const

export function trim(key: string) {
  return TRIM_SIZES.find((entry) => entry.key === key) ?? TRIM_SIZES[0]
}

/**
 * The margin a printed page needs.
 *
 * The inner margin has to grow with the page count because a thick book
 * curves into its spine and swallows the inside edge — text set to the same
 * margin as a thin book disappears into the gutter. These are KDP's own
 * minimums, rounded up: getting this wrong is the single most common reason a
 * manuscript is rejected.
 */
export function gutterFor(pageCount: number): number {
  const pages = Math.max(24, Math.floor(pageCount))

  if (pages <= 150) return 0.375
  if (pages <= 300) return 0.5
  if (pages <= 500) return 0.625
  if (pages <= 700) return 0.75

  return 0.875
}

export interface PageMargins {
  /** All in inches. */
  top: number
  bottom: number
  outer: number
  inner: number
}

export function marginsFor(pageCount: number, outer = 0.375): PageMargins {
  return {
    top: 0.5,
    bottom: 0.5,
    outer: Math.max(0.25, outer),
    inner: gutterFor(pageCount),
  }
}

/**
 * The area a page may actually print in.
 *
 * Which side the gutter falls on alternates: on a right-hand page the binding
 * is at the left, and on a left-hand page it is at the right. Getting this
 * backwards puts every second page's text into the spine, and it looks
 * perfectly fine on screen.
 */
export function contentBox(
  trimKey: string,
  pageNumber: number,
  margins: PageMargins
): { x: number; y: number; width: number; height: number } {
  const size = trim(trimKey)
  const rightHandPage = pageNumber % 2 === 1

  const left = rightHandPage ? margins.inner : margins.outer
  const right = rightHandPage ? margins.outer : margins.inner

  return {
    x: left,
    y: margins.top,
    width: Math.max(0.5, size.width - left - right),
    height: Math.max(0.5, size.height - margins.top - margins.bottom),
  }
}

/**
 * How many ruled lines fit, and where.
 *
 * Returned as positions rather than drawn, so the same maths serves the
 * renderer, the PDF export and the tests.
 */
export function ruleLines(
  height: number,
  spacing: number,
  offset = 0
): number[] {
  const gap = Math.max(0.12, spacing)
  const lines: number[] = []

  for (let y = offset + gap; y <= height - 0.05; y += gap) lines.push(Number(y.toFixed(4)))

  return lines
}

/** Line spacing by who is writing on it. */
export const RULE_SPACINGS = [
  { key: 'wide', label: 'Wide (children)', inches: 0.4 },
  { key: 'normal', label: 'Normal', inches: 0.28 },
  { key: 'narrow', label: 'Narrow', inches: 0.22 },
] as const

export function ruleSpacing(key: string): number {
  return RULE_SPACINGS.find((entry) => entry.key === key)?.inches ?? 0.28
}
