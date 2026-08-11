'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Cloud, Type, Plus, Trash2, X, Check } from 'lucide-react'
import type { Dialogue } from '@/lib/comic/bubbles'
import { addBubble, updateBubble, removeBubble } from '@/lib/comic/editor'

/**
 * Placing speech bubbles by dragging them.
 *
 * The generator guesses positions and its guesses are reasonable, but a
 * bubble sitting on a character's face is the one flaw that makes a page look
 * amateur — and it was unfixable, because the only way to move it was to
 * regenerate the panel and hope. Dragging is the whole feature.
 *
 * The drag surface shows the *anchor*, not the rendered bubble, and says so.
 * The real bubble is sized from its text at render time and clamped to stay
 * inside the panel, so a WYSIWYG box here would be a lie in the cases that
 * matter — a long line grows and shifts. A marker that means "the bubble
 * starts here" is honest and is what the renderer actually uses.
 */

const TYPES: { value: Dialogue['type']; label: string; icon: typeof MessageCircle }[] = [
  { value: 'speech', label: 'Speech', icon: MessageCircle },
  { value: 'thought', label: 'Thought', icon: Cloud },
  { value: 'caption', label: 'Caption', icon: Type },
]

export function BubbleEditor({
  image,
  dialogues,
  onChange,
  onClose,
}: {
  image: string
  dialogues: Dialogue[]
  onChange: (next: Dialogue[]) => void
  onClose: () => void
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(dialogues.length > 0 ? 0 : null)

  /** Pointer position as a 0-1 fraction of the panel, whatever its size. */
  const fractionAt = useCallback((clientX: number, clientY: number) => {
    const box = surfaceRef.current?.getBoundingClientRect()

    if (!box || box.width === 0 || box.height === 0) return null

    return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height }
  }, [])

  // Bound to the window rather than the marker: a fast drag outruns the
  // element, and a listener on the marker would drop the bubble mid-flight.
  useEffect(() => {
    if (dragging === null) return

    const move = (event: PointerEvent) => {
      const point = fractionAt(event.clientX, event.clientY)

      if (point) onChange(updateBubble(dialogues, dragging, point))
    }

    const stop = () => setDragging(null)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging, dialogues, onChange, fractionAt])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const current = selected !== null ? dialogues[selected] : undefined

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl my-4 bg-white rounded-2xl ring-1 ring-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Speech bubbles</h2>
            <p className="text-xs text-slate-500">
              Drag a marker to move its bubble. The bubble grows from the marker as you type.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-[1fr_18rem] gap-4 p-4">
          {/* The panel */}
          <div
            ref={surfaceRef}
            className="relative rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 select-none touch-none aspect-square"
            onDoubleClick={(event) => {
              // Double-click on empty space is the fastest way to add a bubble
              // exactly where you want it.
              const point = fractionAt(event.clientX, event.clientY)

              if (!point) return

              onChange(addBubble(dialogues, point))
              setSelected(dialogues.length)
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="w-full h-full object-cover pointer-events-none" />

            {dialogues.map((dialogue, index) => {
              const active = index === selected

              return (
                <button
                  key={index}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    setSelected(index)
                    setDragging(index)
                  }}
                  style={{ left: `${dialogue.x * 100}%`, top: `${dialogue.y * 100}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[45%] px-2 py-1 rounded-lg text-[11px] font-semibold shadow-lg cursor-grab active:cursor-grabbing ring-2 transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white ring-white'
                      : 'bg-white text-slate-700 ring-slate-900/20'
                  }`}
                  title="Drag to move"
                >
                  <span className="block truncate">
                    {dialogue.text?.trim() || '(empty)'}
                  </span>
                </button>
              )
            })}

            {dialogues.length === 0 && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <p className="px-3 py-1.5 rounded-lg bg-slate-900/70 text-white text-xs font-medium">
                  Double-click anywhere to add a bubble
                </p>
              </div>
            )}
          </div>

          {/* The one selected bubble */}
          <div className="space-y-3">
            <button
              onClick={() => {
                onChange(addBubble(dialogues))
                setSelected(dialogues.length)
              }}
              className="w-full h-9 rounded-lg ring-1 ring-slate-200 text-xs font-semibold text-slate-600 inline-flex items-center justify-center gap-1.5 hover:bg-slate-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add bubble
            </button>

            {dialogues.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dialogues.map((dialogue, index) => (
                  <button
                    key={index}
                    onClick={() => setSelected(index)}
                    className={`h-7 px-2 rounded-lg text-[11px] font-semibold max-w-full truncate ${
                      index === selected
                        ? 'bg-indigo-600 text-white'
                        : 'ring-1 ring-slate-200 text-slate-600'
                    }`}
                  >
                    {dialogue.text?.trim().slice(0, 14) || '(empty)'}
                  </button>
                ))}
              </div>
            )}

            {current && selected !== null ? (
              <div className="space-y-3 rounded-xl ring-1 ring-slate-200 p-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Kind
                  </label>
                  <div className="flex gap-1">
                    {TYPES.map((type) => {
                      const Icon = type.icon
                      const active = current.type === type.value

                      return (
                        <button
                          key={type.value}
                          onClick={() => onChange(updateBubble(dialogues, selected, { type: type.value }))}
                          title={type.label}
                          className={`flex-1 h-8 rounded-lg grid place-items-center ring-1 ${
                            active
                              ? 'bg-indigo-50 ring-indigo-400 text-indigo-700'
                              : 'ring-slate-200 text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Who says it
                  </label>
                  <input
                    value={current.speaker ?? ''}
                    onChange={(event) =>
                      onChange(updateBubble(dialogues, selected, { speaker: event.target.value }))
                    }
                    placeholder="Pip"
                    className="w-full h-8 px-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    What they say
                  </label>
                  <textarea
                    value={current.text}
                    onChange={(event) =>
                      onChange(updateBubble(dialogues, selected, { text: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg bg-slate-50 ring-1 ring-slate-200 text-xs p-2 resize-none"
                  />
                  {/* A long line makes a bubble that swallows the drawing. The
                      renderer caps its width, so it grows downward instead. */}
                  {current.text.length > 90 && (
                    <p className="mt-1 text-[10px] text-amber-600">
                      That is long for one bubble — it will cover a lot of the panel.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    onChange(removeBubble(dialogues, selected))
                    setSelected(null)
                  }}
                  className="w-full h-8 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove this bubble
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 px-1">
                Pick a bubble to edit what it says.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
