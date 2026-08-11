'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  RefreshCw,
  Trash2,
  Copy,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Loader2,
  Undo2,
  Redo2,
  LayoutGrid,
  Pencil,
  AlertTriangle,
} from 'lucide-react'
import type { Dialogue } from '@/lib/comic/bubbles'
import { renderPanelWithBubbles } from '@/lib/comic/bubbles'
import {
  movePanel,
  removePanel,
  duplicatePanel,
  byPage,
  renumber,
  initHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  sourceImage,
  type EditablePanel,
  type History,
} from '@/lib/comic/editor'
import { PAGE_LAYOUTS, autoLayout } from '@/lib/comic/layouts'
import { BubbleEditor } from '@/components/bubble-editor'

/**
 * Fixing a comic instead of regenerating it.
 *
 * The problem this exists for, stated plainly: one bad panel out of
 * twenty-four used to mean regenerating the whole book. A month's allowance
 * spent again, five minutes gone, and twenty-three panels the customer liked
 * thrown away and redrawn differently. Editing a caption was the same.
 *
 * So every operation here is local to one panel: redraw it, reword its
 * prompt, move its bubbles, delete it, duplicate it. Nothing touches anything
 * the customer did not point at.
 *
 * Undo covers all of it, because an editor without undo is one the customer
 * is afraid to use — and a redraw is not reversible any other way.
 */

interface Props {
  panels: EditablePanel[]
  onChange: (panels: EditablePanel[]) => void
  /** Generation backend base URL. */
  api: string
  /** Character references, so a redraw keeps the cast looking right. */
  references?: string[]
  artStyle?: string
  panelsPerPage?: number
  /** Chosen per page; the parent keeps it so export can use it too. */
  layouts?: Record<number, string>
  onLayoutChange?: (page: number, key: string) => void
}

export function PanelEditor({
  panels,
  onChange,
  api,
  references = [],
  artStyle = '',
  panelsPerPage = 4,
  layouts = {},
  onLayoutChange,
}: Props) {
  const [history, setHistory] = useState<History<EditablePanel[]>>(() => initHistory(panels))
  const [editingBubbles, setEditingBubbles] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  /**
   * Apply a change and record it.
   *
   * Every mutation goes through here so undo is never missing a step — the
   * bug in every hand-rolled editor is the one operation somebody forgot to
   * push onto the stack.
   */
  const apply = useCallback(
    (next: EditablePanel[], renumberAfter = true) => {
      const settled = renumberAfter ? renumber(next, panelsPerPage) : next

      setHistory((current) => commit(current, settled))
      onChange(settled)
    },
    [onChange, panelsPerPage]
  )

  const stepBack = () => {
    setHistory((current) => {
      const next = undo(current)

      onChange(next.present)

      return next
    })
  }

  const stepForward = () => {
    setHistory((current) => {
      const next = redo(current)

      onChange(next.present)

      return next
    })
  }

  /**
   * Redraw one panel.
   *
   * The character references go along, which is the point: a redrawn panel
   * that no longer matches the rest of the book is not a fix. The bubbles are
   * re-composited afterwards, because the new drawing has none.
   */
  const redraw = async (panel: EditablePanel) => {
    setDrawing((current) => new Set(current).add(panel.id))
    setError(null)

    try {
      const response = await fetch(`${api}/coloring/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: artStyle ? `${panel.prompt}. Art style: ${artStyle}.` : panel.prompt,
          aspect_ratio: '1:1',
          ...(references.length > 0 ? { image_urls: references } : {}),
        }),
      })

      const data = await response.json().catch(() => null)

      if (!data?.image_url) throw new Error(data?.error || 'The illustrator did not answer')

      // Fetched and inlined so the export does not depend on a URL that
      // expires within the hour.
      const file = await fetch(data.image_url)
      const blob = await file.blob()

      const image = await new Promise<string>((resolve) => {
        const reader = new FileReader()

        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      const composited =
        panel.dialogues.length > 0
          ? await renderPanelWithBubbles(image, panel.dialogues).catch(() => image)
          : image

      apply(
        panels.map((entry) =>
          entry.id === panel.id
            ? { ...entry, image: composited, rawImage: image, status: 'idle', error: undefined }
            : entry
        ),
        false
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not redraw that panel')
    } finally {
      setDrawing((current) => {
        const next = new Set(current)

        next.delete(panel.id)

        return next
      })
    }
  }

  /**
   * Re-paint the bubbles after they have been edited.
   *
   * Always from `rawImage`, never from what is on screen. Bubbles are burned
   * into the pixels, so compositing onto the displayed image would draw the
   * new bubbles on top of the old ones — and there is no way back from that
   * short of spending a generation.
   */
  const applyBubbles = async (panel: EditablePanel, dialogues: Dialogue[]) => {
    const clean = sourceImage(panel)

    const image = clean
      ? await renderPanelWithBubbles(clean, dialogues).catch(() => panel.image)
      : panel.image

    apply(
      panels.map((entry) =>
        entry.id === panel.id ? { ...entry, dialogues, image, rawImage: clean } : entry
      ),
      false
    )
  }

  const pages = useMemo(() => byPage(panels), [panels])
  const bubblePanel = panels.find((panel) => panel.id === editingBubbles)
  const promptPanel = panels.find((panel) => panel.id === editingPrompt)

  if (panels.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          Edit your comic
          <span className="ml-2 font-normal text-slate-400">
            {panels.length} panel{panels.length === 1 ? '' : 's'} · {pages.length} page
            {pages.length === 1 ? '' : 's'}
          </span>
        </p>

        <div className="flex items-center gap-1">
          <button
            onClick={stepBack}
            disabled={!canUndo(history)}
            title="Undo"
            className="h-8 px-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 disabled:opacity-40 inline-flex items-center gap-1 text-xs font-semibold"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={stepForward}
            disabled={!canRedo(history)}
            title="Redo"
            className="h-8 px-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 disabled:opacity-40 inline-flex items-center gap-1 text-xs font-semibold"
          >
            <Redo2 className="w-3.5 h-3.5" />
            Redo
          </button>
        </div>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-red-50 ring-1 ring-red-100 text-sm text-red-600">{error}</p>
      )}

      {pages.map((page) => (
        <div key={page.pageNumber} className="rounded-2xl ring-1 ring-slate-200 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Page {page.pageNumber}
            </p>

            {onLayoutChange && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <LayoutGrid className="w-3.5 h-3.5" />
                <select
                  value={layouts[page.pageNumber] ?? autoLayout(page.panels.length).key}
                  onChange={(event) => onLayoutChange(page.pageNumber, event.target.value)}
                  className="h-7 px-1.5 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-[11px]"
                >
                  {/* Only layouts that hold this many panels; anything else
                      would silently drop a panel on export. */}
                  {PAGE_LAYOUTS.filter((entry) => entry.panels === page.panels.length).map(
                    (entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    )
                  )}
                  <option value={`grid-${page.panels.length}`}>Even grid</option>
                </select>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {page.panels.map((panel) => {
              const index = panels.findIndex((entry) => entry.id === panel.id)
              const busy = drawing.has(panel.id)

              return (
                <div key={panel.id} className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
                  <div className="relative aspect-square bg-slate-100">
                    {panel.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={panel.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-slate-300 text-xs">
                        No drawing
                      </div>
                    )}

                    {busy && (
                      <div className="absolute inset-0 bg-white/80 grid place-items-center">
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mx-auto" />
                          <p className="mt-1 text-[10px] text-slate-500">Redrawing…</p>
                        </div>
                      </div>
                    )}

                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-bold">
                      {panel.pageNumber}.{panel.panelNumber}
                    </span>
                  </div>

                  <div className="p-1.5 flex flex-wrap items-center gap-0.5">
                    <Tool label="Redraw this panel" onClick={() => redraw(panel)} disabled={busy}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Tool>
                    <Tool label="Edit the prompt" onClick={() => setEditingPrompt(panel.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Tool>
                    <Tool
                      label="Speech bubbles"
                      onClick={() => setEditingBubbles(panel.id)}
                      disabled={!panel.image}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Tool>
                    <Tool
                      label="Move earlier"
                      onClick={() => apply(movePanel(panels, index, -1))}
                      disabled={index === 0}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Tool>
                    <Tool
                      label="Move later"
                      onClick={() => apply(movePanel(panels, index, 1))}
                      disabled={index === panels.length - 1}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Tool>
                    <Tool
                      label="Duplicate"
                      onClick={() =>
                        apply(duplicatePanel(panels, index, () => `${panel.id}-copy-${Date.now()}`))
                      }
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Tool>
                    <Tool
                      label="Delete"
                      tone="text-red-500"
                      onClick={() => apply(removePanel(panels, index))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Tool>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {bubblePanel && (
        <BubbleEditor
          image={bubblePanel.image}
          dialogues={bubblePanel.dialogues}
          onChange={(next) => applyBubbles(bubblePanel, next)}
          onClose={() => setEditingBubbles(null)}
        />
      )}

      {promptPanel && (
        <PromptDialog
          panel={promptPanel}
          onClose={() => setEditingPrompt(null)}
          onSave={(prompt) => {
            apply(
              panels.map((entry) =>
                entry.id === promptPanel.id ? { ...entry, prompt } : entry
              ),
              false
            )
            setEditingPrompt(null)
          }}
          onSaveAndRedraw={async (prompt) => {
            const updated = { ...promptPanel, prompt }

            apply(
              panels.map((entry) => (entry.id === promptPanel.id ? updated : entry)),
              false
            )
            setEditingPrompt(null)
            await redraw(updated)
          }}
        />
      )}
    </div>
  )
}

function Tool({
  label,
  onClick,
  disabled,
  tone = 'text-slate-500',
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg ${tone} hover:bg-slate-100 disabled:opacity-30 transition-colors`}
    >
      {children}
    </button>
  )
}

/**
 * Rewording what a panel asked for.
 *
 * Offered alongside redraw rather than instead of it, because they are
 * different intentions: redrawing the same prompt is rolling the dice again,
 * and changing the prompt is asking for something else. Both are legitimate
 * and conflating them wastes generations.
 */
function PromptDialog({
  panel,
  onClose,
  onSave,
  onSaveAndRedraw,
}: {
  panel: EditablePanel
  onClose: () => void
  onSave: (prompt: string) => void
  onSaveAndRedraw: (prompt: string) => void
}) {
  const [prompt, setPrompt] = useState(panel.prompt)
  const changed = prompt.trim() !== panel.prompt.trim()

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl ring-1 ring-slate-200 shadow-2xl p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            Panel {panel.pageNumber}.{panel.panelNumber}
          </h2>
          <p className="text-xs text-slate-500">
            What the illustrator was asked to draw. Change it and redraw to get something else.
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={6}
          className="w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <p className="text-[11px] text-slate-400 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          Redrawing spends one generation from your monthly allowance.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl ring-1 ring-slate-200 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(prompt)}
            disabled={!changed}
            className="h-10 px-4 rounded-xl ring-1 ring-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Save only
          </button>
          <button
            onClick={() => onSaveAndRedraw(prompt)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            Save & redraw
          </button>
        </div>
      </div>
    </div>
  )
}
