import { CATALOG, type MessageKey } from '@/lib/i18n/catalog'
import { DEFAULT_LANGUAGE, language } from '@/lib/i18n/languages'

/**
 * Looking a string up, and filling in its placeholders.
 *
 * Pure and separate from the React context so the fallback rules — which are
 * the part that actually decides what a customer sees — can be tested without
 * rendering anything.
 *
 * The rules, in order:
 *
 *   1. The exact locale ('pt-BR' → the pt-BR file).
 *   2. The base language ('pt-BR' → the pt file). A Brazilian reader is far
 *      better served by European Portuguese than by English.
 *   3. English.
 *
 * A missing key never surfaces as a raw key. Half-translated screens are the
 * normal state of any app with 80-odd languages, and "start.cta" appearing on
 * a button is a bug report; the English word is merely untranslated.
 */

export type Messages = Partial<Record<string, string>>

export interface Values {
  [name: string]: string | number
}

/**
 * Replace `{name}` with a value.
 *
 * A placeholder with no matching value is left exactly as written rather than
 * blanked. It shows up in screenshots that way, which is how the missing value
 * gets noticed — an empty gap reads as a design choice.
 */
export function interpolate(template: string, values?: Values): string {
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole
  )
}

export function lookup(
  key: string,
  locale: Messages | undefined,
  base: Messages | undefined
): { text: string; translated: boolean } {
  const exact = locale?.[key]

  if (typeof exact === 'string' && exact.length > 0) return { text: exact, translated: true }

  const fromBase = base?.[key]

  if (typeof fromBase === 'string' && fromBase.length > 0) {
    return { text: fromBase, translated: true }
  }

  const english = (CATALOG as Record<string, string>)[key]

  // An unknown key is a programming mistake, not a translation gap. Returning
  // the key itself is the one case where showing it helps — it names the thing
  // that does not exist.
  return { text: english ?? key, translated: false }
}

export function translator(locale: Messages | undefined, base?: Messages) {
  return (key: MessageKey | string, values?: Values): string =>
    interpolate(lookup(key, locale, base).text, values)
}

/**
 * How much of the app this locale actually covers.
 *
 * Shown next to a language in the picker. Somebody choosing a language that is
 * a third done should know before the dashboard turns half English, rather
 * than after — and it tells the platform owner which files are worth running
 * the translation script over again.
 */
export function coverage(messages: Messages | undefined): number {
  const keys = Object.keys(CATALOG)

  if (keys.length === 0) return 1

  const done = keys.filter((key) => {
    const value = messages?.[key]

    return typeof value === 'string' && value.length > 0
  }).length

  return done / keys.length
}

/** English needs no file — it is the catalogue. */
export function isSourceLanguage(code: string | null | undefined): boolean {
  return (language(code)?.code ?? DEFAULT_LANGUAGE) === DEFAULT_LANGUAGE
}

/**
 * The files worth trying for a locale, most specific first.
 *
 * 'zh-TW' asks for zh-TW and then zh. A bare 'hi' asks only for hi — there is
 * no point requesting 'hi' twice.
 */
export function catalogChain(code: string): string[] {
  const resolved = language(code)?.code ?? DEFAULT_LANGUAGE

  if (resolved === DEFAULT_LANGUAGE) return []

  const base = resolved.split('-')[0]

  return base === resolved ? [resolved] : [resolved, base]
}
