import { describe, it, expect } from 'vitest'
import {
  spineWidth,
  coverLayout,
  checkResolution,
  boundPageCount,
  describeCover,
  PAGE_THICKNESS,
  PAPER_STOCKS,
  BLEED,
  SAFE_MARGIN,
  BARCODE,
  MIN_PAGES,
  MAX_PAGES,
  MIN_PAGES_FOR_SPINE_TEXT,
  type CoverSpec,
} from '@/lib/print/kdp'

const spec = (over: Partial<CoverSpec> = {}): CoverSpec => ({
  trimWidth: 6,
  trimHeight: 9,
  pageCount: 120,
  stock: 'white',
  ...over,
})

describe('spine width', () => {
  it('is the page count times the paper thickness', () => {
    // The number KDP publishes. A millimetre out and the file is rejected.
    expect(spineWidth(100, 'white')).toBeCloseTo(0.2252, 6)
    expect(spineWidth(200, 'cream')).toBeCloseTo(0.5, 6)
  })

  it('makes cream thicker than white for the same page count', () => {
    // "It looked right on the last book" is not a check — the stock changes
    // the answer.
    expect(spineWidth(200, 'cream')).toBeGreaterThan(spineWidth(200, 'white'))
  })

  it('clamps a page count no printer would bind', () => {
    expect(spineWidth(2)).toBe(spineWidth(MIN_PAGES))
    expect(spineWidth(9999)).toBe(spineWidth(MAX_PAGES))
  })

  it('has a thickness for every stock offered', () => {
    for (const stock of PAPER_STOCKS) {
      expect(PAGE_THICKNESS[stock.key], stock.key).toBeGreaterThan(0)
      expect(stock.note.length, stock.key).toBeGreaterThan(0)
    }
  })

  it('falls back rather than producing a zero-width spine', () => {
    expect(spineWidth(100, 'glossy' as never)).toBeGreaterThan(0)
  })
})

describe('the wrap cover', () => {
  it('is back, spine and front across, plus bleed both sides', () => {
    const layout = coverLayout(spec())

    expect(layout.totalWidth).toBeCloseTo(6 + 6 + layout.spine + BLEED * 2, 6)
    expect(layout.totalHeight).toBeCloseTo(9 + BLEED * 2, 6)
  })

  it('puts the front cover on the RIGHT', () => {
    // This surprises people, and getting it backwards prints the blurb on the
    // front of the book.
    const layout = coverLayout(spec())

    expect(layout.back.x).toBeLessThan(layout.spineBox.x)
    expect(layout.spineBox.x).toBeLessThan(layout.front.x)
  })

  it('leaves no gap or overlap between the three panels', () => {
    const layout = coverLayout(spec())

    expect(layout.back.x + layout.back.width).toBeCloseTo(layout.spineBox.x, 9)
    expect(layout.spineBox.x + layout.spineBox.width).toBeCloseTo(layout.front.x, 9)
    expect(layout.front.x + layout.front.width).toBeCloseTo(layout.totalWidth - BLEED, 9)
  })

  it('keeps every panel inside the file', () => {
    for (const pages of [24, 100, 400, 828]) {
      const layout = coverLayout(spec({ pageCount: pages }))

      for (const [name, rect] of Object.entries({
        back: layout.back,
        spine: layout.spineBox,
        front: layout.front,
        barcode: layout.barcode,
      })) {
        expect(rect.x, `${name} @ ${pages}`).toBeGreaterThanOrEqual(0)
        expect(rect.y, `${name} @ ${pages}`).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width, `${name} @ ${pages}`).toBeLessThanOrEqual(layout.totalWidth + 1e-9)
        expect(rect.y + rect.height, `${name} @ ${pages}`).toBeLessThanOrEqual(
          layout.totalHeight + 1e-9
        )
      }
    }
  })

  it('puts the barcode bottom-right of the BACK cover, inside the safe margin', () => {
    // KDP prints its own barcode over this area. Artwork left underneath is
    // artwork the customer paid to have covered up.
    const layout = coverLayout(spec())

    expect(layout.barcode.width).toBe(BARCODE.width)
    expect(layout.barcode.height).toBe(BARCODE.height)

    // Within the back panel.
    expect(layout.barcode.x).toBeGreaterThanOrEqual(layout.back.x)
    expect(layout.barcode.x + layout.barcode.width).toBeLessThanOrEqual(
      layout.back.x + layout.back.width
    )
    // A safe margin off the trimmed edges.
    expect(layout.back.x + layout.back.width - (layout.barcode.x + layout.barcode.width)).toBeCloseTo(
      SAFE_MARGIN,
      9
    )
  })

  it('insets the safe area on every side', () => {
    const layout = coverLayout(spec())

    expect(layout.safe.front.x).toBeCloseTo(layout.front.x + SAFE_MARGIN, 9)
    expect(layout.safe.front.width).toBeCloseTo(layout.front.width - SAFE_MARGIN * 2, 9)
    expect(layout.safe.back.y).toBeCloseTo(layout.back.y + SAFE_MARGIN, 9)
  })

  it('never returns a negative safe area on a tiny trim', () => {
    const layout = coverLayout(spec({ trimWidth: 0.3, trimHeight: 0.3 }))

    expect(layout.safe.front.width).toBeGreaterThanOrEqual(0)
    expect(layout.safe.front.height).toBeGreaterThanOrEqual(0)
  })

  it('refuses spine text on a book too thin to print it', () => {
    // Under a hundred pages KDP prints none, and putting a title there gets a
    // book whose title wraps onto the front.
    expect(coverLayout(spec({ pageCount: MIN_PAGES_FOR_SPINE_TEXT - 1 })).spineTextAllowed).toBe(
      false
    )
    expect(coverLayout(spec({ pageCount: MIN_PAGES_FOR_SPINE_TEXT })).spineTextAllowed).toBe(true)
  })

  it('warns about a page count no printer will take', () => {
    expect(coverLayout(spec({ pageCount: 10 })).warnings.join(' ')).toContain('at least')
    expect(coverLayout(spec({ pageCount: 2000 })).warnings.join(' ')).toContain('most')
  })

  it('warns that an odd page count widens the spine', () => {
    // The printer adds a blank page, and the cover comes back fractionally
    // narrow if nobody accounted for it.
    expect(coverLayout(spec({ pageCount: 121 })).warnings.join(' ')).toContain('odd page count')
    expect(coverLayout(spec({ pageCount: 120 })).warnings.join(' ')).not.toContain('odd page count')
  })

  it('grows the file as the book gets thicker', () => {
    const thin = coverLayout(spec({ pageCount: 50 }))
    const thick = coverLayout(spec({ pageCount: 500 }))

    expect(thick.totalWidth).toBeGreaterThan(thin.totalWidth)
    expect(thick.totalHeight).toBe(thin.totalHeight)
  })
})

describe('binding rounds up', () => {
  it('adds a blank page to an odd count', () => {
    expect(boundPageCount(121)).toBe(122)
    expect(boundPageCount(120)).toBe(120)
  })

  it('respects the printable range', () => {
    expect(boundPageCount(3)).toBe(MIN_PAGES)
    expect(boundPageCount(99999)).toBeLessThanOrEqual(MAX_PAGES + 1)
  })
})

describe('checking artwork resolution', () => {
  it('passes artwork at 300 DPI or better', () => {
    expect(checkResolution(1800, 2700, 6, 9)).toEqual({ dpi: 300, ok: true })
    expect(checkResolution(3600, 5400, 6, 9).ok).toBe(true)
  })

  it('warns rather than passing at 200-299', () => {
    // It prints, and the book arrives soft — worse than a rejection, because
    // it is found after a proof copy has been paid for.
    const check = checkResolution(1500, 2250, 6, 9)

    expect(check.ok).toBe(false)
    expect(check.message).toContain('soft')
  })

  it('calls anything under 200 blurred', () => {
    expect(checkResolution(600, 900, 6, 9).message).toContain('blurred')
  })

  it('judges by the limiting dimension, not the generous one', () => {
    // Wide enough and too short still gets stretched.
    expect(checkResolution(6000, 900, 6, 9).dpi).toBe(100)
  })

  it('survives being given no size', () => {
    expect(checkResolution(1000, 1000, 0, 0).ok).toBe(false)
  })
})

describe('the summary line', () => {
  it('states the file size and what the spine is for', () => {
    const layout = coverLayout(spec({ pageCount: 120 }))
    const text = describeCover(layout, spec({ pageCount: 120 }))

    expect(text).toContain('spine')
    expect(text).toContain('120 pages')
    expect(text).toContain('bleed')
  })
})
