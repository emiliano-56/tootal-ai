import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  expandPlans,
  mergeLimits,
  entitlementFor,
  unlockedFeatures,
  applyGrants,
  currentPeriod,
  type Entitlement,
  type Limit,
  type Plan,
} from '@/lib/plans/entitlements'

/**
 * Resolving what an account may do, against the database.
 *
 * The merge rules live in lib/plans/entitlements and are unit tested; this
 * module only fetches. Reads use the service-role client because a user needs
 * their own limits resolved on paths where RLS would otherwise hide the
 * catalogue rows from them.
 */

export interface AccountEntitlements {
  limits: Record<string, Limit>
  usage: Record<string, number>
  plans: { code: string; name: string }[]
  unlocked: string[]
}

async function loadCatalogue(): Promise<Plan[]> {
  const [{ data: planRows }, { data: featureRows }] = await Promise.all([
    supabaseAdmin
      .from('plans')
      .select('id, code, name, is_bundle, includes, requires, tier, seats')
      .eq('active', true)
      // Sale order, so "Front End + Unlimited + OTO 2" reads up the funnel
      // rather than in whatever order the rows came back.
      .order('sort_order'),
    supabaseAdmin.from('plan_features').select('plan_id, feature, monthly_limit'),
  ])

  const features = new Map<string, Record<string, number | null>>()

  for (const row of featureRows ?? []) {
    const entry = row as { plan_id: string; feature: string; monthly_limit: number | null }
    const current = features.get(entry.plan_id) ?? {}

    current[entry.feature] = entry.monthly_limit
    features.set(entry.plan_id, current)
  }

  return (planRows ?? []).map((row) => {
    const plan = row as {
      id: string
      code: string
      name: string
      is_bundle: boolean
      includes: string[]
      requires: string | null
      tier: string | null
      seats: number | null
    }

    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      isBundle: plan.is_bundle,
      includes: plan.includes ?? [],
      requires: plan.requires,
      tier: plan.tier ?? plan.code,
      seats: plan.seats,
      features: features.get(plan.id) ?? {},
    }
  })
}

export async function entitlementsFor(userId: string): Promise<AccountEntitlements> {
  const [catalogue, { data: owned }, { data: usageRows }, { data: grantRows }] = await Promise.all([
    loadCatalogue(),
    supabaseAdmin.from('user_plans').select('plan_id').eq('user_id', userId),
    supabaseAdmin
      .from('feature_usage')
      .select('feature, used')
      .eq('user_id', userId)
      .eq('period', currentPeriod()),
    supabaseAdmin.from('user_feature_grants').select('feature, extra_monthly').eq('user_id', userId),
  ])

  const ownedIds = new Set((owned ?? []).map((row) => (row as { plan_id: string }).plan_id))
  const ownedPlans = catalogue.filter((plan) => ownedIds.has(plan.id))
  const effective = expandPlans(ownedPlans, catalogue)

  const usage: Record<string, number> = {}

  for (const row of usageRows ?? []) {
    const entry = row as { feature: string; used: number }
    usage[entry.feature] = entry.used
  }

  const grants: Record<string, number> = {}

  for (const row of grantRows ?? []) {
    const entry = row as { feature: string; extra_monthly: number }
    grants[entry.feature] = entry.extra_monthly
  }

  // A superadmin's per-account extras sit on top of whatever the plans give.
  const limits = applyGrants(mergeLimits(effective), grants)

  return {
    limits,
    usage,
    plans: effective.map((plan) => ({ code: plan.code, name: plan.name })),
    unlocked: unlockedFeatures(limits),
  }
}

/** Whether one feature may be used right now. */
export async function checkFeature(userId: string, feature: string): Promise<Entitlement> {
  const { limits, usage } = await entitlementsFor(userId)

  return entitlementFor(limits, feature, usage[feature] ?? 0)
}

/**
 * Whether a tier unlocks a feature at all.
 *
 * Different question from `checkFeature`: a customer who has used all ten of
 * this month's comics still *has* the comic tool. Screens that belong to a tier
 * — the DFY library, Autopilot — care about ownership, not about what is left.
 */
export async function hasFeature(userId: string, feature: string): Promise<boolean> {
  const { limits } = await entitlementsFor(userId)

  return feature in limits
}

export interface ConsumeResult {
  ok: boolean
  entitlement?: Entitlement
  error?: string
}

/**
 * Count one use, refusing when the monthly allowance is gone.
 *
 * The increment happens inside `consume_feature`, so two requests arriving
 * together cannot both read the old count and each decide they were under the
 * limit. The check here is for a readable message, not for correctness.
 */
export async function consumeFeature(userId: string, feature: string): Promise<ConsumeResult> {
  const { limits, usage } = await entitlementsFor(userId)

  if (!(feature in limits)) {
    return { ok: false, error: 'Your plan does not include this tool. Upgrade to unlock it.' }
  }

  const before = entitlementFor(limits, feature, usage[feature] ?? 0)

  if (!before.allowed) {
    return {
      ok: false,
      entitlement: before,
      error: `You have used all ${before.limit} of your monthly allowance for this tool. It resets on the 1st.`,
    }
  }

  const { error } = await supabaseAdmin.rpc('consume_feature', {
    p_user_id: userId,
    p_feature: feature,
    p_limit: limits[feature],
  })

  if (error) {
    // The function raises when a concurrent request took the last one.
    return {
      ok: false,
      entitlement: before,
      error: error.message.includes('Monthly limit reached')
        ? 'You have just used your last one for this month.'
        : error.message,
    }
  }

  const used = (usage[feature] ?? 0) + 1

  return { ok: true, entitlement: entitlementFor(limits, feature, used) }
}
