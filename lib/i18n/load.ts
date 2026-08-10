import type { Messages } from '@/lib/i18n/translate'

/**
 * Fetching one language's strings.
 *
 * Lives next to the JSON rather than in the provider so the import specifier
 * can be relative. A dynamic import with a path alias in it — `@/lib/i18n/ui/
 * ${code}.json` — leaves the bundler resolving an alias inside a context
 * module, which works in some setups and silently resolves to nothing in
 * others; the failure mode is every language quietly falling back to English,
 * which looks exactly like "the translations were never generated". A relative
 * specifier gives the bundler a real directory to build the context from.
 *
 * The `webpackInclude` hint keeps the context to JSON files, so nothing else
 * that lands in the folder gets pulled into the bundle.
 */

const cache = new Map<string, Messages>()

export async function loadMessages(code: string): Promise<Messages> {
  const hit = cache.get(code)

  if (hit) return hit

  try {
    const loaded = (await import(
      /* webpackInclude: /\.json$/ */
      `./ui/${code}.json`
    )) as { default: Messages }

    const messages = loaded.default ?? {}

    cache.set(code, messages)

    return messages
  } catch {
    // No file for this language yet. English is the answer, not an error —
    // and caching the miss stops every render retrying the same failed import.
    cache.set(code, {})

    return {}
  }
}
