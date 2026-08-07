import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { GENERATION_API_URL } from '@/lib/generation-api'

/**
 * Resolves the generation backend URL from the credentials table.
 *
 * Stored under the `zoop` provider so it sits alongside the LLM keys in the
 * superadmin console rather than being a second, separate configuration
 * mechanism. Only the URL matters here — the backend takes no key today, which
 * is why an empty `api_key` is accepted.
 */
export async function resolveGenerationBackend(): Promise<{
  url: string
  source: 'database' | 'environment'
}> {
  const { data, error } = await supabaseAdmin
    .from('api_credentials')
    .select('base_url')
    .eq('provider', 'zoop')
    .eq('scope', 'platform')
    .eq('enabled', true)
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[generation] backend lookup failed:', error.message)
  }

  const url = data?.base_url?.trim()

  if (url) return { url: url.replace(/\/$/, ''), source: 'database' }

  return { url: GENERATION_API_URL, source: 'environment' }
}
