/**
 * AI provider selection, priority and failover.
 *
 * Decides which credential handles the next request. Pure and synchronous so
 * the ordering rules — including the three per-user API policy modes — can be
 * tested exhaustively without calling a provider.
 */

export type AiProvider =
  | 'zoop'
  | 'deepseek'
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'openrouter'
  | 'custom'

export type ApiPolicyMode = 'platform_only' | 'personal_allowed' | 'mixed'

export interface Credential {
  id: string
  provider: AiProvider
  scope: 'platform' | 'user'
  enabled: boolean
  /** Lower runs first. */
  priority: number
  dailyLimit?: number | null
  monthlyLimit?: number | null
  usedToday?: number
  usedThisMonth?: number
  /** Set when the last health check failed; deprioritised, not removed. */
  lastTestOk?: boolean | null
}

export function isWithinLimits(credential: Credential): boolean {
  const { dailyLimit, monthlyLimit, usedToday = 0, usedThisMonth = 0 } = credential

  if (typeof dailyLimit === 'number' && usedToday >= dailyLimit) return false
  if (typeof monthlyLimit === 'number' && usedThisMonth >= monthlyLimit) return false

  return true
}

export function isUsable(credential: Credential): boolean {
  return credential.enabled && isWithinLimits(credential)
}

/**
 * Ordered failover chain for one request.
 *
 * Mode 1 `platform_only`   — user keys ignored entirely.
 * Mode 2 `personal_allowed` — the user's own keys first, platform as backup.
 * Mode 3 `mixed`            — priority decides, regardless of who owns the key.
 *
 * Within each group, lower `priority` wins; ties break on id so the order is
 * stable rather than dependent on however the rows came back from Postgres.
 * Credentials whose last health check failed sink to the end of their group —
 * still tried, because a stale failed check should not take a provider out of
 * service permanently.
 */
export function buildFailoverChain(
  credentials: Credential[],
  policy: ApiPolicyMode,
  options: { provider?: AiProvider } = {}
): Credential[] {
  let pool = credentials.filter(isUsable)

  if (options.provider) {
    pool = pool.filter((credential) => credential.provider === options.provider)
  }

  if (policy === 'platform_only') {
    pool = pool.filter((credential) => credential.scope === 'platform')
  }

  const rank = (credential: Credential) => {
    if (policy === 'personal_allowed') {
      return credential.scope === 'user' ? 0 : 1
    }

    // platform_only has one group; mixed ignores ownership entirely.
    return 0
  }

  return [...pool].sort((a, b) => {
    const group = rank(a) - rank(b)
    if (group !== 0) return group

    const healthA = a.lastTestOk === false ? 1 : 0
    const healthB = b.lastTestOk === false ? 1 : 0
    if (healthA !== healthB) return healthA - healthB

    if (a.priority !== b.priority) return a.priority - b.priority

    return a.id.localeCompare(b.id)
  })
}

export function selectCredential(
  credentials: Credential[],
  policy: ApiPolicyMode,
  options: { provider?: AiProvider } = {}
): Credential | null {
  return buildFailoverChain(credentials, policy, options)[0] ?? null
}
