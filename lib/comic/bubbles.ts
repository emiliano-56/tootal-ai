/**
 * Draws comic speech bubbles onto a panel image using canvas.
 *
 * Runs in the browser so no image-processing backend is needed. Returns a data
 * URL of the composited panel.
 */

export interface Dialogue {
  speaker: string
  text: string
  x: number // 0-1 within the panel
  y: number // 0-1 within the panel
  type: 'speech' | 'thought' | 'caption'
}

const FONT_STACK = '"Comic Sans MS", "Chalkboard SE", "Segoe UI", sans-serif'

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)

  return lines
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Cloud outline used for thought bubbles. */
function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const r = Math.min(w, h) / 5
  ctx.beginPath()
  ctx.moveTo(x + r, y + h / 2)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const bump = i % 2 === 0 ? 1 : 0.86
    const px = x + w / 2 + Math.cos(angle) * (w / 2) * bump
    const py = y + h / 2 + Math.sin(angle) * (h / 2) * bump
    ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  dialogue: Dialogue,
  canvasWidth: number,
  canvasHeight: number
) {
  const isCaption = dialogue.type === 'caption'
  const isThought = dialogue.type === 'thought'

  const fontSize = Math.max(14, Math.round(canvasWidth * 0.022))
  const padding = fontSize * 0.85
  const maxBubbleWidth = canvasWidth * 0.42

  ctx.font = `600 ${fontSize}px ${FONT_STACK}`
  ctx.textBaseline = 'top'

  const label = isCaption ? dialogue.text : dialogue.text
  const lines = wrapText(ctx, label, maxBubbleWidth - padding * 2)

  const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const lineHeight = fontSize * 1.32

  const boxW = textWidth + padding * 2
  const boxH = lines.length * lineHeight + padding * 1.6

  // Clamp so the bubble always stays fully inside the panel.
  const x = Math.min(Math.max(dialogue.x * canvasWidth, 8), canvasWidth - boxW - 8)
  const y = Math.min(Math.max(dialogue.y * canvasHeight, 8), canvasHeight - boxH - 8)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3

  ctx.fillStyle = isCaption ? '#fef9c3' : '#ffffff'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = Math.max(2, fontSize * 0.13)

  if (isThought) {
    cloud(ctx, x, y, boxW, boxH)
  } else {
    roundedRect(ctx, x, y, boxW, boxH, isCaption ? 6 : boxH * 0.32)
  }

  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.stroke()

  // Tail pointing toward the middle of the panel.
  if (!isCaption) {
    const towardCentreX = x + boxW / 2 < canvasWidth / 2 ? boxW * 0.28 : boxW * 0.72
    const below = y + boxH / 2 < canvasHeight / 2
    const tailBaseY = below ? y + boxH : y
    const tailTipY = below ? tailBaseY + boxH * 0.42 : tailBaseY - boxH * 0.42

    if (isThought) {
      // Trailing bubbles instead of a pointed tail.
      for (let i = 1; i <= 3; i++) {
        const r = (fontSize * 0.3) / i
        const cx = x + towardCentreX + i * fontSize * 0.35
        const cy = tailBaseY + (below ? 1 : -1) * i * fontSize * 0.55
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(x + towardCentreX - boxW * 0.09, tailBaseY)
      ctx.lineTo(x + towardCentreX + boxW * 0.09, tailBaseY)
      ctx.lineTo(x + towardCentreX + boxW * 0.02, tailTipY)
      ctx.closePath()
      ctx.fillStyle = isCaption ? '#fef9c3' : '#ffffff'
      ctx.fill()
      ctx.stroke()

      // Hide the seam where the tail meets the bubble body.
      ctx.beginPath()
      ctx.moveTo(x + towardCentreX - boxW * 0.085, tailBaseY)
      ctx.lineTo(x + towardCentreX + boxW * 0.085, tailBaseY)
      ctx.strokeStyle = isCaption ? '#fef9c3' : '#ffffff'
      ctx.lineWidth = Math.max(3, fontSize * 0.18)
      ctx.stroke()
    }
  }

  // Text
  ctx.fillStyle = '#111111'
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding * 0.8 + i * lineHeight)
  })

  ctx.restore()
}

/**
 * Composites dialogue bubbles over a panel image.
 * @param imageSrc data URL or same-origin/CORS-enabled image URL
 */
export async function renderPanelWithBubbles(
  imageSrc: string,
  dialogues: Dialogue[]
): Promise<string> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || 1024
  canvas.height = image.naturalHeight || 1024

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  for (const dialogue of dialogues ?? []) {
    if (!dialogue?.text?.trim()) continue
    drawBubble(ctx, dialogue, canvas.width, canvas.height)
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}
