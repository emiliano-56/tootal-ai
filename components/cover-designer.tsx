'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Sparkles, Download, Loader2, QrCode } from 'lucide-react'
import type { CoverCopy } from '@/app/api/agent/cover-copy/route'
import { loadImage } from '@/lib/comic/bubbles'
import { supabase } from '@/lib/db'
import { saveAgentRun } from '@/lib/agents/history'
import {
  AgentHeader,
  Card,
  Field,
  inputClass,
  PrimaryButton,
  ErrorNote,
  StepProgress,
} from '@/components/agent-ui'
import { useLanguage, LanguagePicker } from '@/components/language-picker'

import { useGenerationApi } from '@/components/generation-config'
import { consumeFeature } from '@/lib/plans/use-feature'

const STEPS = [
  { key: 'copy', label: 'Writing title, blurb and art direction' },
  { key: 'art', label: 'Generating cover artwork' },
  { key: 'compose', label: 'Composing front, spine and back' },
]

// 6x9in at 150dpi
const W = 900
const H = 1350
const SPINE_W = 120

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight = '800'
) {
  let size = startSize
  do {
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 2
  } while (size > 12)
  return size
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

export function CoverDesigner() {
  const API = useGenerationApi()

  const [idea, setIdea] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState('')

  // The title and blurb are what the reader sees, so they follow the language.
  // The art prompt stays English — the image model is trained on it.
  const language = useLanguage()

  const [running, setRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(-1)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)

  const [copy, setCopy] = useState<CoverCopy | null>(null)
  const [front, setFront] = useState<string | null>(null)
  const [back, setBack] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)

  /**
   * Uploads the rendered covers to the `book-covers` bucket and records them in
   * `book_covers`, so they appear alongside covers made on the Book Cover page.
   */
  const saveCoverImages = async (
    title: string,
    frontData: string | null,
    backData: string | null
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const stamp = Date.now()
      const slug = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

      for (const [side, dataUrl] of [
        ['front', frontData],
        ['back', backData],
      ] as const) {
        if (!dataUrl) continue

        const blob = await (await fetch(dataUrl)).blob()
        const filename = `${slug}-${side}-${stamp}.jpg`
        const path = `${user.id}/${filename}`

        const { error: upErr } = await supabase.storage
          .from('book-covers')
          .upload(path, blob, { contentType: 'image/jpeg' })

        if (upErr) throw upErr

        await supabase.from('book_covers').insert({
          user_id: user.id,
          name: filename,
          image_path: path,
          prompt: `${title} — ${side} cover`,
        })
      }

      setSavedNote('Saved to your library.')
    } catch (err) {
      // Never lose the on-screen result because saving failed.
      console.error('[cover-designer] save failed:', err)
    }
  }

  const drawFront = async (c: CoverCopy, artUrl: string | null) => {
    const canvas = frontRef.current
    if (!canvas) return null
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const primary = c.theme?.primary || '#1e293b'
    const accent = c.theme?.accent || '#6366f1'
    const textColor = c.theme?.text || '#ffffff'

    // Artwork or gradient fallback
    if (artUrl) {
      try {
        const img = await loadImage(artUrl)
        const scale = Math.max(W / img.width, H / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
      } catch {
        ctx.fillStyle = primary
        ctx.fillRect(0, 0, W, H)
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, primary)
      g.addColorStop(1, accent)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }

    // Scrims so text stays readable over any artwork
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.36)
    top.addColorStop(0, 'rgba(0,0,0,0.78)')
    top.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, W, H * 0.36)

    const bottom = ctx.createLinearGradient(0, H * 0.66, 0, H)
    bottom.addColorStop(0, 'rgba(0,0,0,0)')
    bottom.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = bottom
    ctx.fillRect(0, H * 0.66, W, H * 0.34)

    ctx.textAlign = 'center'

    // Tagline
    ctx.fillStyle = accent
    ctx.font = '700 26px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(c.tagline.toUpperCase(), W / 2, 78)

    // Title
    const titleSize = fitText(ctx, c.title.toUpperCase(), W - 100, 108)
    ctx.font = `800 ${titleSize}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = textColor
    ctx.lineWidth = titleSize * 0.08
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(c.title.toUpperCase(), W / 2, 78 + titleSize)
    ctx.fillText(c.title.toUpperCase(), W / 2, 78 + titleSize)

    // Subtitle
    ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(c.subtitle, W / 2, 78 + titleSize + 52)

    // Author
    if (author.trim()) {
      ctx.font = '700 34px ui-sans-serif, system-ui, sans-serif'
      ctx.fillStyle = textColor
      ctx.fillText(author.toUpperCase(), W / 2, H - 70)
    }

    return canvas.toDataURL('image/jpeg', 0.94)
  }

  const drawBack = async (c: CoverCopy) => {
    const canvas = backRef.current
    if (!canvas) return null
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const primary = c.theme?.primary || '#1e293b'
    const accent = c.theme?.accent || '#6366f1'

    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, primary)
    g.addColorStop(1, accent)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    ctx.textAlign = 'left'
    const pad = 70
    let y = 120

    // Title
    ctx.fillStyle = '#ffffff'
    const ts = fitText(ctx, c.title.toUpperCase(), W - pad * 2, 52)
    ctx.font = `800 ${ts}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillText(c.title.toUpperCase(), pad, y)
    y += 60

    // Blurb
    ctx.font = '400 25px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    for (const line of wrap(ctx, c.back_blurb, W - pad * 2)) {
      ctx.fillText(line, pad, y)
      y += 36
    }

    y += 26

    // Bullets
    ctx.font = '600 24px ui-sans-serif, system-ui, sans-serif'
    for (const bullet of c.bullets ?? []) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(pad + 8, y - 8, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      for (const line of wrap(ctx, bullet, W - pad * 2 - 34)) {
        ctx.fillText(line, pad + 30, y)
        y += 34
      }
      y += 8
    }

    // Barcode placeholder
    const bcW = 300
    const bcH = 130
    const bcX = W - pad - bcW
    const bcY = H - pad - bcH
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bcX, bcY, bcW, bcH)
    ctx.fillStyle = '#000000'
    let bx = bcX + 16
    while (bx < bcX + bcW - 16) {
      const w = 2 + Math.round(Math.random() * 4)
      ctx.fillRect(bx, bcY + 14, w, bcH - 52)
      bx += w + 2 + Math.round(Math.random() * 4)
    }
    ctx.font = '500 16px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('ISBN PLACEHOLDER', bcX + bcW / 2, bcY + bcH - 16)

    // QR placeholder
    const qr = 130
    const qx = pad
    const qy = H - pad - qr
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(qx, qy, qr, qr)
    ctx.fillStyle = '#000000'
    const cells = 9
    const cell = (qr - 20) / cells
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const corner =
          (i < 3 && j < 3) || (i < 3 && j > cells - 4) || (i > cells - 4 && j < 3)
        if (corner || Math.random() > 0.55) {
          ctx.fillRect(qx + 10 + i * cell, qy + 10 + j * cell, cell - 1, cell - 1)
        }
      }
    }

    ctx.textAlign = 'left'
    return canvas.toDataURL('image/jpeg', 0.94)
  }

  const run = async () => {

    if (!idea.trim()) return

    // Charged only once the input is valid — an empty submit would otherwise
    // cost one of the month's allowance and generate nothing.
    const allowance = await consumeFeature('cover-designer')

    if (!allowance.ok) {
      setError(allowance.error ?? 'Monthly limit reached')
      return
    }

    setRunning(true)
    setError(null)
    setFailedIndex(undefined)
    setFront(null)
    setBack(null)
    setStepIndex(0)

    try {
      const res = await fetch('/api/agent/cover-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, author, genre, language: language.value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Copy generation failed')

      const c: CoverCopy = data
      setCopy(c)

      // ---- artwork ----
      setStepIndex(1)
      let artUrl: string | null = null
      try {
        const artRes = await fetch(`${API}/nano/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: c.art_prompt,
            aspect_ratio: '2:3',
            output_format: 'png',
          }),
        })
        const artData = await artRes.json()
        if (artData?.success && artData?.image_url) artUrl = artData.image_url
      } catch (err) {
        console.error('[cover] artwork failed:', err)
      }

      // ---- compose ----
      setStepIndex(2)
      const frontData = await drawFront(c, artUrl)
      const backData = await drawBack(c)
      setFront(frontData)
      setBack(backData)
      setStepIndex(3)

      // Persist the copy plus both rendered covers.
      await saveAgentRun({
        agent: 'cover_designer',
        title: c.title,
        input: { idea, author, genre },
        output: c,
      })
      await saveCoverImages(c.title, frontData, backData)
    } catch (err: any) {
      setFailedIndex(stepIndex)
      setError(err.message || 'Something went wrong.')
    } finally {
      setRunning(false)
    }
  }

  const exportPdf = async () => {
    if (!front || !back || !copy) return

    // Loaded on demand — jsPDF is ~350KB and only this button needs it.
    const { default: jsPDF } = await import('jspdf')

    // Full wrap: back | spine | front
    const totalW = W * 2 + SPINE_W
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [totalW, H],
    })

    pdf.addImage(back, 'JPEG', 0, 0, W, H)

    pdf.setFillColor(copy.theme?.primary || '#1e293b')
    pdf.rect(W, 0, SPINE_W, H, 'F')
    pdf.setTextColor('#ffffff')
    pdf.setFontSize(28)
    // Spine text rotated to read bottom-to-top
    pdf.text(copy.spine_text || copy.title, W + SPINE_W / 2 + 10, H / 2, {
      angle: 90,
      align: 'center',
    })

    pdf.addImage(front, 'JPEG', W + SPINE_W, 0, W, H)

    pdf.save(`${copy.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-cover.pdf`)
  }

  const downloadPng = (dataUrl: string, name: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = name
    a.click()
  }

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<ImagePlus className="w-5 h-5 text-white" />}
        gradient="from-violet-500 to-purple-600"
        title="Cover Designer Agent"
        subtitle="Front cover, spine and back cover with blurb, barcode and QR placeholders"
        action={
          front && back ? (
            <button
              onClick={exportPdf}
              className="font-display h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Print-ready PDF
            </button>
          ) : undefined
        }
      />

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <div className="space-y-4">
          <Card>
            <div className="space-y-4">
              <Field label="Book idea or title *">
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="The Last Superhero"
                  className={`${inputClass} h-24 resize-none`}
                />
              </Field>
              <Field label="Author name">
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="A. Writer"
                  className={inputClass}
                />
              </Field>
              <Field label="Genre">
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Superhero / Action"
                  className={inputClass}
                />
              </Field>

              <LanguagePicker
                value={language.value}
                onChange={language.setValue}
                allowed={language.allowed}
                className="mb-4"
              />

              <PrimaryButton
                onClick={run}
                loading={running}
                disabled={!idea.trim()}
                gradient="from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                shadow="shadow-violet-500/25"
                className="w-full"
              >
                {!running && <Sparkles className="w-4 h-4" />}
                {running ? 'Designing…' : 'Design Cover'}
              </PrimaryButton>
            </div>
          </Card>

          {stepIndex >= 0 && (
            <Card title="Progress">
              <StepProgress steps={STEPS} currentIndex={stepIndex} failedIndex={failedIndex} />
              {error && (
                <div className="mt-4">
                  <ErrorNote message={error} />
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* Canvases stay mounted but hidden; they are the drawing surface. */}
          <div className="hidden">
            <canvas ref={frontRef} />
            <canvas ref={backRef} />
          </div>

          {!front && !running && (
            <Card className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25">
                <ImagePlus className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display font-semibold text-slate-900 text-xl">
                Your cover will appear here
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
                Front and back are generated together, ready to export as a print PDF.
              </p>
            </Card>
          )}

          {running && !front && (
            <Card className="py-20 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              <p className="text-sm text-slate-500">Designing your cover…</p>
            </Card>
          )}

          {front && back && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card
                title="Front Cover"
                right={
                  <button
                    onClick={() => downloadPng(front, 'front-cover.png')}
                    className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-colors"
                  >
                    PNG
                  </button>
                }
              >
                <img src={front} alt="Front cover" className="w-full rounded-xl ring-1 ring-slate-200" />
              </Card>

              <Card
                title="Back Cover"
                icon={<QrCode className="w-[18px] h-[18px] text-slate-400" />}
                right={
                  <button
                    onClick={() => downloadPng(back, 'back-cover.png')}
                    className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-colors"
                  >
                    PNG
                  </button>
                }
              >
                <img src={back} alt="Back cover" className="w-full rounded-xl ring-1 ring-slate-200" />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
