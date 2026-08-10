'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Globe, Lock, Search } from 'lucide-react'
import {
  LANGUAGES,
  language,
  preferredLanguage,
  resolveAllowed,
  DEFAULT_LANGUAGE,
} from '@/lib/i18n/languages'
import { useLocale } from '@/components/locale-provider'

/**
 * Choosing the language a story is written in.
 *
 * The model could always write in any of these — it was simply never asked, so
 * everything came out English. The picker is deliberately small and sits next
 * to the idea field rather than in a settings panel: it changes what you get,
 * so it belongs where you decide what you want.
 *
 * Native names are shown first. Someone scanning for their own language finds
 * "हिन्दी" faster than "Hindi", and picks the right one more often.
 */

const ALL_CODES = LANGUAGES.map((entry) => entry.code)

/**
 * Which languages this account may generate in.
 *
 * Starts from the whole catalogue rather than from English alone, and that is
 * the important part. The old default was `['en']`, so between mount and the
 * answer arriving — and permanently if the request failed — the picker showed
 * one language and captioned it "83 more are on the higher tiers". That is a
 * lie in every case where the cause was a network blip rather than the plan,
 * and it is indistinguishable from the real thing.
 *
 * A restriction is only ever claimed once the server has actually said so.
 * `answered` carries that, so the upsell line can stay hidden until then.
 */
export function useAllowedLanguages(): {
  allowed: string[]
  loading: boolean
  answered: boolean
} {
  const [allowed, setAllowed] = useState<string[]>(ALL_CODES)
  const [loading, setLoading] = useState(true)
  const [answered, setAnswered] = useState(false)

  useEffect(() => {
    let cancelled = false

    // no-store because a stale answer here is invisible and wrong: the picker
    // would quietly offer whatever list the browser had cached from before a
    // plan change, or before the catalogue was extended.
    fetch('/api/languages', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return

        const resolved = resolveAllowed(payload)

        setAllowed(resolved.allowed)
        setAnswered(resolved.answered)
        setLoading(false)
      })
      .catch(() => {
        // Leave the full catalogue in place. Offering a language the plan does
        // not cover is a far smaller problem than hiding eighty of them.
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { allowed, loading, answered }
}

/**
 * A searchable dropdown rather than a `<select>`.
 *
 * Eighty-four options in a native select is a scroll, not a choice — and the
 * one thing a customer knows for certain is how their own language is spelled.
 * Typing "esp", "es" or "Spanish" all find Español, because someone hunting
 * for Deutsch should not have to know that English calls it German.
 */
export function LanguagePicker({
  value,
  onChange,
  allowed,
  className,
  label = 'Language',
  answered = true,
}: {
  value: string
  onChange: (code: string) => void
  allowed: string[]
  className?: string
  label?: string
  /**
   * Whether the server has actually said what this account may use. False
   * while the answer is in flight or after it failed — and the upsell line
   * stays hidden until it is true, because "N more on the higher tiers" is a
   * claim about someone's plan and must not be made on a guess.
   */
  answered?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const available = useMemo(
    () => LANGUAGES.filter((entry) => allowed.includes(entry.code)),
    [allowed]
  )

  const locked = LANGUAGES.length - available.length
  const current = language(value)

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

    // Opening a search box without focusing it makes the customer click twice.
    searchRef.current?.focus()

    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) return available

    return available.filter(
      (entry) =>
        entry.nativeName.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle) ||
        entry.code.toLowerCase().startsWith(needle)
    )
  }, [query, available])

  return (
    <div className={className} ref={boxRef}>
      <label className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        <Globe className="w-3.5 h-3.5 text-indigo-500" />
        {label}
        {/* The count, said out loud. It is the one number that makes "why am I
            only seeing some of them" answerable at a glance instead of by
            scrolling and counting. */}
        <span className="font-normal text-slate-400">· {available.length}</span>
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full h-11 px-3 flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <span className="flex-1 text-left truncate">
            {current?.nativeName ?? 'English'}
            {current && current.nativeName !== current.name ? (
              <span className="text-slate-400"> — {current.name}</span>
            ) : null}
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute z-50 mt-1.5 w-full max-h-72 flex flex-col rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search languages…"
                  className="flex-1 h-9 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-w-0"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1">
              {matches.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">Nothing found</p>
              )}

              {matches.map((entry) => {
                const active = entry.code === value

                return (
                  <button
                    key={entry.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(entry.code)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
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
          </div>
        )}
      </div>

      {answered && locked > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-400 flex items-start gap-1">
          <Lock className="w-3 h-3 shrink-0 mt-px" />
          <span>
            {locked} more {locked === 1 ? 'language is' : 'languages are'} on the higher tiers —{' '}
            <Link href="/credits" className="font-semibold text-indigo-600 hover:underline">
              see the upgrade
            </Link>
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * A language selection that remembers itself.
 *
 * Starts from the interface language, which is the behaviour that makes the
 * header switcher feel like it did something: pick Español up there and the
 * next comic comes out in Spanish without hunting for a second dropdown. It is
 * still only a *default* — the two are genuinely separate choices, and someone
 * running a Spanish-language business selling English comics needs to be able
 * to pull them apart.
 *
 * Once they do, the choice sticks. `touched` guards that: without it, changing
 * the interface language would silently overwrite a content language the
 * customer had deliberately set, which is the sort of thing that loses a
 * half-written brief.
 */
export function useLanguage(storageKey = 'comictale-language'): {
  value: string
  setValue: (code: string) => void
  allowed: string[]
  loading: boolean
  answered: boolean
} {
  const { allowed, loading, answered } = useAllowedLanguages()
  const { locale } = useLocale()
  const [value, setValue] = useState(DEFAULT_LANGUAGE)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (loading || touched) return

    const saved = window.localStorage.getItem(storageKey)

    if (saved && allowed.includes(saved)) {
      setValue(saved)
      return
    }

    // The interface language first, the browser's only as a last resort — the
    // customer has told us what they read; navigator.language is a guess.
    if (allowed.includes(locale)) {
      setValue(locale)
      return
    }

    setValue(preferredLanguage(navigator.language, allowed))
  }, [loading, allowed, storageKey, touched, locale])

  // A language that stops being allowed — after a downgrade — must not stay
  // selected, or every generation would be refused.
  useEffect(() => {
    if (!loading && !allowed.includes(value)) setValue(DEFAULT_LANGUAGE)
  }, [loading, allowed, value])

  return {
    value,
    setValue: (code: string) => {
      const resolved = language(code)?.code ?? DEFAULT_LANGUAGE

      setTouched(true)
      setValue(resolved)
      window.localStorage.setItem(storageKey, resolved)
    },
    allowed,
    loading,
    answered,
  }
}
