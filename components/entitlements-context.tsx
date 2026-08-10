'use client'

import { createContext, useContext, useMemo } from 'react'
import { entitlementFor, type Entitlement, type Limit } from '@/lib/plans/entitlements'

/**
 * The signed-in account's plan and monthly allowances.
 *
 * Resolved once on the server in the shell layout and handed down, so every
 * screen can show what is left without each one fetching it. Display only —
 * spending still goes through /api/usage, which counts server-side.
 */

export interface EntitlementsValue {
  limits: Record<string, Limit>
  usage: Record<string, number>
  plans: { code: string; name: string }[]
  unlocked: string[]
  /**
   * Whether this account may run generation on its own AI key.
   *
   * Carried here rather than fetched, because the only consumer is the sidebar
   * — and a nav item that costs a request to decide whether to render is a
   * request on every single page load.
   */
  personalKeys?: boolean
}

const EMPTY: EntitlementsValue = {
  limits: {},
  usage: {},
  plans: [],
  unlocked: [],
  personalKeys: false,
}

const EntitlementsContext = createContext<EntitlementsValue>(EMPTY)

export function EntitlementsProvider({
  value,
  children,
}: {
  value: EntitlementsValue
  children: React.ReactNode
}) {
  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>
}

export function useEntitlements(): EntitlementsValue {
  return useContext(EntitlementsContext)
}

/** What is left for one tool right now. */
export function useFeature(feature: string): Entitlement {
  const { limits, usage } = useEntitlements()

  return useMemo(
    () => entitlementFor(limits, feature, usage[feature] ?? 0),
    [limits, usage, feature]
  )
}

/** The plan names to show, e.g. "Front End + Unlimited". */
export function usePlanLabel(): string {
  const { plans } = useEntitlements()

  if (plans.length === 0) return 'No plan'

  // A bundle already implies the rest, so naming it alone reads better than
  // listing seven products.
  const bundle = plans.find((plan) => plan.code === 'mega')

  if (bundle) return bundle.name

  return plans.map((plan) => plan.name).join(' + ')
}
