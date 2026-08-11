'use client'

import { loadImage } from '@/lib/comic/bubbles'

/**
 * Putting artwork onto products, for listing photos.
 *
 * A customer who has made a comic wants to sell a t-shirt of it, and the
 * thing standing between them and a listing is a photograph they cannot take.
 * These are drawn rather than photographed — flat, clean product shots on
 * plain backgrounds, which is what a marketplace listing wants anyway.
 *
 * Nothing here calls a model. It is canvas, so it is instant, free, and the
 * same every time — and a customer can try their art on six products in the
 * time one generation would take.
 */

export interface MerchOptions {
  /** The artwork. Data URL or a CORS-readable URL. */
  artwork: string
  /** Product colour behind the art. */
  colour?: string
  background?: string
  /** Rendered size. 1600 is enough for a marketplace listing. */
  size?: number
}

export interface MerchProduct {
  key: string
  label: string
  hint: string
  /** Sensible default garment or product colour. */
  colour: string
}

export const MERCH_PRODUCTS: MerchProduct[] = [
  { key: 'tshirt', label: 'T-shirt', hint: 'Front print, centred on the chest', colour: '#1e293b' },
  { key: 'tote', label: 'Tote bag', hint: 'Natural canvas with a square print', colour: '#e7dfd0' },
  { key: 'mug', label: 'Mug', hint: 'Wrap print on a white mug', colour: '#ffffff' },
  { key: 'poster', label: 'Framed poster', hint: 'On a wall, in a thin frame', colour: '#f5f5f4' },
  { key: 'phone', label: 'Phone case', hint: 'Full-bleed on the back of a phone', colour: '#111827' },
  { key: 'cushion', label: 'Cushion', hint: 'Square print on a soft cushion', colour: '#f1f5f9' },
]

export function merchProduct(key: string): MerchProduct | undefined {
  return MERCH_PRODUCTS.find((entry) => entry.key === key)
}

function makeCanvas(size: number, background: string) {
  const canvas = document.createElement('canvas')

  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('Canvas is not available in this browser.')

  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)

  return { canvas, ctx }
}

/** Rounded rectangle path, used by most of the products below. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Draw artwork into a box without distorting it.
 *
 * Contain rather than cover: a print is a fixed thing the customer designed,
 * and cropping the top off a character to fill a rectangle is worse than
 * leaving a margin.
 */
function drawContained(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.min(w / image.width, h / image.height)
  const dw = image.width * scale
  const dh = image.height * scale

  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/** A soft shadow under a product, so it sits on the surface rather than floating. */
function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry))

  gradient.addColorStop(0, 'rgba(15,23,42,0.20)')
  gradient.addColorStop(1, 'rgba(15,23,42,0)')

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export async function renderMerch(product: string, options: MerchOptions): Promise<string> {
  const size = options.size ?? 1600
  const background = options.background ?? '#f8fafc'
  const colour = options.colour ?? merchProduct(product)?.colour ?? '#1e293b'

  const image = await loadImage(options.artwork)
  const { canvas, ctx } = makeCanvas(size, background)

  const u = size / 100

  switch (product) {
    case 'tote': {
      shadow(ctx, size / 2, size * 0.9, size * 0.32, size * 0.05)

      const bagW = size * 0.56
      const bagH = size * 0.62
      const bagX = (size - bagW) / 2
      const bagY = size * 0.24

      // Handles first, so the bag body overlaps where they meet it.
      ctx.strokeStyle = colour
      ctx.lineWidth = u * 2.2
      ctx.beginPath()
      ctx.arc(size / 2, bagY, bagW * 0.28, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()

      ctx.fillStyle = colour
      roundRect(ctx, bagX, bagY, bagW, bagH, u * 1.5)
      ctx.fill()

      drawContained(ctx, image, bagX + bagW * 0.14, bagY + bagH * 0.16, bagW * 0.72, bagH * 0.64)
      break
    }

    case 'mug': {
      shadow(ctx, size / 2, size * 0.82, size * 0.26, size * 0.045)

      const bodyW = size * 0.44
      const bodyH = size * 0.44
      const bodyX = (size - bodyW) / 2 - size * 0.03
      const bodyY = size * 0.3

      // Handle, drawn behind the body.
      ctx.strokeStyle = colour
      ctx.lineWidth = u * 4
      ctx.beginPath()
      ctx.arc(bodyX + bodyW + u * 4, bodyY + bodyH / 2, bodyH * 0.24, Math.PI * 1.5, Math.PI * 0.5)
      ctx.stroke()

      ctx.fillStyle = colour
      roundRect(ctx, bodyX, bodyY, bodyW, bodyH, u * 3)
      ctx.fill()
      ctx.strokeStyle = 'rgba(15,23,42,0.12)'
      ctx.lineWidth = u * 0.4
      ctx.stroke()

      // The rim, which is what makes it read as a mug rather than a box.
      ctx.fillStyle = 'rgba(15,23,42,0.06)'
      ctx.beginPath()
      ctx.ellipse(bodyX + bodyW / 2, bodyY, bodyW / 2, u * 2.2, 0, 0, Math.PI * 2)
      ctx.fill()

      drawContained(ctx, image, bodyX + bodyW * 0.12, bodyY + bodyH * 0.18, bodyW * 0.76, bodyH * 0.64)
      break
    }

    case 'poster': {
      const frameW = size * 0.56
      const frameH = size * 0.7
      const frameX = (size - frameW) / 2
      const frameY = (size - frameH) / 2

      ctx.save()
      ctx.shadowColor = 'rgba(15,23,42,0.22)'
      ctx.shadowBlur = u * 5
      ctx.shadowOffsetY = u * 2
      ctx.fillStyle = '#27272a'
      ctx.fillRect(frameX, frameY, frameW, frameH)
      ctx.restore()

      const mat = u * 4

      ctx.fillStyle = colour
      ctx.fillRect(frameX + mat, frameY + mat, frameW - mat * 2, frameH - mat * 2)

      drawContained(
        ctx,
        image,
        frameX + mat * 2.4,
        frameY + mat * 2.4,
        frameW - mat * 4.8,
        frameH - mat * 4.8
      )
      break
    }

    case 'phone': {
      shadow(ctx, size / 2, size * 0.88, size * 0.2, size * 0.035)

      const phoneW = size * 0.36
      const phoneH = size * 0.72
      const phoneX = (size - phoneW) / 2
      const phoneY = (size - phoneH) / 2

      ctx.fillStyle = colour
      roundRect(ctx, phoneX, phoneY, phoneW, phoneH, u * 6)
      ctx.fill()

      // Full-bleed art, clipped to the case so it takes the rounded corners.
      ctx.save()
      roundRect(ctx, phoneX, phoneY, phoneW, phoneH, u * 6)
      ctx.clip()

      const scale = Math.max(phoneW / image.width, phoneH / image.height)

      ctx.drawImage(
        image,
        phoneX + (phoneW - image.width * scale) / 2,
        phoneY + (phoneH - image.height * scale) / 2,
        image.width * scale,
        image.height * scale
      )
      ctx.restore()

      // Camera bump, which is most of what makes it read as a phone.
      ctx.fillStyle = 'rgba(15,23,42,0.55)'
      roundRect(ctx, phoneX + phoneW * 0.08, phoneY + phoneH * 0.05, phoneW * 0.26, phoneW * 0.26, u * 3)
      ctx.fill()
      break
    }

    case 'cushion': {
      shadow(ctx, size / 2, size * 0.85, size * 0.3, size * 0.04)

      const side = size * 0.56
      const x = (size - side) / 2
      const y = (size - side) / 2

      ctx.fillStyle = colour
      roundRect(ctx, x, y, side, side, side * 0.14)
      ctx.fill()
      ctx.strokeStyle = 'rgba(15,23,42,0.10)'
      ctx.lineWidth = u * 0.5
      ctx.stroke()

      drawContained(ctx, image, x + side * 0.12, y + side * 0.12, side * 0.76, side * 0.76)
      break
    }

    case 'tshirt':
    default: {
      shadow(ctx, size / 2, size * 0.9, size * 0.34, size * 0.045)

      const bodyW = size * 0.52
      const bodyH = size * 0.6
      const bodyX = (size - bodyW) / 2
      const bodyY = size * 0.26

      ctx.fillStyle = colour

      // Sleeves, then the body over them: the overlap is what gives the
      // shoulder its shape without drawing a seam.
      ctx.beginPath()
      ctx.moveTo(bodyX, bodyY)
      ctx.lineTo(bodyX - bodyW * 0.22, bodyY + bodyH * 0.12)
      ctx.lineTo(bodyX - bodyW * 0.12, bodyY + bodyH * 0.36)
      ctx.lineTo(bodyX, bodyY + bodyH * 0.26)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(bodyX + bodyW, bodyY)
      ctx.lineTo(bodyX + bodyW * 1.22, bodyY + bodyH * 0.12)
      ctx.lineTo(bodyX + bodyW * 1.12, bodyY + bodyH * 0.36)
      ctx.lineTo(bodyX + bodyW, bodyY + bodyH * 0.26)
      ctx.closePath()
      ctx.fill()

      roundRect(ctx, bodyX, bodyY, bodyW, bodyH, u * 2)
      ctx.fill()

      // Collar.
      ctx.fillStyle = background
      ctx.beginPath()
      ctx.ellipse(size / 2, bodyY + u * 0.5, bodyW * 0.16, bodyW * 0.075, 0, 0, Math.PI * 2)
      ctx.fill()

      drawContained(ctx, image, bodyX + bodyW * 0.18, bodyY + bodyH * 0.2, bodyW * 0.64, bodyH * 0.52)
      break
    }
  }

  return canvas.toDataURL('image/png')
}
