/**
 * Draws a simple 3D-style product mockup on a canvas.
 *
 * Used by the Business Agent to produce shop-ready product imagery without
 * needing a design tool or a rendering service.
 */

export interface MockupOptions {
  title: string
  subtitle?: string
  primary: string
  accent: string
  /** Optional cover artwork; a gradient cover is drawn when omitted. */
  coverImage?: string
  width?: number
  height?: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load cover image'))
    img.src = src
  })
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  weight = '800'
) {
  let size = start
  do {
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 2
  } while (size > 10)
  return size
}

/** Renders a standing book/comic with perspective, spine and reflection. */
export async function renderBookMockup(options: MockupOptions): Promise<string> {
  const W = options.width ?? 1200
  const H = options.height ?? 900

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')

  // Backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#f8fafc')
  bg.addColorStop(1, '#e2e8f0')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Soft glow behind the product
  const glow = ctx.createRadialGradient(W / 2, H * 0.5, 20, W / 2, H * 0.5, W * 0.45)
  glow.addColorStop(0, `${options.primary}33`)
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Book geometry
  const bookH = H * 0.62
  const bookW = bookH * 0.68
  const x = (W - bookW) / 2 + 24
  const y = (H - bookH) / 2 - 20
  const spineW = 34

  // Drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(15,23,42,0.35)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetX = -12
  ctx.shadowOffsetY = 24
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, bookW, bookH)
  ctx.restore()

  // Spine (left face, slightly darker for depth)
  const spineGrad = ctx.createLinearGradient(x - spineW, 0, x, 0)
  spineGrad.addColorStop(0, options.accent)
  spineGrad.addColorStop(1, options.primary)
  ctx.fillStyle = spineGrad
  ctx.beginPath()
  ctx.moveTo(x - spineW, y + 16)
  ctx.lineTo(x, y)
  ctx.lineTo(x, y + bookH)
  ctx.lineTo(x - spineW, y + bookH - 16)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fill()

  // Front cover
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, bookW, bookH)
  ctx.clip()

  if (options.coverImage) {
    try {
      const img = await loadImage(options.coverImage)
      const scale = Math.max(bookW / img.width, bookH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, x + (bookW - dw) / 2, y + (bookH - dh) / 2, dw, dh)
    } catch {
      const g = ctx.createLinearGradient(x, y, x + bookW, y + bookH)
      g.addColorStop(0, options.primary)
      g.addColorStop(1, options.accent)
      ctx.fillStyle = g
      ctx.fillRect(x, y, bookW, bookH)
    }
  } else {
    const g = ctx.createLinearGradient(x, y, x + bookW, y + bookH)
    g.addColorStop(0, options.primary)
    g.addColorStop(1, options.accent)
    ctx.fillStyle = g
    ctx.fillRect(x, y, bookW, bookH)

    // Title on the generated cover
    const scrim = ctx.createLinearGradient(0, y, 0, y + bookH)
    scrim.addColorStop(0, 'rgba(0,0,0,0.45)')
    scrim.addColorStop(0.5, 'rgba(0,0,0,0.05)')
    scrim.addColorStop(1, 'rgba(0,0,0,0.5)')
    ctx.fillStyle = scrim
    ctx.fillRect(x, y, bookW, bookH)

    ctx.textAlign = 'center'
    const size = fitText(ctx, options.title.toUpperCase(), bookW - 48, 46)
    ctx.font = `800 ${size}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(options.title.toUpperCase(), x + bookW / 2, y + bookH * 0.32)

    if (options.subtitle) {
      ctx.font = '600 20px ui-sans-serif, system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(options.subtitle, x + bookW / 2, y + bookH * 0.32 + size * 0.9)
    }
  }

  // Page-edge highlight down the left of the cover
  const edge = ctx.createLinearGradient(x, 0, x + 26, 0)
  edge.addColorStop(0, 'rgba(255,255,255,0.42)')
  edge.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = edge
  ctx.fillRect(x, y, 26, bookH)

  // Gloss sweep
  const gloss = ctx.createLinearGradient(x, y, x + bookW, y + bookH)
  gloss.addColorStop(0, 'rgba(255,255,255,0.18)')
  gloss.addColorStop(0.45, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.fillRect(x, y, bookW, bookH)

  ctx.restore()

  // Reflection
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.translate(0, (y + bookH) * 2)
  ctx.scale(1, -1)
  const refl = ctx.createLinearGradient(0, y, 0, y + bookH * 0.4)
  refl.addColorStop(0, options.primary)
  refl.addColorStop(1, 'transparent')
  ctx.fillStyle = refl
  ctx.fillRect(x, y, bookW, bookH * 0.4)
  ctx.restore()

  return canvas.toDataURL('image/jpeg', 0.92)
}

/** Social banner / thumbnail, useful for YouTube covers and ads. */
export async function renderSocialBanner(options: MockupOptions): Promise<string> {
  const W = options.width ?? 1280
  const H = options.height ?? 720

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, options.primary)
  g.addColorStop(1, options.accent)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Decorative rings
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  for (let r = 120; r < W; r += 90) {
    ctx.beginPath()
    ctx.arc(W * 0.86, H * 0.2, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.textAlign = 'left'
  const pad = 72

  ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('NEW RELEASE', pad, H * 0.28)

  const size = fitText(ctx, options.title.toUpperCase(), W - pad * 2 - 120, 84)
  ctx.font = `800 ${size}px ui-sans-serif, system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(options.title.toUpperCase(), pad, H * 0.28 + size + 16)

  if (options.subtitle) {
    ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillText(options.subtitle, pad, H * 0.28 + size + 66)
  }

  // CTA pill
  const pillW = 240
  const pillH = 62
  const px = pad
  const py = H - pad - pillH
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(px, py, pillW, pillH, pillH / 2)
  ctx.fill()
  ctx.fillStyle = options.primary
  ctx.font = '800 22px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('GET IT NOW', px + pillW / 2, py + pillH / 2 + 8)

  return canvas.toDataURL('image/jpeg', 0.92)
}
