'use client'

/**
 * Client helper for spending a monthly allowance.
 *
 * Replaces the old `deductCredits` that each generation page carried its own
 * copy of. The count is applied server-side — this only asks and reports the
 * answer, so skipping it in the browser gains nothing.
 */

export interface FeatureCheck {
  ok: boolean
  error?: string
  entitlement?: {
    limit: number | null
    used: number
    remaining: number | null
    unlimited: boolean
  }
}

/** Spend one use. Returns false with a message when the allowance is gone. */
export async function consumeFeature(feature: string): Promise<FeatureCheck> {
  try {
    const response = await fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return { ok: false, error: payload.error ?? 'Could not start that generation.' }
    }

    return { ok: true, entitlement: payload.entitlement }
  } catch {
    return { ok: false, error: 'Network error — please try again.' }
  }
}

/** Ask without spending, for disabling a button up front. */
export async function checkFeature(feature: string): Promise<FeatureCheck> {
  try {
    const response = await fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, mode: 'check' }),
    })

    const payload = await response.json().catch(() => ({}))

    return { ok: Boolean(payload.ok), entitlement: payload.entitlement, error: payload.error }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}
