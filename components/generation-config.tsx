'use client'

import { createContext, useContext } from 'react'
import { GENERATION_API_URL } from '@/lib/generation-api'

/**
 * Generation backend URL, resolved server-side and handed to client pages.
 *
 * The value lives in `api_credentials` under the `zoop` provider so a
 * superadmin can repoint the backend without a redeploy. It is read once in
 * the shell layout rather than fetched per page: an extra round trip on every
 * generation screen would buy nothing, since the URL is not a secret.
 *
 * Falls back to the environment when no credential row exists, so generation
 * keeps working before anything is configured.
 */

const GenerationConfigContext = createContext<string>(GENERATION_API_URL)

export function GenerationConfigProvider({
  url,
  children,
}: {
  url: string
  children: React.ReactNode
}) {
  return (
    <GenerationConfigContext.Provider value={url || GENERATION_API_URL}>
      {children}
    </GenerationConfigContext.Provider>
  )
}

/** Base URL of the generation backend, without a trailing slash. */
export function useGenerationApi(): string {
  return useContext(GenerationConfigContext)
}

/** Join a path onto the backend URL. */
export function useGenerationUrl(): (path: string) => string {
  const base = useGenerationApi()

  return (path: string) => `${base}/${path.replace(/^\//, '')}`
}
