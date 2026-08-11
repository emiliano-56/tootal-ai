import { describe, it, expect } from 'vitest'
import {
  FORMATS,
  format,
  clampPages,
  stripLayout,
  stripShape,
  STRIP_SHAPES,
} from '@/lib/comic/formats'
import { MERCH_PRODUCTS, merchProduct } from '@/lib/mockup/merch'

describe('output formats', () => {
  it('falls back to a comic for anything unknown', () => {
    // Every run made before formats existed was a comic, so that is the only
    // safe default.
    expect(format(undefined).key).toBe('comic')
    expect(format('novella').key).toBe('comic')
    expect(format('storybook').key).toBe('storybook')
  })

  it('leaves the comic brief empty so nothing changes for existing runs', () => {
    expect(format('comic').brief).toBe('')
  })

  it('gives a storybook one picture per page', () => {
    // A picture book is one illustration per page by definition; panels would
    // make it a comic again.
    expect(format('storybook').panelsPerPage).toBe(1)
    expect(format('storybook').lettering).toBe('caption-below')
  })

  it('letters a strip into the art but a storybook under it', () => {
    // Setting a storybook's words under the picture *and* lettering them in
    // would print the same sentence twice.
    expect(format('strip').lettering).toBe('bubbles')
    expect(format('comic').lettering).toBe('bubbles')
  })

  it('opens a storybook wide rather than square', () => {
    expect(format('storybook').aspectRatio).not.toBe('1:1')
  })

  it('describes every format and keeps its page range sane', () => {
    for (const spec of FORMATS) {
      expect(spec.label.length, spec.key).toBeGreaterThan(0)
      expect(spec.description.length, spec.key).toBeGreaterThan(0)
      expect(spec.minPages, spec.key).toBeGreaterThan(0)
      expect(spec.maxPages, spec.key).toBeGreaterThanOrEqual(spec.minPages)
      expect(spec.defaultPages, spec.key).toBeGreaterThanOrEqual(spec.minPages)
      expect(spec.defaultPages, spec.key).toBeLessThanOrEqual(spec.maxPages)
      expect(spec.panelsPerPage, spec.key).toBeGreaterThan(0)
    }
  })
})

describe('clamping the page count to the format', () => {
  it('keeps a sensible number', () => {
    expect(clampPages(format('comic'), 5)).toBe(5)
  })

  it('pulls an out-of-range number back', () => {
    const storybook = format('storybook')

    expect(clampPages(storybook, 1)).toBe(storybook.minPages)
    expect(clampPages(storybook, 900)).toBe(storybook.maxPages)
  })

  it('falls back to the default for nonsense', () => {
    const comic = format('comic')

    expect(clampPages(comic, Number.NaN)).toBe(comic.defaultPages)
  })
})

describe('social strips', () => {
  it('stacks panels down the canvas, never across', () => {
    // Three across on a portrait canvas gives panels too narrow to read, and
    // vertical is how a phone is held anyway.
    const rects = stripLayout(3)

    expect(rects).toHaveLength(3)
    for (const rect of rects) expect(rect.w).toBe(1)
    expect(rects[0].y).toBeLessThan(rects[1].y)
    expect(rects[1].y).toBeLessThan(rects[2].y)
  })

  it('leaves a gutter between panels and none outside them', () => {
    const rects = stripLayout(3, 0.02)

    expect(rects[0].y).toBe(0)
    expect(rects[2].y + rects[2].h).toBeCloseTo(1, 6)

    const gap = rects[1].y - (rects[0].y + rects[0].h)

    expect(gap).toBeCloseTo(0.02, 6)
  })

  it('fills the canvas with no gutter at all', () => {
    const rects = stripLayout(4, 0)
    const total = rects.reduce((sum, rect) => sum + rect.h, 0)

    expect(total).toBeCloseTo(1, 6)
  })

  it('refuses a degenerate panel count rather than dividing by zero', () => {
    expect(stripLayout(0)).toHaveLength(1)
    expect(stripLayout(-3)).toHaveLength(1)
    expect(stripLayout(99).length).toBeLessThanOrEqual(6)
  })

  it('offers a shape for every feed and defaults to the safe one', () => {
    expect(stripShape('nonsense').key).toBe('square')

    for (const shape of STRIP_SHAPES) {
      expect(shape.width, shape.key).toBeGreaterThan(0)
      expect(shape.height, shape.key).toBeGreaterThan(0)
    }
  })
})

describe('merch products', () => {
  it('describes every product and gives it a starting colour', () => {
    for (const entry of MERCH_PRODUCTS) {
      expect(entry.label.length, entry.key).toBeGreaterThan(0)
      expect(entry.hint.length, entry.key).toBeGreaterThan(0)
      expect(entry.colour, entry.key).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('finds one by key and returns nothing for a name it does not have', () => {
    expect(merchProduct('mug')?.label).toBe('Mug')
    expect(merchProduct('hovercraft')).toBeUndefined()
  })
})
