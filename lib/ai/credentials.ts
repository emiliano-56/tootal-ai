import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildFailoverChain,
  type AiProvider,
  type ApiPolicyMode,
  type Credential,
} from '@/lib/services/api-routing'

/**
 * Resolves which AI credential to use for a request.
 *
 * Keys live in the `api_credentials` table and are managed from the superadmin
 * console, so rotating one is a UI action rather than a redeploy. The lookup
 * uses the service-role client on purpose: RLS hides platform keys from
 * everyone below superadmin, and an ordinary user's request still needs one —
 * the key is used server-side and never reaches the browser.
 *
 * The environment variable remains a fallback so the app keeps working before
 * any key has been entered, and so a misconfigured database cannot take
 * generation down entirely.
 */

const ENV_FALLBACK: Partial<Record<AiProvider, string | undefined>> = {
  deepseek: process.env.DEEPSEEK_API_KEY?.trim(),
}

const DEFAULT_BASE_URL: Record<AiProvider, string> = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  zoop: process.env.NEXT_PUBLIC_API_URL?.trim() ?? '',
  custom: '',
}

const DEFAULT_MODEL: Partial<Record<AiProvider, string>> = {
  deepseek: 'deepseek-chat',
}

export interface ResolvedCredential {
  /** Null when the key came from the environment rather than the table. */
  id: string | null
  provider: AiProvider
  apiKey: string
  baseUrl: string
  model: string
  source: 'database' | 'environment'
}

interface CredentialRow {
  id: string
  provider: AiProvider
  scope: 'platform' | 'user'
  api_key: string
  base_url: string | null
  model: string | null
  enabled: boolean
  priority: number
  daily_limit: number | null
  monthly_limit: number | null
  last_test_ok: boolean | null
}

/** Calls already made today and this month, used to honour usage limits. */
async function usageFor(credentialIds: string[]) {
  if (credentialIds.length === 0) return new Map<string, { today: number; month: number }>()

  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { data } = await supabaseAdmin
    .from('api_usage_logs')
    .select('credential_id, created_at')
    .in('credential_id', credentialIds)
    .gte('created_at', startOfMonth.toISOString())

  const counts = new Map<string, { today: number; month: number }>()

  for (const entry of data ?? []) {
    const row = entry as { credential_id: string | null; created_at: string }

    if (!row.credential_id) continue

    const current = counts.get(row.credential_id) ?? { today: 0, month: 0 }

    current.month++
    if (row.created_at >= startOfDay.toISOString()) current.today++

    counts.set(row.credential_id, current)
  }

  return counts
}

/**
 * The ordered list of credentials to try for one request.
 *
 * Returns every usable option rather than just the first, so a caller can fall
 * through when a provider errors instead of failing the whole job.
 */
export async function resolveCredentials(
  provider: AiProvider,
  options: { userId?: string; policy?: ApiPolicyMode } = {}
): Promise<ResolvedCredential[]> {
  const policy: ApiPolicyMode = options.policy ?? 'platform_only'

  let query = supabaseAdmin
    .from('api_credentials')
    .select('id, provider, scope, api_key, base_url, model, enabled, priority, daily_limit, monthly_limit, last_test_ok')
    .eq('provider', provider)
    .eq('enabled', true)

  // Personal keys are only in play when the user's policy allows them.
  if (policy === 'platform_only' || !options.userId) {
    query = query.eq('scope', 'platform')
  } else {
    query = query.or(`scope.eq.platform,owner_id.eq.${options.userId}`)
  }

  const { data, error } = await query

  const rows = (data as CredentialRow[]) ?? []

  if (error) {
    console.error('[ai] credential lookup failed:', error.message)
  }

  const usage = await usageFor(rows.map((row) => row.id))

  const chain = buildFailoverChain(
    rows.map<Credential>((row) => ({
      id: row.id,
      provider: row.provider,
      scope: row.scope,
      enabled: row.enabled,
      priority: row.priority,
      dailyLimit: row.daily_limit,
      monthlyLimit: row.monthly_limit,
      usedToday: usage.get(row.id)?.today ?? 0,
      usedThisMonth: usage.get(row.id)?.month ?? 0,
      lastTestOk: row.last_test_ok,
    })),
    policy,
    { provider }
  )

  const resolved: ResolvedCredential[] = chain.map((credential) => {
    const row = rows.find((entry) => entry.id === credential.id)!

    return {
      id: row.id,
      provider: row.provider,
      apiKey: row.api_key,
      baseUrl: row.base_url?.trim() || DEFAULT_BASE_URL[provider],
      model: row.model?.trim() || DEFAULT_MODEL[provider] || '',
      source: 'database',
    }
  })

  // Environment fallback goes last: a key managed in the console should always
  // win over one baked into the deployment.
  const envKey = ENV_FALLBACK[provider]

  if (envKey) {
    resolved.push({
      id: null,
      provider,
      apiKey: envKey,
      baseUrl: DEFAULT_BASE_URL[provider],
      model: DEFAULT_MODEL[provider] || '',
      source: 'environment',
    })
  }

  return resolved
}

/** Record one call so usage limits and the analytics screen have data. */
export async function logApiUsage(entry: {
  credentialId: string | null
  provider: AiProvider
  userId?: string | null
  tenantId?: string | null
  operation?: string
  latencyMs?: number
  succeeded: boolean
  errorMessage?: string
}) {
  const { error } = await supabaseAdmin.from('api_usage_logs').insert({
    credential_id: entry.credentialId,
    provider: entry.provider,
    user_id: entry.userId ?? null,
    tenant_id: entry.tenantId ?? null,
    operation: entry.operation ?? null,
    latency_ms: entry.latencyMs ?? null,
    succeeded: entry.succeeded,
    error_message: entry.errorMessage ?? null,
  })

  // Never let logging failure break the request it describes.
  if (error) console.error('[ai] usage log failed:', error.message)
}
