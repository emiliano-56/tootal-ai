'use client'

import type { Maze } from '@/lib/activities/maze'
import { solveMaze } from '@/lib/activities/maze'
import type { WordSearch } from '@/lib/activities/wordsearch'
import { wordCells } from '@/lib/activities/wordsearch'
import type { DotToDot } from '@/lib/activities/dots'
import { trim, contentBox, marginsFor, ruleLines, ruleSpacing } from '@/lib/activities/paper'

/**
 * Drawing activity pages onto a canvas.
 *
 * Everything here is print-first, which shows up in three decisions that look
 * fussy on a screen and matter enormously on paper:
 *
 *   - 300 DPI. A page rendered at screen resolution and sent to a printer is
 *     visibly soft, and it is the difference between a book that sells and
 *     one that gets returned.
 *   - Pure black on pure white, no grey and no anti-aliased tints. Cheap
 *     print turns light grey into a smudge or into nothing.
 *   - Line weights in inches, converted at the end. Specifying them in pixels
 *     means they change thickness whenever the resolution does.
 */

/** What print wants. Anything less is visibly soft on paper. */
export const DPI = 300

const INK = '#000000'
const PAPER = '#ffffff'

function makeCanvas(widthInches: number, heightInches: number) {
  const canvas = document.createElement('canvas')

  canvas.width = Math.round(widthInches * DPI)
  canvas.height = Math.round(heightInches * DPI)

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('Canvas is not available in this browser.')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'

  return { canvas, ctx }
}

const inches = (value: number) => value * DPI

export interface PageOptions {
  trimKey?: string
  pageNumber?: number
  pageCount?: number
  title?: string
}

/** The printable box, in pixels, honouring the binding side. */
function boxFor(options: PageOptions) {
  const size = trim(options.trimKey ?? '8.5x11')
  const margins = marginsFor(options.pageCount ?? 100)
  const box = contentBox(size.key, options.pageNumber ?? 1, margins)

  return {
    size,
    x: inches(box.x),
    y: inches(box.y),
    width: inches(box.width),
    height: inches(box.height),
  }
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  title: string | undefined,
  box: { x: number; y: number; width: number }
): number {
  if (!title?.trim()) return 0

  const fontSize = inches(0.26)

  ctx.fillStyle = INK
  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(title.trim(), box.x + box.width / 2, box.y)
  ctx.textAlign = 'left'

  return fontSize * 2
}

// ---------------------------------------------------------------------------
//  Maze
// ---------------------------------------------------------------------------

export function renderMaze(
  maze: Maze,
  options: PageOptions & { showSolution?: boolean } = {}
): string {
  const box = boxFor(options)
  const { canvas, ctx } = makeCanvas(box.size.width, box.size.height)

  const headroom = drawTitle(ctx, options.title, box)

  // Square cells: a maze on a rectangular grid of non-square cells reads as
  // stretched, and the walls no longer line up with the child's expectation.
  const available = { w: box.width, h: box.height - headroom }
  const cell = Math.min(available.w / maze.width, available.h / maze.height)

  const originX = box.x + (available.w - cell * maze.width) / 2
  const originY = box.y + headroom + (available.h - cell * maze.height) / 2

  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(2, cell * 0.09)

  ctx.beginPath()

  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const cellData = maze.cells[y][x]
      const left = originX + x * cell
      const top = originY + y * cell

      if (cellData.top) {
        ctx.moveTo(left, top)
        ctx.lineTo(left + cell, top)
      }
      if (cellData.right) {
        ctx.moveTo(left + cell, top)
        ctx.lineTo(left + cell, top + cell)
      }
      if (cellData.bottom) {
        ctx.moveTo(left, top + cell)
        ctx.lineTo(left + cell, top + cell)
      }
      if (cellData.left) {
        ctx.moveTo(left, top)
        ctx.lineTo(left, top + cell)
      }
    }
  }

  ctx.stroke()

  // Start and finish, labelled. A maze with two identical openings makes a
  // child guess which end they are meant to start at.
  ctx.fillStyle = INK
  ctx.font = `700 ${Math.max(10, cell * 0.42)}px "Segoe UI", system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText('START', originX - cell * 0.9, originY + cell / 2)
  ctx.fillText('END', originX + cell * maze.width + cell * 0.75, originY + (maze.height - 0.5) * cell)
  ctx.textAlign = 'left'

  if (options.showSolution) {
    const path = solveMaze(maze)

    ctx.strokeStyle = '#000000'
    ctx.lineWidth = Math.max(2, cell * 0.14)
    ctx.lineCap = 'round'
    ctx.setLineDash([cell * 0.22, cell * 0.22])
    ctx.beginPath()

    path.forEach((step, index) => {
      const px = originX + (step.x + 0.5) * cell
      const py = originY + (step.y + 0.5) * cell

      if (index === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })

    ctx.stroke()
    ctx.setLineDash([])
  }

  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
//  Word search
// ---------------------------------------------------------------------------

export function renderWordSearch(
  puzzle: WordSearch,
  options: PageOptions & { showSolution?: boolean } = {}
): string {
  const box = boxFor(options)
  const { canvas, ctx } = makeCanvas(box.size.width, box.size.height)

  const headroom = drawTitle(ctx, options.title, box)

  // The word list needs room, so the grid gets what is left rather than the
  // whole page — otherwise the list runs off the bottom.
  const listRows = Math.ceil(puzzle.placed.length / 3)
  const listHeight = listRows * inches(0.26) + inches(0.3)

  const available = { w: box.width, h: box.height - headroom - listHeight }
  const cell = Math.min(available.w / puzzle.size, available.h / puzzle.size)

  const originX = box.x + (available.w - cell * puzzle.size) / 2
  const originY = box.y + headroom

  if (options.showSolution) {
    // Rings behind the letters, so the answer does not obscure them.
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(2, cell * 0.07)

    for (const placed of puzzle.placed) {
      const cells = wordCells(placed)
      const first = cells[0]
      const last = cells[cells.length - 1]

      ctx.beginPath()
      ctx.moveTo(originX + (first.x + 0.5) * cell, originY + (first.y + 0.5) * cell)
      ctx.lineTo(originX + (last.x + 0.5) * cell, originY + (last.y + 0.5) * cell)
      ctx.stroke()
    }
  }

  ctx.fillStyle = INK
  ctx.font = `600 ${cell * 0.6}px "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let y = 0; y < puzzle.size; y++) {
    for (let x = 0; x < puzzle.size; x++) {
      ctx.fillText(puzzle.grid[y][x], originX + (x + 0.5) * cell, originY + (y + 0.5) * cell)
    }
  }

  // The words to find, in three columns.
  const listTop = originY + cell * puzzle.size + inches(0.28)

  ctx.font = `600 ${inches(0.17)}px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  puzzle.placed.forEach((placed, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)

    ctx.fillText(placed.word, box.x + column * (box.width / 3), listTop + row * inches(0.26))
  })

  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
//  Dot to dot
// ---------------------------------------------------------------------------

export function renderDotToDot(
  puzzle: DotToDot,
  options: PageOptions & { showSolution?: boolean } = {}
): string {
  const box = boxFor(options)
  const { canvas, ctx } = makeCanvas(box.size.width, box.size.height)

  const headroom = drawTitle(ctx, options.title, box)

  // The shape is in 0-1 space; fitting it to a square keeps its proportions.
  const side = Math.min(box.width, box.height - headroom)
  const originX = box.x + (box.width - side) / 2
  const originY = box.y + headroom + (box.height - headroom - side) / 2

  const at = (point: { x: number; y: number }) => ({
    x: originX + point.x * side,
    y: originY + point.y * side,
  })

  if (options.showSolution) {
    ctx.strokeStyle = INK
    ctx.lineWidth = inches(0.014)
    ctx.beginPath()

    puzzle.dots.forEach((dot, index) => {
      const point = at(dot)

      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })

    if (puzzle.closed) ctx.closePath()
    ctx.stroke()
  }

  const radius = inches(0.028)

  ctx.fillStyle = INK
  ctx.font = `700 ${inches(0.15)}px "Segoe UI", system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  puzzle.dots.forEach((dot, index) => {
    const point = at(dot)

    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()

    // The number sits away from the shape's centre, so it never lands on the
    // line the child is about to draw.
    const away = Math.atan2(dot.y - 0.5, dot.x - 0.5)

    ctx.fillText(
      String(index + 1),
      point.x + Math.cos(away) * radius * 3.2,
      point.y + Math.sin(away) * radius * 3.2
    )
  })

  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
//  Journal and planner interiors
// ---------------------------------------------------------------------------

export function renderPaper(
  kind: string,
  options: PageOptions & { spacing?: string } = {}
): string {
  const box = boxFor(options)
  const { canvas, ctx } = makeCanvas(box.size.width, box.size.height)

  const headroom = drawTitle(ctx, options.title, box)
  const top = box.y + headroom
  const height = box.height - headroom

  ctx.strokeStyle = INK
  ctx.fillStyle = INK

  const rule = (y: number, weight = 0.006, from = box.x, to = box.x + box.width) => {
    ctx.lineWidth = inches(weight)
    ctx.beginPath()
    ctx.moveTo(from, y)
    ctx.lineTo(to, y)
    ctx.stroke()
  }

  const gap = inches(ruleSpacing(options.spacing ?? 'normal'))

  switch (kind) {
    case 'blank':
      break

    case 'lined':
      for (const y of ruleLines(height / DPI, gap / DPI)) rule(top + inches(y))
      break

    case 'lined-header': {
      // A title rule and a date box, then the writing lines under them.
      ctx.font = `600 ${inches(0.13)}px "Segoe UI", system-ui, sans-serif`
      ctx.textBaseline = 'bottom'
      ctx.fillText('Date', box.x + box.width - inches(1.5), top + inches(0.28))

      rule(top + inches(0.34), 0.008)
      rule(top + inches(0.34), 0.008, box.x + box.width - inches(1.2))

      for (const y of ruleLines(height / DPI - 0.7, gap / DPI, 0.1)) {
        rule(top + inches(0.7) + inches(y))
      }
      break
    }

    case 'graph': {
      const step = inches(0.25)

      ctx.lineWidth = inches(0.004)
      ctx.beginPath()

      for (let x = box.x; x <= box.x + box.width; x += step) {
        ctx.moveTo(x, top)
        ctx.lineTo(x, top + height)
      }
      for (let y = top; y <= top + height; y += step) {
        ctx.moveTo(box.x, y)
        ctx.lineTo(box.x + box.width, y)
      }

      ctx.stroke()
      break
    }

    case 'dot-grid': {
      const step = inches(0.2)
      const radius = inches(0.008)

      for (let x = box.x; x <= box.x + box.width; x += step) {
        for (let y = top; y <= top + height; y += step) {
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }

    case 'half-drawing': {
      // A box to draw in, lines to write on underneath — the standard shape of
      // a school exercise book, and a strong seller as a KDP interior.
      const boxHeight = height * 0.55

      ctx.lineWidth = inches(0.01)
      ctx.strokeRect(box.x, top, box.width, boxHeight)

      for (const y of ruleLines(height / DPI - boxHeight / DPI - 0.2, gap / DPI)) {
        rule(top + boxHeight + inches(0.2) + inches(y))
      }
      break
    }

    case 'handwriting': {
      // Four-line rules: a solid baseline, a dashed midline to aim lowercase
      // at, and a lighter top and bottom.
      const band = inches(0.5)

      for (let y = top + band; y < top + height; y += band * 1.5) {
        rule(y - band * 0.55, 0.004)

        ctx.setLineDash([inches(0.05), inches(0.05)])
        rule(y - band * 0.28, 0.004)
        ctx.setLineDash([])

        rule(y, 0.008)
      }
      break
    }

    case 'weekly': {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const rowHeight = height / days.length

      ctx.font = `700 ${inches(0.15)}px "Segoe UI", system-ui, sans-serif`
      ctx.textBaseline = 'top'

      days.forEach((day, index) => {
        const y = top + index * rowHeight

        rule(y, 0.008)
        ctx.fillText(day, box.x + inches(0.06), y + inches(0.06))

        // Two faint writing lines inside each day.
        rule(y + rowHeight * 0.45, 0.004)
        rule(y + rowHeight * 0.75, 0.004)
      })

      rule(top + height, 0.008)
      break
    }

    case 'daily': {
      ctx.font = `600 ${inches(0.13)}px "Segoe UI", system-ui, sans-serif`
      ctx.textBaseline = 'middle'

      const hours = 14
      const listTop = top + height * 0.22
      const rowHeight = (height - (listTop - top)) / hours

      // Priorities box at the top.
      ctx.lineWidth = inches(0.008)
      ctx.strokeRect(box.x, top, box.width, height * 0.18)
      ctx.font = `700 ${inches(0.14)}px "Segoe UI", system-ui, sans-serif`
      ctx.fillText("Today's priorities", box.x + inches(0.08), top + inches(0.16))

      ctx.font = `600 ${inches(0.12)}px "Segoe UI", system-ui, sans-serif`

      for (let i = 0; i < hours; i++) {
        const y = listTop + i * rowHeight

        rule(y, 0.004, box.x + inches(0.7))
        ctx.fillText(`${7 + i}:00`, box.x, y)
      }
      break
    }

    case 'habit': {
      const rows = 12
      const columns = 31
      const labelWidth = box.width * 0.3
      const gridWidth = box.width - labelWidth
      const rowHeight = height / (rows + 1)
      const columnWidth = gridWidth / columns

      ctx.lineWidth = inches(0.004)
      ctx.font = `600 ${inches(0.08)}px "Segoe UI", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let day = 0; day < columns; day++) {
        ctx.fillText(
          String(day + 1),
          box.x + labelWidth + (day + 0.5) * columnWidth,
          top + rowHeight * 0.5
        )
      }

      ctx.beginPath()

      for (let row = 0; row <= rows; row++) {
        const y = top + rowHeight * (row + 1)

        ctx.moveTo(box.x, y)
        ctx.lineTo(box.x + box.width, y)
      }
      for (let column = 0; column <= columns; column++) {
        const x = box.x + labelWidth + column * columnWidth

        ctx.moveTo(x, top + rowHeight)
        ctx.lineTo(x, top + height)
      }

      ctx.moveTo(box.x, top + rowHeight)
      ctx.lineTo(box.x, top + height)
      ctx.stroke()
      ctx.textAlign = 'left'
      break
    }

    case 'todo': {
      const size = inches(0.16)
      const step = inches(0.38)

      ctx.lineWidth = inches(0.006)

      for (let y = top + inches(0.2); y < top + height - step; y += step) {
        ctx.strokeRect(box.x, y - size / 2, size, size)
        rule(y + size * 0.7, 0.004, box.x + size * 1.6)
      }
      break
    }

    default:
      for (const y of ruleLines(height / DPI, gap / DPI)) rule(top + inches(y))
  }

  return canvas.toDataURL('image/png')
}
