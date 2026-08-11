'use client'

import { createContext, useContext } from 'react'

/**
 * Where the browser sends generation requests.
 *
 * It used to be the backend's own URL, and every page called it directly.
 * That broke on deployment: the backend answers a CORS preflight with HTTP
 * 400 and no `Access-Control-Allow-Origin`, so the browser refused every
 * request before sending it. Nothing on this side can add a header to
 * somebody else's response, so the request stops being cross-origin instead.
 *
 * So this is now a path on our own origin, and `/api/generate/[...path]`
 * forwards it. Every caller already builds its URL from here — as
 * `${API}/coloring/generate-image` — so pointing this one value at the proxy
 * fixed the comic generator, the colouring book, both agents, the cover
 * designer, the video studio and the panel editor at once.
 *
 * The provider still takes a `url` so the shell layout can keep resolving the
 * configured backend; that value is what the *server* uses, and it is no
 * longer shipped to the browser at all.
 */

const PROXY_BASE = '/api/generate'

const GenerationConfigContext = createContext<string>(PROXY_BASE)

export function GenerationConfigProvider({
  url,
  children,
}: {
  /**
   * The configured backend. Not passed to the browser — it is resolved again
   * server-side inside the proxy, which is the only place that needs it.
   */
  url?: string
  children: React.ReactNode
}) {
  return (
    <GenerationConfigContext.Provider value={PROXY_BASE}>
      {children}
    </GenerationConfigContext.Provider>
  )
}

/** Base to build generation URLs from. Same-origin, so there is no CORS. */
export function useGenerationApi(): string {
  return useContext(GenerationConfigContext)
}

/** Join a path onto it. */
export function useGenerationUrl(): (path: string) => string {
  const base = useGenerationApi()

  return (path: string) => `${base}/${path.replace(/^\//, '')}`
}
