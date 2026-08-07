'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, Check, Lock, Plus, X, Infinity as InfinityIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import {
  FEATURES,
  chainOrder,
  canGrantPlan,
  dependentsOf,
  effectiveHoldings,
  expandPlans,
  mergeLimits,
  applyGrants,
} from '@/lib/plans/entitlements'
import { roleFromPlans, seatBreakdown, type PlanWithRole } from '@/lib/plans/roles'
import { Banner, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'

/**
 * One account's tiers and extra allowances.
 *
 * The tiers are shown in sale order with the next one to buy highlighted,
 * because the chain is the product: an admin should be able to see at a glance
 * how far up the funnel a customer is.
 */

interface PlanRow {
  id: string
  code: string
  name: string
  is_bundle: boolean
  includes: string[]
  requires: string | null
  sort_order: number
  tier: string | null
  seats: number | null
  grants_role: string | null
}

interface FeatureRow {
  plan_id: string
  feature: string
  monthly_limit: number | null
}

export function UserPlansPanel({
  userId,
  email,
  onClose,
}: {
  userId: string
  email: string
  onClose: () => void
}) {
  const [catalogue, setCatalogue] = useState<PlanWithRole[]>([])
  const [owned, setOwned] = useState<string[]>([])
  const [grants, setGrants] = useState<Record<string, number>>({})
  // How many extra of each kind this account may KEEP, as opposed to make.
  const [keepGrants, setKeepGrants] = useState<Record<string, number>>({})
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data: planRows }, { data: featureRows }, { data: ownedRows }, { data: grantRows }, { data: usageRows }] =
      await Promise.all([
        supabase
          .from('plans')
          .select('id, code, name, is_bundle, includes, requires, sort_order, tier, seats, grants_role')
          .order('sort_order'),
        supabase.from('plan_features').select('plan_id, feature, monthly_limit'),
        supabase.from('user_plans').select('plan_id').eq('user_id', userId),
        supabase
          .from('user_feature_grants')
          .select('feature, extra_monthly, extra_library')
          .eq('user_id', userId),
        supabase.from('feature_usage').select('feature, used').eq('user_id', userId),
      ])

    const features = new Map<string, Record<string, number | null>>()

    for (const row of (featureRows as FeatureRow[]) ?? []) {
      const current = features.get(row.plan_id) ?? {}
      current[row.feature] = row.monthly_limit
      features.set(row.plan_id, current)
    }

    const list: PlanWithRole[] = ((planRows as PlanRow[]) ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isBundle: row.is_bundle,
      includes: row.includes ?? [],
      requires: row.requires,
      tier: row.tier ?? row.code,
      seats: row.seats,
      grantsRole: (row.grants_role as PlanWithRole['grantsRole']) ?? null,
      features: features.get(row.id) ?? {},
    }))

    const ownedIds = new Set(((ownedRows as { plan_id: string }[]) ?? []).map((r) => r.plan_id))

    setCatalogue(list)
    setOwned(list.filter((plan) => ownedIds.has(plan.id)).map((plan) => plan.code))
    const grantList =
      (grantRows as { feature: string; extra_monthly: number; extra_library: number }[]) ?? []

    setGrants(Object.fromEntries(grantList.map((r) => [r.feature, r.extra_monthly ?? 0])))
    setKeepGrants(Object.fromEntries(grantList.map((r) => [r.feature, r.extra_library ?? 0])))
    setUsage(
      Object.fromEntries(
        ((usageRows as { feature: string; used: number }[]) ?? []).map((r) => [r.feature, r.used])
      )
    )
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const call = async (payload: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    setNotice('')

    const response = await fetch('/api/console/entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, userId }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) setError(result.error ?? 'Something went wrong')
    else await load()

    setBusy(false)
    return { ok: response.ok, result }
  }

  const toggle = async (plan: PlanWithRole) => {
    if (owned.includes(plan.code)) {
      const alsoLost = plan.isBundle ? [] : dependentsOf(plan.code, catalogue).filter((c) => owned.includes(c))

      if (alsoLost.length > 0) {
        const names = alsoLost
          .map((code) => catalogue.find((p) => p.code === code)?.name ?? code)
          .join(', ')

        if (!window.confirm(`Removing ${plan.name} also removes ${names}. Continue?`)) return
      }

      const { ok, result } = await call({ action: 'revoke', code: plan.code })

      if (ok) {
        const promotion = result?.promotion as { role?: string } | undefined

        setNotice(
          promotion?.role === 'user'
            ? `${plan.name} removed — account is back to a normal user.`
            : `${plan.name} removed.`
        )
      }

      return
    }

    // The licence sizes of one tier are alternatives, so granting one drops
    // the other. Say so before it happens.
    const check = canGrantPlan(plan, owned, catalogue)

    if (check.replaces) {
      const previous = catalogue.find((p) => p.code === check.replaces)?.name ?? check.replaces

      if (!window.confirm(`${plan.name} replaces ${previous}. Continue?`)) return
    }

    const { ok, result } = await call({ action: 'grant', code: plan.code })

    if (ok) {
      const promotion = result?.promotion as
        | { role?: string; seats?: number; breakdown?: string }
        | undefined

      setNotice(
        promotion?.role && promotion.role !== 'user'
          ? `${plan.name} granted — account is now a ${promotion.role.replace('_', ' ')} with ${promotion.seats ?? '—'} seats${
              promotion.breakdown?.includes('+') ? ` (${promotion.breakdown})` : ''
            }.`
          : `${plan.name} granted.`
      )
    }
  }

  const setKeepExtra = async (feature: string) => {
    const current = keepGrants[feature] ?? 0
    const input = window.prompt(
      `Extra items this account may KEEP for ${FEATURES.find((f) => f.key === feature)?.label}\n(added on top of the plan's library limit — 0 to remove)`,
      String(current)
    )

    if (input === null) return

    const { ok } = await call({ action: 'grant_library', feature, extra: Number(input) })
    if (ok) setNotice('Keep-limit updated for this account.')
  }

  const setExtra = async (feature: string) => {
    const current = grants[feature] ?? 0
    const input = window.prompt(
      `Extra monthly allowance for ${FEATURES.find((f) => f.key === feature)?.label}\n(added on top of the plan, every month — 0 to remove)`,
      String(current)
    )

    if (input === null) return

    const { ok } = await call({ action: 'grant_extra', feature, extra: Number(input) })
    if (ok) setNotice('Extra allowance updated.')
  }

  // What the account actually ends up with, including the extras.
  const ownedPlans = catalogue.filter((plan) => owned.includes(plan.code))
  const limits = applyGrants(mergeLimits(expandPlans(ownedPlans, catalogue)), grants)

  // Includes tiers the bundle grants, so the checkboxes match what the
  // account can actually use.
  const holdings = effectiveHoldings(owned, catalogue)

  const ordered = chainOrder(catalogue)

  // What the tiers add up to as an account type — the thing an operator is
  // usually checking when they open this panel.
  const account = roleFromPlans(owned, catalogue)

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl my-4 sm:my-8 bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Access &amp; allowances
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{email}</p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {error && <Banner tone="error">{error}</Banner>}
          {notice && <Banner tone="ok">{notice}</Banner>}

          {/* Tiers */}
          <div>
            <SectionHeading
              title="Versions owned"
              hint="Sold in order — each tier needs the one before it. The bundle stands alone."
            />

            {account.role && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-200 dark:ring-violet-500/20 px-3 py-2">
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 capitalize">
                  {account.role.replace('_', ' ')} account
                </span>
                <span className="text-[11px] text-violet-600 dark:text-violet-400 tabular-nums">
                  {account.seats ?? 0} seats
                  {account.licences.length > 1 && ` — ${seatBreakdown(account.licences)}`}
                </span>
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {ordered.map((plan) => {
                  const held = holdings.find((entry) => entry.code === plan.code)
                  const has = Boolean(held)
                  // Arrived through the bundle: shown as held, but only the
                  // bundle itself can take it away.
                  const viaBundle = has && !held!.direct
                  const check = canGrantPlan(plan, owned, catalogue)
                  const blocked = !has && !check.allowed

                  return (
                    <label
                      key={plan.code}
                      className={`flex items-center gap-3 p-3 rounded-xl ring-1 transition-colors ${
                        has
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-200 dark:ring-emerald-500/20'
                          : blocked
                            ? 'bg-slate-50 dark:bg-slate-800/50 ring-slate-200 dark:ring-slate-700 opacity-60'
                            : 'bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-700 cursor-pointer hover:ring-indigo-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={busy || blocked || viaBundle}
                        onChange={() => toggle(plan)}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          {plan.name}
                          {plan.isBundle && (
                            <span className="text-[9px] font-bold text-violet-600 uppercase">bundle</span>
                          )}
                          {viaBundle && (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase">
                              via bundle
                            </span>
                          )}
                          {typeof plan.seats === 'number' && (
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                              {plan.seats} seats
                            </span>
                          )}
                        </p>

                        {viaBundle && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Included in the bundle — remove the bundle to take it away.
                          </p>
                        )}

                        {!has && check.replaces && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Replaces{' '}
                            {catalogue.find((p) => p.code === check.replaces)?.name ?? check.replaces}
                            .
                          </p>
                        )}

                        {blocked && !viaBundle && check.reason && (
                          <p className="text-[11px] text-amber-600 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {check.reason}
                          </p>
                        )}
                      </div>

                      {has && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resulting allowances, with per-feature extras */}
          <div>
            <SectionHeading
              title="Monthly allowance"
              hint="Two different limits: + grants more generations a month, the archive icon lets them keep more in their library."
            />

            <div className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {FEATURES.map((feature) => {
                const owns = feature.key in limits
                const limit = limits[feature.key]
                const extra = grants[feature.key] ?? 0
                const used = usage[feature.key] ?? 0

                return (
                  <div key={feature.key} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${owns ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}
                      >
                        {feature.label}
                      </p>
                      {extra > 0 && (
                        <p className="text-[11px] text-indigo-600">+{extra} a month granted</p>
                      )}
                      {(keepGrants[feature.key] ?? 0) > 0 && (
                        <p className="text-[11px] text-violet-600">
                          +{keepGrants[feature.key]} extra kept in their library
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {!owns ? (
                          <span className="text-slate-400">Locked</span>
                        ) : limit === null ? (
                          <InfinityIcon className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <>
                            {used} / {limit} used
                          </>
                        )}
                      </span>

                      <button
                        onClick={() => setExtra(feature.key)}
                        disabled={busy || !owns}
                        title={owns ? 'Grant extra generations a month' : 'Not in their plan'}
                        aria-label={`Grant extra ${feature.label} generations`}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {/* Making and keeping are separate limits, so they get
                          separate controls rather than one ambiguous one. */}
                      <button
                        onClick={() => setKeepExtra(feature.key)}
                        disabled={busy || !owns}
                        title={owns ? 'Let them keep more in their library' : 'Not in their plan'}
                        aria-label={`Let them keep more ${feature.label}`}
                        className="p-1.5 rounded-lg text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end p-5 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

export { Field }
