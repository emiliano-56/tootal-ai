'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { MessageKey } from '@/lib/i18n/catalog'
import { DEFAULT_LANGUAGE, isRtl, language, preferredLanguage } from '@/lib/i18n/languages'
import {
  catalogChain,
  coverage,
  translator,
  type Messages,
  type Values,
} from '@/lib/i18n/translate'
import { loadMessages } from '@/lib/i18n/load'

/**
 * The language the interface is shown in.
 *
 * Separate from the language a comic is *written* in, and deliberately so: a
 * customer in Mumbai may well want the app in Hindi and the comic in English
 * because that is what their buyers read. The two are linked by a default —
 * changing the interface language moves the content default with it — and can
 * then be pulled apart per generation.
 *
 * Catalogues are loaded on demand rather than bundled. Eighty-odd languages of
 * strings in the initial payload would cost every visitor the whole world's
 * translations to read one of them.
 *
 * There is a brief flash of English on first paint for a non-English locale.
 * That is the honest trade for keeping the choice client-side: the alternative
 * is a cookie read in the server layout, which would opt the whole shell out
 * of static rendering to save a few hundred milliseconds of one screen.
 */

const STORAGE_KEY = 'comictale-ui-language'

interface LocaleValue {
  /** The interface language. */
  locale: string
  setLocale: (code: string) => void
  t: (key: MessageKey | string, values?: Values) => string
  /** 0–1. Below 1 means parts of the app are still English. */
  coverage: number
  loading: boolean
  rtl: boolean
}

const FALLBACK: LocaleValue = {
  locale: DEFAULT_LANGUAGE,
  setLocale: () => {},
  t: translator(undefined),
  coverage: 1,
  loading: false,
  rtl: false,
}

const LocaleContext = createContext<LocaleValue>(FALLBACK)

async function loadCatalog(code: string): Promise<{ messages: Messages; base: Messages }> {
  const chain = catalogChain(code)

  if (chain.length === 0) return { messages: {}, base: {} }

  // Only the requested locale's file is ever downloaded, and `loadMessages`
  // caches so switching back is instant.
  const [messages, base] = await Promise.all([
    loadMessages(chain[0]),
    chain[1] ? loadMessages(chain[1]) : Promise.resolve({} as Messages),
  ])

  return { messages, base }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(DEFAULT_LANGUAGE)
  const [messages, setMessages] = useState<Messages>({})
  const [base, setBase] = useState<Messages>({})
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Start from what they chose last, or from the browser.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    const resolved = saved
      ? (language(saved)?.code ?? DEFAULT_LANGUAGE)
      : preferredLanguage(navigator.language, [DEFAULT_LANGUAGE])

    setLocaleState(resolved)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return

    let cancelled = false

    setLoading(true)

    loadCatalog(locale).then((loaded) => {
      if (cancelled) return

      setMessages(loaded.messages)
      setBase(loaded.base)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [locale, ready])

  // Screen readers announce in the wrong voice without `lang`, and an RTL
  // script laid out left-to-right is not merely ugly — it is unreadable.
  useEffect(() => {
    if (!ready) return

    const entry = language(locale)

    document.documentElement.lang = entry?.code ?? DEFAULT_LANGUAGE
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  }, [locale, ready])

  const setLocale = useCallback((code: string) => {
    const resolved = language(code)?.code ?? DEFAULT_LANGUAGE

    setLocaleState(resolved)
    window.localStorage.setItem(STORAGE_KEY, resolved)
  }, [])

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale,
      t: translator(messages, base),
      coverage: locale === DEFAULT_LANGUAGE ? 1 : coverage({ ...base, ...messages }),
      loading,
      rtl: isRtl(locale),
    }),
    [locale, setLocale, messages, base, loading]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  return useContext(LocaleContext)
}

/** The common case: just the translate function. */
export function useT() {
  return useLocale().t
}
