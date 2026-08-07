/**
 * Credential masking.
 *
 * Kept out of the component so it can be tested without pulling in the
 * Supabase client — and because masking is the only thing standing between a
 * stored credential and a screenshot, it deserves its own tests.
 */

/**
 * Show only the first and last four characters.
 *
 * Anything eight characters or shorter is masked completely: a first/last-four
 * rule on a short key would reveal all of it.
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••'

  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}
