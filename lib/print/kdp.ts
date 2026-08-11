/**
 * Print-ready covers and interiors.
 *
 * The gap this closes is the one that stops a customer selling anything: the
 * app made a picture of a cover, and a printer needs a file. A wrap cover is
 * not artwork — it is back cover, spine and front laid out at an exact width
 * that depends on how many pages the book has and what paper it is printed
 * on, with bleed past every outer edge and a barcode area kept clear.
 *
 * Get the spine wrong by a millimetre and the whole thing is rejected, so all
 * of it is arithmetic here rather than eyeballed anywhere. Everything is in
 * inches, which is the unit print is specified and checked in.
 *
 * The numbers are KDP's published ones. They are stated as constants with
 * their source in the name so that when KDP changes them there is one place
 * to look, rather than a magic 0.002252 buried in a render function.
 */

export type PaperStock = 'white' | 'cream' | 'colour-standard' | 'colour-premium'

/**
 * Thickness of one page, in inches.
 *
 * Cream stock is noticeably thicker than white, which is why a 200-page cream
 * book needs a wider spine than a 200-page white one — and why "it looked
 * right on the last book" is not a check.
 */
export const PAGE_THICKNESS: Record<PaperStock, number> = {
  white: 0.002252,
  cream: 0.0025,
  'colour-standard': 0.002252,
  'colour-premium': 0.002347,
}

export const PAPER_STOCKS: { key: PaperStock; label: string; note: string }[] = [
  { key: 'white', label: 'Black & white on white paper', note: 'The usual choice' },
  { key: 'cream', label: 'Black & white on cream paper', note: 'Warmer — novels and journals' },
  { key: 'colour-standard', label: 'Standard colour', note: 'Colouring and activity books' },
  { key: 'colour-premium', label: 'Premium colour', note: 'Picture books and comics' },
]

/** Bleed past every outer edge of a cover. */
export const BLEED = 0.125

/** Nothing important may sit within this of a trimmed edge. */
export const SAFE_MARGIN = 0.25

/** KDP will not print fewer or more than this. */
export const MIN_PAGES = 24
export const MAX_PAGES = 828

/**
 * Spine text needs a spine wide enough to hold it.
 *
 * Under a hundred pages KDP prints no spine text at all, because the trim
 * tolerance is wider than the spine. Putting a title there anyway is how a
 * book arrives with its title wrapped around onto the front.
 */
export const MIN_PAGES_FOR_SPINE_TEXT = 100

export function spineWidth(pageCount: number, stock: PaperStock = 'white'): number {
  const pages = Math.max(MIN_PAGES, Math.min(MAX_PAGES, Math.floor(pageCount)))

  return pages * (PAGE_THICKNESS[stock] ?? PAGE_THICKNESS.white)
}

export interface CoverSpec {
  /** Trim size of one page. */
  trimWidth: number
  trimHeight: number
  pageCount: number
  stock: PaperStock
}

export interface CoverLayout {
  /** The whole file, including bleed. */
  totalWidth: number
  totalHeight: number
  spine: number
  /** Rectangles in inches, measured from the top-left of the full file. */
  back: Rect
  spineBox: Rect
  front: Rect
  /** Where the barcode goes. Keep it clear — KDP prints over it. */
  barcode: Rect
  /** Inside each panel, the area nothing important may leave. */
  safe: { back: Rect; front: Rect }
  /** True when the spine is wide enough for KDP to print text on it. */
  spineTextAllowed: boolean
  warnings: string[]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** KDP's barcode area: 2 × 1.2 inches, bottom right of the back cover. */
export const BARCODE = { width: 2, height: 1.2 }

/**
 * Lay out a full wrap cover.
 *
 * Reading left to right in the finished file: back cover, spine, front cover.
 * That order surprises people — the *front* is on the right — and getting it
 * backwards prints the blurb on the front of the book.
 */
export function coverLayout(spec: CoverSpec): CoverLayout {
  const pages = Math.max(MIN_PAGES, Math.min(MAX_PAGES, Math.floor(spec.pageCount)))
  const spine = spineWidth(pages, spec.stock)

  const totalWidth = spec.trimWidth * 2 + spine + BLEED * 2
  const totalHeight = spec.trimHeight + BLEED * 2

  const back: Rect = { x: BLEED, y: BLEED, width: spec.trimWidth, height: spec.trimHeight }
  const spineBox: Rect = {
    x: BLEED + spec.trimWidth,
    y: BLEED,
    width: spine,
    height: spec.trimHeight,
  }
  const front: Rect = {
    x: BLEED + spec.trimWidth + spine,
    y: BLEED,
    width: spec.trimWidth,
    height: spec.trimHeight,
  }

  // Bottom right of the back cover, a safe margin in from the trimmed edges.
  const barcode: Rect = {
    x: back.x + back.width - SAFE_MARGIN - BARCODE.width,
    y: back.y + back.height - SAFE_MARGIN - BARCODE.height,
    width: BARCODE.width,
    height: BARCODE.height,
  }

  const inset = (rect: Rect): Rect => ({
    x: rect.x + SAFE_MARGIN,
    y: rect.y + SAFE_MARGIN,
    width: Math.max(0, rect.width - SAFE_MARGIN * 2),
    height: Math.max(0, rect.height - SAFE_MARGIN * 2),
  })

  const warnings: string[] = []

  if (spec.pageCount < MIN_PAGES) {
    warnings.push(`A printed book needs at least ${MIN_PAGES} pages — this has ${spec.pageCount}.`)
  }

  if (spec.pageCount > MAX_PAGES) {
    warnings.push(`${MAX_PAGES} pages is the most that can be bound — this has ${spec.pageCount}.`)
  }

  if (pages < MIN_PAGES_FOR_SPINE_TEXT) {
    warnings.push(
      `Under ${MIN_PAGES_FOR_SPINE_TEXT} pages the spine is too narrow to print text on, so the title is left off it.`
    )
  }

  // An odd page count is padded to even by the printer, and the extra page
  // changes the spine. Better to say so than to have the cover come back
  // fractionally narrow.
  if (pages % 2 === 1) {
    warnings.push('An odd page count is rounded up to even when printing, which widens the spine.')
  }

  return {
    totalWidth,
    totalHeight,
    spine,
    back,
    spineBox,
    front,
    barcode,
    safe: { back: inset(back), front: inset(front) },
    spineTextAllowed: pages >= MIN_PAGES_FOR_SPINE_TEXT,
    warnings,
  }
}

/**
 * Whether a supplied image is big enough for the cover it is being used for.
 *
 * 300 DPI is the floor for print. Below that the printer accepts the file and
 * the book arrives soft — which is worse than a rejection, because it is only
 * discovered after the proof copy is paid for.
 */
export function checkResolution(
  pixelWidth: number,
  pixelHeight: number,
  inchWidth: number,
  inchHeight: number
): { dpi: number; ok: boolean; message?: string } {
  if (inchWidth <= 0 || inchHeight <= 0) return { dpi: 0, ok: false, message: 'No size given' }

  // The limiting dimension decides; a file that is wide enough and short is
  // still going to be stretched.
  const dpi = Math.floor(Math.min(pixelWidth / inchWidth, pixelHeight / inchHeight))

  if (dpi >= 300) return { dpi, ok: true }

  if (dpi >= 200) {
    return {
      dpi,
      ok: false,
      message: `This artwork is ${dpi} DPI at that size. It will print, but noticeably soft — 300 is what print wants.`,
    }
  }

  return {
    dpi,
    ok: false,
    message: `This artwork is only ${dpi} DPI at that size and will look blurred in print. Use a larger image.`,
  }
}

/**
 * The number of pages a printed book will actually have.
 *
 * Printers bind in even numbers, so an odd count gets a blank added. Saying
 * so up front is the difference between a correct spine and a cover that is
 * one page too narrow.
 */
export function boundPageCount(pageCount: number): number {
  const pages = Math.max(MIN_PAGES, Math.min(MAX_PAGES, Math.ceil(pageCount)))

  return pages % 2 === 0 ? pages : pages + 1
}

/** A one-line summary for the export screen. */
export function describeCover(layout: CoverLayout, spec: CoverSpec): string {
  const round = (value: number) => value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')

  return `${round(layout.totalWidth)} × ${round(layout.totalHeight)} in including bleed · spine ${round(layout.spine)} in for ${boundPageCount(spec.pageCount)} pages`
}
