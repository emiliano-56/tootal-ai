'use client'

import { useState } from 'react'
import { Wand2, Sparkles, Download, Users, BookOpen, RotateCcw } from 'lucide-react'
import type { ComicScript } from '@/app/api/agent/comic-script/route'
import { renderPanelWithBubbles, type Dialogue } from '@/lib/comic/bubbles'
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
import { usePromptPrefill } from '@/lib/dfy/use-prefill'

const STEPS = [
  { key: 'story', label: 'Writing the story and script' },
  { key: 'images', label: 'Generating panel artwork' },
  { key: 'bubbles', label: 'Placing speech bubbles' },
  { key: 'done', label: 'Comic ready' },
]

interface RenderedPanel {
  pageNumber: number
  panelNumber: number
  image: string
  dialogues: Dialogue[]
}

export function StoryComicAgent() {
  const API = useGenerationApi()

  const [idea, setIdea] = useState('')

  // Arriving from a DFY pack: the storybook prompt lands in the box.
  usePromptPrefill(setIdea)
  const [pages, setPages] = useState(3)
  const [panelsPerPage, setPanelsPerPage] = useState(4)
  const [style, setStyle] = useState('Modern comic book, bold ink, vibrant colour')
  const [audience, setAudience] = useState('All ages')

  // Story, dialogue and captions follow this. The panel art prompts do not —
  // the route keeps those English so the pictures still come out right.
  const language = useLanguage()

  const [running, setRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(-1)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const [script, setScript] = useState<ComicScript | null>(null)
  const [panels, setPanels] = useState<RenderedPanel[]>([])

  const totalPanels = pages * panelsPerPage
  const reset = () => {
    setScript(null)
    setPanels([])
    setStepIndex(-1)
    setFailedIndex(undefined)
    setError(null)
    setNote('')
  }

  const run = async () => {

    if (!idea.trim()) return

    // Charged only once the input is valid — an empty submit would otherwise
    // cost one of the month's allowance and generate nothing.
    const allowance = await consumeFeature('comic-agent')

    if (!allowance.ok) {
      setError(allowance.error ?? 'Monthly limit reached')
      return
    }

    reset()
    setRunning(true)

    try {
      // ---- Step 1: script -------------------------------------------------
      setStepIndex(0)
      setNote('Writing story, characters, panels and dialogue…')

      const scriptRes = await fetch('/api/agent/comic-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          pages,
          panelsPerPage,
          style,
          audience,
          language: language.value,
        }),
      })
      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(scriptData?.error || 'Script generation failed')

      const comicScript: ComicScript = scriptData
      setScript(comicScript)

      // ---- Step 2: artwork ------------------------------------------------
      setStepIndex(1)

      const flatPanels = comicScript.pages.flatMap((page) =>
        (page.panels ?? []).map((panel) => ({ page, panel }))
      )

      const rendered: RenderedPanel[] = []

      for (let i = 0; i < flatPanels.length; i++) {
        const { page, panel } = flatPanels[i]
        setNote(`Drawing panel ${i + 1} of ${flatPanels.length}…`)

        let imageData = ''

        try {
          const imgRes = await fetch(`${API}/coloring/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `${panel.image_prompt}. Art style: ${style}.`,
              aspect_ratio: '1:1',
            }),
          })

          const imgData = await imgRes.json()
          if (imgData?.image_url) {
            const blobRes = await fetch(imgData.image_url)
            const blob = await blobRes.blob()
            imageData = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.readAsDataURL(blob)
            })
          }
        } catch (err) {
          console.error('[story-comic] panel image failed:', err)
        }

        rendered.push({
          pageNumber: page.page_number,
          panelNumber: panel.panel_number,
          image: imageData,
          dialogues: (panel.dialogues ?? []) as Dialogue[],
        })

        // Show progress as panels land rather than waiting for the whole run.
        setPanels([...rendered])
      }

      // ---- Step 3: bubbles ------------------------------------------------
      setStepIndex(2)

      const withBubbles: RenderedPanel[] = []
      for (let i = 0; i < rendered.length; i++) {
        const p = rendered[i]
        setNote(`Lettering panel ${i + 1} of ${rendered.length}…`)

        if (p.image && p.dialogues.length > 0) {
          try {
            const composited = await renderPanelWithBubbles(p.image, p.dialogues)
            withBubbles.push({ ...p, image: composited })
            continue
          } catch (err) {
            console.error('[story-comic] bubble render failed:', err)
          }
        }
        withBubbles.push(p)
      }

      setPanels(withBubbles)
      setStepIndex(3)
      setNote('Done — your comic is ready below.')

      // Record the run. Panel images are excluded (data URLs are far too large
      // for a jsonb column); the exported PDF is what gets stored.
      await saveAgentRun({
        agent: 'story_to_comic',
        title: comicScript.title,
        input: { idea, pages, panelsPerPage, style, audience },
        output: {
          title: comicScript.title,
          logline: comicScript.logline,
          story: comicScript.story,
          characters: comicScript.characters,
          pageCount: comicScript.pages?.length ?? 0,
          panelCount: withBubbles.length,
        },      })
    } catch (err: any) {
      setFailedIndex(stepIndex)
      setError(err.message || 'Something went wrong.')
    } finally {
      setRunning(false)
    }
  }

  const exportPdf = async () => {
    if (!script || panels.length === 0) return

    // Loaded on demand — jsPDF is ~350KB and only this button needs it.
    const { default: jsPDF } = await import('jspdf')

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10

    const byPage = new Map<number, RenderedPanel[]>()
    for (const panel of panels) {
      const list = byPage.get(panel.pageNumber) ?? []
      list.push(panel)
      byPage.set(panel.pageNumber, list)
    }

    let first = true

    for (const [pageNumber, pagePanels] of Array.from(byPage.entries()).sort(
      (a, b) => a[0] - b[0]
    )) {
      if (!first) pdf.addPage()
      first = false

      pdf.setFontSize(11)
      pdf.text(`${script.title} — Page ${pageNumber}`, margin, margin)

      const cols = 2
      const cellW = (pageWidth - margin * 2 - 5) / cols
      const cellH = cellW

      pagePanels.forEach((panel, i) => {
        if (!panel.image) return
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = margin + col * (cellW + 5)
        const y = margin + 6 + row * (cellH + 5)
        if (y + cellH > pageHeight - margin) return
        pdf.addImage(panel.image, 'JPEG', x, y, cellW, cellH)
      })
    }

    const filename = `${script.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
    const blob = pdf.output('blob')
    pdf.save(filename)

    // Best-effort save to the user's library; a failure here must not lose the download.
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const path = `${user.id}/${Date.now()}-${filename}`
      const { error: upErr } = await supabase.storage
        .from('comic-pdfs')
        .upload(path, blob, { contentType: 'application/pdf' })

      if (!upErr) {
        await supabase.from('comics').insert({
          user_id: user.id,
          title: script.title,
          pdf_path: path,
        })
        setNote('Comic downloaded and saved to My Library.')
      }
    } catch (err) {
      console.error('[story-comic] library save failed:', err)
    }
  }

  return (
    <div className="w-full space-y-6">
      <AgentHeader
        icon={<Wand2 className="w-5 h-5 text-white" />}
        gradient="from-blue-500 to-indigo-600"
        title="Story-to-Comic Agent"
        subtitle="One idea becomes a finished comic — story, panels, art, dialogue and bubbles"
        action={
          panels.some((p) => p.image) ? (
            <button
              onClick={exportPdf}
              className="font-display h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          ) : undefined
        }
      />

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <div className="space-y-4">
              <Field label="Your idea *">
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="A robot saves a futuristic city from an alien invasion."
                  className={`${inputClass} h-28 resize-none`}
                />
              </Field>

              <Field label="Art style">
                <input
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Audience">
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <LanguagePicker
                value={language.value}
                onChange={language.setValue}
                allowed={language.allowed}
              answered={language.answered}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Pages">
                  <select
                    value={pages}
                    onChange={(e) => setPages(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Panels / page">
                  <select
                    value={panelsPerPage}
                    onChange={(e) => setPanelsPerPage(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[2, 3, 4, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3.5 py-2.5 ring-1 ring-slate-200">
                <span className="text-slate-500">{totalPanels} panels total</span>
                <span className="font-semibold text-indigo-600">
                  {totalPanels === 1 ? '1 image' : `${totalPanels} images`}
                </span>
              </div>

              <PrimaryButton
                onClick={run}
                loading={running}
                disabled={!idea.trim()}
                className="w-full"
              >
                {!running && <Sparkles className="w-4 h-4" />}
                {running ? 'Building your comic…' : 'Create Comic'}
              </PrimaryButton>

              {script && !running && (
                <button
                  onClick={reset}
                  className="w-full h-10 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Start over
                </button>
              )}
            </div>
          </Card>

          {stepIndex >= 0 && (
            <Card title="Progress">
              <StepProgress steps={STEPS} currentIndex={stepIndex} failedIndex={failedIndex} />
              {note && <p className="text-xs text-slate-500 mt-4">{note}</p>}
              {error && (
                <div className="mt-4">
                  <ErrorNote message={error} />
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Output */}
        <div className="space-y-4">
          {!script && (
            <Card className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/25">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display font-semibold text-slate-900 text-xl">
                Your comic will appear here
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-sm">
                Describe an idea on the left. The agent writes the story, splits it into
                scenes, draws every panel and letters the dialogue.
              </p>
            </Card>
          )}

          {script && (
            <>
              <Card title={script.title} subtitle={script.logline}>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                  {script.story}
                </p>
              </Card>

              {script.characters?.length > 0 && (
                <Card
                  title="Characters"
                  icon={<Users className="w-[18px] h-[18px] text-purple-500" />}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    {script.characters.map((c) => (
                      <div key={c.name} className="rounded-xl ring-1 ring-slate-200 p-3.5">
                        <p className="font-display font-semibold text-slate-900 text-sm">
                          {c.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {panels.length > 0 && (
                <Card title="Panels" subtitle={`${panels.filter((p) => p.image).length} of ${panels.length} rendered`}>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {panels.map((panel, i) => (
                      <div
                        key={`${panel.pageNumber}-${panel.panelNumber}-${i}`}
                        className="rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-50"
                      >
                        {panel.image ? (
                          <img
                            src={panel.image}
                            alt={`Page ${panel.pageNumber} panel ${panel.panelNumber}`}
                            className="w-full aspect-square object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center text-xs text-slate-400">
                            Image unavailable
                          </div>
                        )}
                        <div className="px-3 py-2 bg-white">
                          <p className="text-[11px] font-semibold text-slate-500">
                            Page {panel.pageNumber} · Panel {panel.panelNumber}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
