/**
 * How panels sit on a page.
 *
 * Every comic this app made was a uniform grid, because that is what falls
 * out of "four panels per page" with nothing else said. Real comics are not
 * uniform: a page opens with a wide establishing shot, holds three narrow
 * beats through the middle, and lands on a full-width panel. The rhythm of
 * the page is part of the storytelling, and a grid throws it away.
 *
 * A layout is a list of rectangles in 0-1 space, so it works at any page size
 * and any aspect ratio. Pure, so the fitting rules can be tested without a
 * canvas.
 */

export interface PanelRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PageLayout {
  key: string
  label: string
  /** How many panels it holds. */
  panels: number
  /** Why you would choose it — shown in the picker. */
  hint: string
  rects: PanelRect[]
}

/**
 * The layouts on offer.
 *
 * Deliberately a small set. Twenty layouts is a menu nobody reads; these
 * cover the shapes that actually carry a children's comic, and each one is
 * described by what it is *for* rather than by its geometry.
 */
export const PAGE_LAYOUTS: PageLayout[] = [
  {
    key: 'splash',
    label: 'Splash',
    panels: 1,
    hint: 'One full-page image. For an opening, an ending, or a big moment.',
    rects: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    key: 'stacked-2',
    label: 'Two stacked',
    panels: 2,
    hint: 'Wide over wide. Good for before-and-after.',
    rects: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    key: 'strip-3',
    label: 'Three across',
    panels: 3,
    hint: 'A classic strip. Setup, turn, punchline.',
    rects: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    key: 'establish-3',
    label: 'Wide then two',
    panels: 3,
    hint: 'A wide establishing shot, then two beats under it.',
    rects: [
      { x: 0, y: 0, w: 1, h: 0.52 },
      { x: 0, y: 0.52, w: 0.5, h: 0.48 },
      { x: 0.5, y: 0.52, w: 0.5, h: 0.48 },
    ],
  },
  {
    key: 'grid-4',
    label: 'Four square',
    panels: 4,
    hint: 'An even 2×2. Steady pacing.',
    rects: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    key: 'feature-4',
    label: 'One big, three small',
    panels: 4,
    hint: 'A hero panel with three quick ones beside it.',
    rects: [
      { x: 0, y: 0, w: 1, h: 0.55 },
      { x: 0, y: 0.55, w: 1 / 3, h: 0.45 },
      { x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
      { x: 2 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
    ],
  },
  {
    key: 'grid-6',
    label: 'Six panel',
    panels: 6,
    hint: 'Two columns, three rows. Fits a lot of story on one page.',
    rects: [
      { x: 0, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3 },
    ],
  },
]

export function layout(key: string): PageLayout | undefined {
  return PAGE_LAYOUTS.find((entry) => entry.key === key)
}

/** The layouts that hold exactly this many panels. */
export function layoutsFor(panels: number): PageLayout[] {
  return PAGE_LAYOUTS.filter((entry) => entry.panels === panels)
}

/**
 * A sensible layout for a page that has `count` panels.
 *
 * Falls back to an even grid for counts nothing was designed for, rather than
 * refusing — a page with five panels is unusual but it is not an error, and
 * dropping the fifth would lose work.
 */
export function autoLayout(count: number): PageLayout {
  const exact = layoutsFor(count)

  if (exact.length > 0) return exact[0]

  return gridLayout(Math.max(1, Math.floor(count)))
}

/**
 * An even grid for any number of panels.
 *
 * Columns before rows, and never more than three columns — a four-across
 * panel on a portrait page is a letterbox slot too narrow to read a face in.
 */
export function gridLayout(count: number): PageLayout {
  const total = Math.max(1, Math.floor(count))
  const columns = Math.min(3, Math.ceil(Math.sqrt(total)))
  const rows = Math.ceil(total / columns)

  const rects: PanelRect[] = []

  for (let index = 0; index < total; index++) {
    const column = index % columns
    const row = Math.floor(index / columns)

    // The last row is spread across the full width when it is short, so a
    // seven-panel page does not end with a lone panel and a hole beside it.
    const inThisRow = row === rows - 1 ? total - row * columns : columns

    rects.push({
      x: column / inThisRow,
      y: row / rows,
      w: 1 / inThisRow,
      h: 1 / rows,
    })
  }

  return {
    key: `grid-${total}`,
    label: `${total} panel grid`,
    panels: total,
    hint: 'An even grid.',
    rects,
  }
}

/**
 * Turn 0-1 rectangles into pixels, with a gutter between panels.
 *
 * The gutter is taken out of each panel rather than added around it, so the
 * page keeps its outer margins and the panels never grow past the edge — the
 * mistake that puts artwork into the trim on a printed book.
 */
export function toPixels(
  rects: PanelRect[],
  width: number,
  height: number,
  gutter = 0
): PanelRect[] {
  const half = gutter / 2

  return rects.map((rect) => {
    // Only inner edges get half a gutter; the outer edge of the page does not.
    const left = rect.x <= 0.001 ? 0 : half
    const top = rect.y <= 0.001 ? 0 : half
    const right = rect.x + rect.w >= 0.999 ? 0 : half
    const bottom = rect.y + rect.h >= 0.999 ? 0 : half

    return {
      x: rect.x * width + left,
      y: rect.y * height + top,
      w: Math.max(1, rect.w * width - left - right),
      h: Math.max(1, rect.h * height - top - bottom),
    }
  })
}

/**
 * Cover-fit: the source rectangle to draw so an image fills a slot without
 * distorting.
 *
 * Comics are drawn square and pages are not, so something has to give. It
 * takes from the edges rather than squashing, because a stretched face is
 * immediately wrong in a way a slightly cropped background is not.
 */
export function coverCrop(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  if (imageWidth <= 0 || imageHeight <= 0 || slotWidth <= 0 || slotHeight <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, imageWidth), sh: Math.max(1, imageHeight) }
  }

  const imageRatio = imageWidth / imageHeight
  const slotRatio = slotWidth / slotHeight

  if (imageRatio > slotRatio) {
    // Too wide: trim the sides, keeping the middle.
    const sw = imageHeight * slotRatio

    return { sx: (imageWidth - sw) / 2, sy: 0, sw, sh: imageHeight }
  }

  // Too tall: trim top and bottom. Biased upward — faces sit in the top half
  // of a character panel far more often than in the bottom.
  const sh = imageWidth / slotRatio

  return { sx: 0, sy: (imageHeight - sh) * 0.35, sw: imageWidth, sh }
}
