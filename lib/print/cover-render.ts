'use client'

import { loadImage } from '@/lib/comic/bubbles'
import { coverLayout, checkResolution, type CoverSpec, type Rect } from '@/lib/print/kdp'

/**
 * Drawing the wrap cover a printer will accept.
 *
 * Two versions come out of the same layout, and both matter:
 *
 *   - The print file: artwork, text, nothing else. This is what gets
 *     uploaded.
 *   - The proof: the same thing with the trim line, the safe area and the
 *     barcode box drawn on top. This is what the customer looks at to see
 *     that their title is not about to be cut off, and it must never be the
 *     file they upload — which is why the guides are a flag rather than a
 *     separate code path that could drift from the real one.
 */

export const PRINT_DPI = 300

export interface CoverArt {
  /** Full-bleed artwork for the front. */
  front?: string
  /** Optional separate back artwork; the front is reused when absent. */
  back?: string
  title: string
  subtitle?: string
  author?: string
  blurb?: string
  spineText?: string
  /** Behind everything, and what shows through where artwork does not reach. */
  background?: string
  textColour?: string
}

export interface RenderOptions extends CoverSpec {
  art: CoverArt
  /** Draw the trim, safe and barcode guides. Never on the uploaded file. */
  showGuides?: boolean
}

const px = (inches: number) => inches * PRINT_DPI

function fillRect(ctx: CanvasRenderingContext2D, rect: Rect, colour: string) {
  ctx.fillStyle = colour
  ctx.fillRect(px(rect.x), px(rect.y), px(rect.width), px(rect.height))
}

/** Cover-fit an image into a rectangle, cropping rather than distorting. */
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect) {
  const x = px(rect.x)
  const y = px(rect.y)
  const w = px(rect.width)
  const h = px(rect.height)

  const scale = Math.max(w / image.width, h / image.height)
  const dw = image.width * scale
  const dh = image.height * scale

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word

    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
    else {
      lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)

  return lines
}

/** Shrink until it fits, rather than letting a long title run off the cover. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight = '800'
): number {
  let size = startSize

  do {
    ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`

    if (ctx.measureText(text).width <= maxWidth) break

    size -= 2
  } while (size > 14)

  return size
}

export async function renderCover(options: RenderOptions): Promise<{
  dataUrl: string
  layout: ReturnType<typeof coverLayout>
  resolution: ReturnType<typeof checkResolution> | null
}> {
  const layout = coverLayout(options)
  const art = options.art

  const canvas = document.createElement('canvas')

  canvas.width = Math.round(px(layout.totalWidth))
  canvas.height = Math.round(px(layout.totalHeight))

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('Canvas is not available in this browser.')

  const background = art.background || '#1e293b'
  const ink = art.textColour || '#ffffff'

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let resolution: ReturnType<typeof checkResolution> | null = null

  // ---- artwork ------------------------------------------------------------
  if (art.front) {
    try {
      const image = await loadImage(art.front)

      // Checked against the *front panel plus bleed*, which is the area it
      // actually has to cover — checking against the whole wrap would fail
      // artwork that is perfectly good for one panel.
      resolution = checkResolution(
        image.width,
        image.height,
        layout.front.width + 0.125,
        layout.front.height + 0.25
      )

      // Bled off the outer edges: the front panel plus the bleed to its right
      // and above and below it.
      drawCover(ctx, image, {
        x: layout.front.x,
        y: 0,
        width: layout.front.width + 0.125,
        height: layout.totalHeight,
      })

      const backArt = art.back ? await loadImage(art.back) : image

      drawCover(ctx, backArt, {
        x: 0,
        y: 0,
        width: layout.back.width + 0.125,
        height: layout.totalHeight,
      })
    } catch {
      // A cover with no artwork is still a valid file, and refusing to draw
      // one because an image would not load loses everything else too.
    }
  }

  // ---- front cover text ---------------------------------------------------
  const safe = layout.safe.front

  // A scrim so text stays readable over any artwork.
  const scrim = ctx.createLinearGradient(0, 0, 0, px(layout.totalHeight))

  scrim.addColorStop(0, 'rgba(0,0,0,0.62)')
  scrim.addColorStop(0.45, 'rgba(0,0,0,0)')
  scrim.addColorStop(0.72, 'rgba(0,0,0,0)')
  scrim.addColorStop(1, 'rgba(0,0,0,0.72)')

  ctx.fillStyle = scrim
  ctx.fillRect(px(layout.front.x), 0, px(layout.front.width), px(layout.totalHeight))

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  const centreX = px(safe.x + safe.width / 2)
  const titleSize = fitFont(ctx, art.title.toUpperCase(), px(safe.width), px(0.5))

  ctx.font = `800 ${titleSize}px "Segoe UI", system-ui, sans-serif`
  ctx.fillStyle = ink
  ctx.lineWidth = titleSize * 0.09
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.strokeText(art.title.toUpperCase(), centreX, px(safe.y))
  ctx.fillText(art.title.toUpperCase(), centreX, px(safe.y))

  if (art.subtitle) {
    ctx.font = `600 ${px(0.16)}px "Segoe UI", system-ui, sans-serif`
    ctx.fillStyle = ink
    ctx.fillText(art.subtitle, centreX, px(safe.y) + titleSize * 1.25)
  }

  if (art.author) {
    ctx.font = `700 ${px(0.2)}px "Segoe UI", system-ui, sans-serif`
    ctx.fillStyle = ink
    ctx.textBaseline = 'bottom'
    ctx.fillText(art.author.toUpperCase(), centreX, px(safe.y + safe.height))
    ctx.textBaseline = 'top'
  }

  // ---- back cover ---------------------------------------------------------
  if (art.blurb) {
    const backSafe = layout.safe.back

    ctx.textAlign = 'left'
    ctx.font = `500 ${px(0.14)}px "Segoe UI", system-ui, sans-serif`
    ctx.fillStyle = ink

    // Stops above the barcode area, which KDP prints over.
    const lines = wrap(ctx, art.blurb, px(backSafe.width))
    const lineHeight = px(0.2)
    const limit = px(layout.barcode.y - backSafe.y) - lineHeight

    lines.forEach((line, index) => {
      const y = index * lineHeight

      if (y > limit) return

      ctx.fillText(line, px(backSafe.x), px(backSafe.y) + y)
    })
  }

  // ---- spine --------------------------------------------------------------
  if (layout.spineTextAllowed && (art.spineText || art.title)) {
    const text = (art.spineText || art.title).toUpperCase()

    ctx.save()
    ctx.translate(px(layout.spineBox.x + layout.spineBox.width / 2), px(layout.spineBox.y + layout.spineBox.height / 2))
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Sized to the spine's *width*, which is the constraint — the length of
    // the book is generous and the thickness never is.
    const size = Math.min(px(layout.spine) * 0.55, px(0.22))

    ctx.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`
    ctx.fillStyle = ink
    ctx.fillText(text, 0, 0, px(layout.spineBox.height) * 0.9)
    ctx.restore()
  }

  // ---- proof guides -------------------------------------------------------
  if (options.showGuides) {
    const stroke = (rect: Rect, colour: string, dash: number[] = []) => {
      ctx.setLineDash(dash.map((value) => px(value)))
      ctx.strokeStyle = colour
      ctx.lineWidth = Math.max(2, px(0.01))
      ctx.strokeRect(px(rect.x), px(rect.y), px(rect.width), px(rect.height))
      ctx.setLineDash([])
    }

    stroke(layout.back, '#22d3ee')
    stroke(layout.front, '#22d3ee')
    stroke(layout.spineBox, '#a855f7')
    stroke(layout.safe.front, '#4ade80', [0.06, 0.04])
    stroke(layout.safe.back, '#4ade80', [0.06, 0.04])
    stroke(layout.barcode, '#f87171')

    ctx.setLineDash([])
    ctx.fillStyle = '#f87171'
    ctx.font = `700 ${px(0.11)}px "Segoe UI", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      'BARCODE — keep clear',
      px(layout.barcode.x + layout.barcode.width / 2),
      px(layout.barcode.y + layout.barcode.height / 2)
    )
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  return { dataUrl: canvas.toDataURL('image/png'), layout, resolution }
}
