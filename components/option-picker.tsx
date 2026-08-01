'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Plus, Check } from 'lucide-react'

export type PickerTone = 'blue' | 'purple' | 'pink' | 'amber'

const TONE: Record<
  PickerTone,
  { badge: string; chipOn: string; focus: string; accent: string; dot: string }
> = {
  blue: {
    badge: 'bg-blue-50 text-blue-700',
    chipOn: 'bg-blue-600 text-white ring-blue-600',
    focus: 'focus-within:ring-blue-400',
    accent: 'text-blue-600',
    dot: 'bg-blue-500',
  },
  purple: {
    badge: 'bg-purple-50 text-purple-700',
    chipOn: 'bg-purple-600 text-white ring-purple-600',
    focus: 'focus-within:ring-purple-400',
    accent: 'text-purple-600',
    dot: 'bg-purple-500',
  },
  pink: {
    badge: 'bg-pink-50 text-pink-700',
    chipOn: 'bg-pink-600 text-white ring-pink-600',
    focus: 'focus-within:ring-pink-400',
    accent: 'text-pink-600',
    dot: 'bg-pink-500',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700',
    chipOn: 'bg-amber-500 text-white ring-amber-500',
    focus: 'focus-within:ring-amber-400',
    accent: 'text-amber-600',
    dot: 'bg-amber-500',
  },
}

interface OptionPickerProps {
  label: string
  value: string
  options: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: string) => void
  tone?: PickerTone
  /** Placeholder for the search / custom-value field. */
  searchPlaceholder?: string
}

/**
 * A select that can also be typed into: the field filters the presets and,
 * when nothing matches, lets the user commit their own custom value.
 */
export function OptionPicker({
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
  tone = 'blue',
  searchPlaceholder = 'Search or type your own…',
}: OptionPickerProps) {
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const t = TONE[tone]

  // Reset the query whenever the panel closes so it opens fresh next time.
  useEffect(() => {
    if (!open) {
      setQuery('')
    } else {
      // Focus the field so the user can type straight away.
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  // Close when clicking anywhere outside this picker.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  const trimmed = query.trim()

  const filtered = useMemo(() => {
    if (!trimmed) return options
    const q = trimmed.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, trimmed])

  // Offer the typed text as a custom value when it isn't already a preset.
  const canUseCustom =
    trimmed.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmed.toLowerCase())

  const commit = (next: string) => {
    onChange(next)
    onOpenChange(false)
  }

  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
        {label}
      </label>

      <div className="relative" ref={wrapperRef}>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className={`w-full bg-white rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all flex items-center justify-between gap-2 ring-1 ${
            open ? 'ring-2 ring-indigo-400' : 'ring-slate-200 hover:ring-slate-300'
          }`}
        >
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold truncate ${t.badge}`}>
            {value}
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl overflow-hidden z-30 ring-1 ring-slate-200 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.25)] animate-in fade-in zoom-in-95 duration-150">
            {/* Search / custom entry */}
            <div
              className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/70 ring-inset focus-within:ring-2 ${t.focus}`}
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (canUseCustom) commit(trimmed)
                    else if (filtered.length > 0) commit(filtered[0])
                  }
                }}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
              />
              {trimmed && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto p-3">
              {/* Custom value affordance */}
              {canUseCustom && (
                <button
                  type="button"
                  onClick={() => commit(trimmed)}
                  className="w-full mb-2.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Use “{trimmed}”</span>
                </button>
              )}

              {filtered.length === 0 && !canUseCustom ? (
                <p className="text-xs text-slate-400 text-center py-4">No matches.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filtered.map((option) => {
                    const active = option === value
                    return (
                      <button
                        type="button"
                        key={option}
                        onClick={() => commit(option)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ring-1 inline-flex items-center gap-1.5 ${
                          active
                            ? t.chipOn
                            : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 shrink-0" />}
                        {option}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Hint footer */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/70">
              <p className="text-[10px] text-slate-400">
                Type your own value and press <span className="font-semibold text-slate-500">Enter</span> to use it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
