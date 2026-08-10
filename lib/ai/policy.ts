import type { ApiPolicyMode } from '@/lib/services/api-routing'

/**
 * Who is allowed to use whose API key.
 *
 * Three things have a say, and the order they resolve in is the whole point:
 *
 *   1. `allow_personal_api_keys` — the platform owner's master switch.
 *   2. `default_api_policy`      — what a new account gets.
 *   3. `profiles.api_policy`     — an override for one account.
 *
 * The master switch is a kill switch, not a default. Turning it off has to
 * shut personal keys down everywhere at once, including for accounts that were
 * individually granted them earlier — otherwise the owner flips it expecting
 * traffic to come back to the platform keys, and it silently does not, because
 * every account that matters has a per-user override sitting underneath.
 *
 * That also means the per-user setting is kept rather than erased when the
 * switch goes off. Flipping it back on restores exactly what was there before,
 * which is what someone toggling a switch expects.
 *
 * Pure, so the interaction between the three can be tested exhaustively.
 */

export const POLICY_MODES: {
  value: ApiPolicyMode
  label: string
  description: string
}[] = [
  {
    value: 'platform_only',
    label: 'Platform keys only',
    description: 'Everything runs on your keys. Users cannot add their own.',
  },
  {
    value: 'personal_allowed',
    label: 'Their key first, yours as backup',
    description:
      "The user's own key is tried first and yours covers them when it fails or runs out. This is the one that saves you money.",
  },
  {
    value: 'mixed',
    label: 'Whichever has priority',
    description:
      'Ownership is ignored and the priority order decides. Useful when your key is faster than theirs.',
  },
]

export function policyLabel(mode: ApiPolicyMode): string {
  return POLICY_MODES.find((entry) => entry.value === mode)?.label ?? mode
}

export function isPolicyMode(value: unknown): value is ApiPolicyMode {
  return POLICY_MODES.some((entry) => entry.value === value)
}

/**
 * Read a policy off a value that came out of jsonb or a form.
 *
 * Anything unrecognised becomes the safest mode rather than throwing: a typo
 * in a settings row must not take generation down, and `platform_only` is the
 * behaviour every installation had before this existed.
 */
export function toPolicyMode(value: unknown): ApiPolicyMode {
  return isPolicyMode(value) ? value : 'platform_only'
}

export interface PolicyInput {
  /** The platform owner's master switch. */
  allowPersonalKeys: boolean
  /** What an account with no override gets. */
  defaultPolicy?: ApiPolicyMode | null
  /** This account's override, if it has one. */
  userPolicy?: ApiPolicyMode | null
}

/** The mode that actually applies to one account, right now. */
export function effectivePolicy(input: PolicyInput): ApiPolicyMode {
  // The kill switch wins over everything, including a per-user grant.
  if (!input.allowPersonalKeys) return 'platform_only'

  return toPolicyMode(input.userPolicy ?? input.defaultPolicy ?? 'platform_only')
}

/**
 * Whether this account should be offered a place to put its own key.
 *
 * Deliberately the same question as "will the key be used". Showing someone a
 * key form whose contents are then ignored is worse than not showing it: they
 * paste a real credential, watch nothing change, and have no way to tell
 * whether the key or the feature is broken.
 */
export function canUsePersonalKeys(input: PolicyInput): boolean {
  return effectivePolicy(input) !== 'platform_only'
}

/**
 * What to tell the customer about where their generation is running.
 *
 * Worth saying plainly. Someone who has added a key wants to know it is
 * actually being used, and someone who has not wants to know they do not need
 * one.
 */
export function describePolicy(input: PolicyInput, hasOwnKey: boolean): string {
  const mode = effectivePolicy(input)

  if (mode === 'platform_only') {
    return 'Generation runs on the platform’s own AI keys. There is nothing for you to set up.'
  }

  if (!hasOwnKey) {
    return 'You can add your own AI key below. Until you do, generation runs on the platform’s keys.'
  }

  return mode === 'personal_allowed'
    ? 'Your own key is used first. If it fails or runs out, the platform’s key takes over so nothing breaks mid-job.'
    : 'Your key and the platform’s are both in the pool — whichever has the higher priority runs first.'
}
