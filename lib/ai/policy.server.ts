import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ApiPolicyMode } from '@/lib/services/api-routing'
import { effectivePolicy, toPolicyMode, type PolicyInput } from '@/lib/ai/policy'

/**
 * Reading the API policy that applies to a request.
 *
 * The two platform settings are cached in module scope for a minute. Every
 * single AI call would otherwise cost two extra round trips to read a pair of
 * values that change roughly never, and the agents make a lot of calls.
 *
 * The per-user override is not cached. It is one indexed lookup on a row the
 * request is about to touch anyway, and caching it would mean a superadmin
 * granting someone personal keys sees nothing happen for up to a minute —
 * which reads as the feature being broken.
 */

let cached: { allowPersonalKeys: boolean; defaultPolicy: ApiPolicyMode; at: number } | null = null

const TTL_MS = 60_000

/** Forget the cache, so a save in the console takes effect at once. */
export function clearPolicyCache(): void {
  cached = null
}

async function platformPolicy(): Promise<{
  allowPersonalKeys: boolean
  defaultPolicy: ApiPolicyMode
}> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached

  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value')
    .in('key', ['allow_personal_api_keys', 'default_api_policy'])

  const rows = (data ?? []) as { key: string; value: unknown }[]
  const valueOf = (key: string) => rows.find((row) => row.key === key)?.value

  const resolved = {
    // The column is jsonb, so `false` arrives as a real boolean. Anything else
    // — including the row being absent before migration 006 — is treated as
    // off, which is the behaviour every installation had before this existed.
    allowPersonalKeys: valueOf('allow_personal_api_keys') === true,
    defaultPolicy: toPolicyMode(valueOf('default_api_policy')),
    at: Date.now(),
  }

  cached = resolved

  return resolved
}

/** The override on one account, or null when it has none. */
async function userPolicy(userId: string): Promise<ApiPolicyMode | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('api_policy')
    .eq('id', userId)
    .maybeSingle()

  const value = (data as { api_policy: unknown } | null)?.api_policy

  return value == null ? null : toPolicyMode(value)
}

/**
 * Everything the policy decision needs, for one account.
 *
 * `knownPolicy` lets a caller that already holds the profile row skip the
 * lookup — which is every AI call, since the session was just read. Pass
 * `undefined` to have it fetched and `null` to mean "no override".
 */
export async function policyInputFor(
  userId?: string | null,
  knownPolicy?: string | null
): Promise<PolicyInput> {
  const platform = await platformPolicy()

  if (!userId) return platform

  if (knownPolicy !== undefined) {
    return { ...platform, userPolicy: knownPolicy == null ? null : toPolicyMode(knownPolicy) }
  }

  return { ...platform, userPolicy: await userPolicy(userId) }
}

/**
 * The mode that applies to one request.
 *
 * A signed-out or unknown caller gets `platform_only`: there is no personal key
 * to prefer, and the failure mode of guessing otherwise is that a request goes
 * looking for credentials belonging to nobody.
 */
export async function policyFor(
  userId?: string | null,
  knownPolicy?: string | null
): Promise<ApiPolicyMode> {
  if (!userId) return 'platform_only'

  return effectivePolicy(await policyInputFor(userId, knownPolicy))
}
