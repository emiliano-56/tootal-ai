'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Save, RefreshCw, Plus, Trash2, Infinity as InfinityIcon, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import {
  FEATURES,
  mergeLimits,
  expandPlans,
  unlockedFeatures,
  type Plan,
} from '@/lib/plans/entitlements'
import { PageHeader, ConfirmDialog } from '@/components/console/console-ui'
import { Banner, Dialog, Field, inputClass, SectionHeading } from '@/components/console/providers-manager'

/**
 * Plan and entitlement editor.
 *
 * Each plan is a column of checkboxes over the feature catalogue. Ticking a
 * feature grants it; the number beside it is the monthly allowance, and
 * blank means unlimited — which is the only difference between Front End and
 * the unlimited upgrade.
 *
 * Plans stack, so the preview at the bottom shows what a customer actually
 * ends up with rather than making anyone work it out from the grid.
 */

interface PlanRow {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  is_bundle: boolean
  includes: string[]
  tier: string | null
  seats: number | null
  library_limit: number | null
  grants_role: string | null
  active: boolean
}

interface FeatureRow {
  plan_id: string
  feature: string
  monthly_limit: number | null
}

/** Draft state: plan id → feature key → limit (null = unlimited). */
type Grid = Record<string, Record<string, number | null>>

export function PlansManager() {
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [grid, setGrid] = useState<Grid>({})
  const [saved, setSaved] = useState<Grid>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [missing, setMissing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [toDelete, setToDelete] = useState<PlanRow | null>(null)
  const [preview, setPreview] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data: planRows, error: planError }, { data: featureRows }] = await Promise.all([
      supabase
        .from('plans')
        .select('id, code, name, description, sort_order, is_bundle, includes, tier, seats, grants_role, library_limit, active')
        .order('sort_order'),
      supabase.from('plan_features').select('plan_id, feature, monthly_limit'),
    ])

    if (planError) {
      // The tables only exist after migration 008.
      setMissing(true)
      setError(planError.message)
      setLoading(false)
      return
    }

    const list = (planRows as PlanRow[]) ?? []
    const next: Grid = Object.fromEntries(list.map((plan) => [plan.id, {}]))

    for (const row of (featureRows as FeatureRow[]) ?? []) {
      if (next[row.plan_id]) next[row.plan_id][row.feature] = row.monthly_limit
    }

    setPlans(list)
    setGrid(next)
    setSaved(JSON.parse(JSON.stringify(next)))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dirty = JSON.stringify(grid) !== JSON.stringify(saved)

  const toggle = (planId: string, feature: string) =>
    setGrid((current) => {
      const plan = { ...current[planId] }

      if (feature in plan) delete plan[feature]
      // Default to unlimited: most upgrade tiers are, and a number is easier
      // to add than to notice you left at zero.
      else plan[feature] = null

      return { ...current, [planId]: plan }
    })

  const setLimit = (planId: string, feature: string, raw: string) =>
    setGrid((current) => ({
      ...current,
      [planId]: { ...current[planId], [feature]: raw.trim() === '' ? null : Number(raw) },
    }))

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')

    for (const plan of plans) {
      const wanted = grid[plan.id] ?? {}

      // Replace this plan's rows wholesale — simpler than diffing, and the
      // table is small.
      const { error: deleteError } = await supabase
        .from('plan_features')
        .delete()
        .eq('plan_id', plan.id)

      if (deleteError) {
        setError(`${plan.name}: ${deleteError.message}`)
        setBusy(false)
        return
      }

      const rows = Object.entries(wanted).map(([feature, monthly_limit]) => ({
        plan_id: plan.id,
        feature,
        monthly_limit,
      }))

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('plan_features').insert(rows)

        if (insertError) {
          setError(`${plan.name}: ${insertError.message}`)
          setBusy(false)
          return
        }
      }
    }

    setNotice('Plans saved.')
    await load()
    setBusy(false)
  }

  /** What a customer holding the selected plans ends up with. */
  const previewLimits = useMemo(() => {
    const asPlans: Plan[] = plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      isBundle: plan.is_bundle,
      includes: plan.includes,
      features: grid[plan.id] ?? {},
    }))

    const owned = asPlans.filter((plan) => preview.includes(plan.code))

    return mergeLimits(expandPlans(owned, asPlans))
  }, [plans, grid, preview])

  if (missing) {
    return (
      <>
        <PageHeader title="Plans" />
        <Banner tone="error">
          Plans tables not created yet. Run <code>008_plans_and_entitlements.sql</code> in the
          Supabase SQL editor, then reload.
        </Banner>
      </>
    )
  }

  const groups = [...new Set(FEATURES.map((feature) => feature.group))]

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Tick what each plan unlocks. A number is the monthly allowance; blank means unlimited."
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New plan
            </Button>
            <Button
              onClick={save}
              disabled={busy || !dirty}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* Feature matrix */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-white dark:bg-slate-900 z-10">
                  Feature
                </th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-3 py-3 text-center min-w-[110px]">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{plan.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{plan.code}</p>
                    {plan.is_bundle && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-violet-600 uppercase">
                        <Package className="w-3 h-3" />
                        bundle
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {groups.map((group) => (
                // The key belongs on the mapped element, which is the fragment
                // — putting it on the inner <tr> leaves React without one.
                <Fragment key={group}>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <td
                      colSpan={plans.length + 1}
                      className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {group}
                    </td>
                  </tr>

                  {FEATURES.filter((feature) => feature.group === group).map((feature) => (
                    <tr
                      key={feature.key}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                    >
                      <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-slate-900">
                        <p className="text-slate-800 dark:text-slate-200">{feature.label}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{feature.key}</p>
                      </td>

                      {plans.map((plan) => {
                        const owned = feature.key in (grid[plan.id] ?? {})
                        const limit = grid[plan.id]?.[feature.key] ?? null

                        // A bundle grants through its included plans, so its own
                        // cells would be misleading.
                        if (plan.is_bundle) {
                          return (
                            <td key={plan.id} className="px-3 py-2.5 text-center text-slate-300">
                              —
                            </td>
                          )
                        }

                        return (
                          <td key={plan.id} className="px-3 py-2.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="checkbox"
                                checked={owned}
                                onChange={() => toggle(plan.id, feature.key)}
                                aria-label={`${plan.name}: ${feature.label}`}
                                className="w-4 h-4 accent-indigo-600 cursor-pointer"
                              />

                              {owned && (
                                <input
                                  value={limit === null ? '' : limit}
                                  onChange={(e) => setLimit(plan.id, feature.key, e.target.value)}
                                  placeholder="∞"
                                  inputMode="numeric"
                                  aria-label={`${plan.name}: ${feature.label} monthly limit`}
                                  className="w-14 h-6 text-center text-xs rounded-md bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                                />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stacking preview */}
      <div className="mt-6">
        <SectionHeading
          title="What a customer gets"
          hint="Tick the plans someone owns — the funnel stacks, so upgrades add rather than replace."
        />

        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() =>
                  setPreview((current) =>
                    current.includes(plan.code)
                      ? current.filter((code) => code !== plan.code)
                      : [...current, plan.code]
                  )
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  preview.includes(plan.code)
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {plan.name}
              </button>
            ))}
          </div>

          {preview.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select one or more plans above.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unlockedFeatures(previewLimits).length === 0 && (
                <p className="text-sm text-slate-500">Nothing unlocked by that combination.</p>
              )}

              {unlockedFeatures(previewLimits).map((key) => {
                const limit = previewLimits[key]

                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium"
                  >
                    {FEATURES.find((f) => f.key === key)?.label ?? key}
                    {limit === null ? (
                      <InfinityIcon className="w-3 h-3" />
                    ) : (
                      <span className="tabular-nums opacity-70">{limit}/mo</span>
                    )}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Plan list with delete */}
      <div className="mt-6">
        <SectionHeading title="Plan catalogue" />

        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {plans.map((plan) => (
            <div key={plan.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {plan.name}{' '}
                  <span className="font-mono text-[11px] text-slate-400">{plan.code}</span>
                </p>
                {plan.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{plan.description}</p>
                )}
                {(plan.seats || plan.grants_role) && (
                  <p className="text-[11px] text-indigo-600 mt-0.5">
                    {plan.seats ? `${plan.seats} licences` : ''}
                    {plan.grants_role ? `${plan.seats ? ' · ' : ''}grants ${plan.grants_role.replace('_', ' ')}` : ''}
                    {plan.tier && plan.tier !== plan.code ? ` · tier ${plan.tier}` : ''}
                    {plan.library_limit === null ? ' · keeps unlimited' : ` · keeps ${plan.library_limit} of each`}
                  </p>
                )}
              </div>

              <button
                onClick={() => setToDelete(plan)}
                aria-label={`Delete ${plan.name}`}
                className="p-1.5 rounded-lg text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <NewPlanDialog
          busy={busy}
          onClose={() => setShowAdd(false)}
          onSave={async (payload) => {
            setBusy(true)
            setError('')

            const { error: writeError } = await supabase.from('plans').insert(payload)

            if (writeError) {
              setError(
                writeError.code === '23505'
                  ? 'A plan with that code already exists.'
                  : writeError.message
              )
            } else {
              setNotice(`${payload.name} created.`)
              setShowAdd(false)
              await load()
            }

            setBusy(false)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this plan?"
        message={`${toDelete?.name} will be removed, along with its feature grants. Anyone currently on it loses those tools.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (toDelete) {
            setBusy(true)
            const { error: deleteError } = await supabase.from('plans').delete().eq('id', toDelete.id)
            if (deleteError) setError(deleteError.message)
            await load()
            setBusy(false)
          }
          setToDelete(null)
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}

function NewPlanDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('80')
  const [seats, setSeats] = useState('')
  const [tier, setTier] = useState('')
  const [grantsRole, setGrantsRole] = useState('')

  // Codes end up in bundle `includes` arrays, so keep them URL-safe.
  const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')

  return (
    <Dialog title="New plan" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" hint="Short, lowercase — e.g. oto6">
          <input value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} font-mono`} />
        </Field>
        <Field label="Sort order" hint="Lower shows first">
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Tier"
        hint="Step of the funnel. Two licence sizes of one step share a tier — leave blank to use the code."
      >
        <input
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          placeholder={cleanCode || 'oto4'}
          className={`${inputClass} font-mono`}
        />
      </Field>

      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Description">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Licence seats" hint="One number — each size is its own product.">
          <input
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
        <Field label="Grants role" hint="Only for reseller / white-label tiers">
          <select
            value={grantsRole}
            onChange={(e) => setGrantsRole(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            <option value="reseller">Reseller</option>
            <option value="white_label">White label</option>
          </select>
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={busy || !cleanCode || !name}
          onClick={() =>
            onSave({
              code: cleanCode,
              name,
              description: description || null,
              sort_order: Number(sortOrder) || 0,
              tier: tier.trim() || cleanCode,
              seats: Number(seats) > 0 ? Number(seats) : null,
              grants_role: grantsRole || null,
            })
          }
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
        >
          {busy ? 'Creating…' : 'Create plan'}
        </Button>
      </div>
    </Dialog>
  )
}
