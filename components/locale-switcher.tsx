'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Globe, Loader2, Search } from 'lucide-react'
import { LANGUAGES, language } from '@/lib/i18n/languages'
import { useLocale } from '@/components/locale-provider'

/**
 * The interface language, in the header.
 *
 * A dropdown with a search box rather than a plain `<select>`, because eighty
 * languages in a native select is a scroll, not a choice. Typing "esp", "es"
 * or "Spanish" all find Español — a customer looking for their own language
 * types it the way they write it, not the way English names it.
 *
 * Coverage is shown honestly. A language the translation script has not been
 * run over yet still works, it just leaves parts in English, and someone
 * picking it deserves to know that before the dashboard half-changes.
 */

export function LocaleSwitcher() {
  const { locale, setLocale, coverage, loading, t } = useLocale()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const current = language(locale)

  useEffect(() => {
    if (!open) return

    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)

    // Opening a search box and not focusing it makes the customer click twice.
    searchRef.current?.focus()

    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) return LANGUAGES

    // Native name, English name and code all match: someone hunting for
    // Deutsch should not have to know the app calls it German.
    return LANGUAGES.filter(
      (entry) =>
        entry.nativeName.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle) ||
        entry.code.toLowerCase().startsWith(needle)
    )
  }, [query])

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('lang.interface')}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Globe className="w-4 h-4" />
        )}
        <span className="text-sm font-medium hidden sm:inline max-w-[9rem] truncate">
          {current?.nativeName ?? 'English'}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-72 max-h-[26rem] flex flex-col rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden z-50"
        >
          <div className="p-2.5 border-b border-slate-100">
            <p className="px-1 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {t('lang.interface')}
            </p>

            <div className="flex items-center gap-2 px-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('lang.searchPlaceholder')}
                className="flex-1 h-9 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none min-w-0"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {matches.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                {query} — nothing found
              </p>
            )}

            {matches.map((entry) => {
              const active = entry.code === locale

              return (
                <button
                  key={entry.code}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLocale(entry.code)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
                    active ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{entry.nativeName}</span>
                    {entry.nativeName !== entry.name && (
                      <span className="block text-[11px] text-slate-400 truncate">
                        {entry.name}
                      </span>
                    )}
                  </span>

                  {active && <Check className="w-4 h-4 shrink-0 text-indigo-600" />}
                </button>
              )
            })}
          </div>

          {/* Only worth saying when it is actually true. */}
          {coverage < 0.999 && (
            <p className="px-3.5 py-2.5 border-t border-slate-100 text-[11px] text-amber-700 bg-amber-50/60">
              {t('lang.partialWarning')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
