'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, KeyRound, Ban, CheckCircle2, Trash2, RefreshCw, UserCog, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/db'
import { can, canCreateRole, type Role } from '@/lib/auth/rbac'
import { RESELLER_LICENCE_TIERS, WHITE_LABEL_LICENCE_TIERS } from '@/lib/services/licences'
import { UserPlansPanel } from '@/components/console/user-plans-panel'
import {
  PageHeader,
  DataTable,
  StatusPill,
  ConfirmDialog,
  type Column,
} from '@/components/console/console-ui'
import { POLICY_MODES, toPolicyMode, policyLabel } from '@/lib/ai/policy'

/**
 * Account management, shared by all three consoles.
 *
 * Reads go through the browser client so RLS scopes them: a reseller's query
 * returns only their own tenant without this component filtering anything.
 * Writes go to /api/console/accounts, which re-checks every rule server-side.
 */

interface AccountRow {
  id: string
  email: string
  username: string | null
  role: Role
  status: string
  created_at: string | null
  /** Null on a schema older than migration 003. */
  api_policy: string | null
}

type PendingAction =
  | { kind: 'suspend' | 'activate' | 'delete'; row: AccountRow }
  | null

export function AccountsManager({
  actorRole,
  manageRole,
  title,
  subtitle,
  bundleOnly,
}: {
  actorRole: Role
  /**
   * Which account types this screen lists.
   *
   * The superadmin passes several: buying OTO 4 turns a customer into a
   * reseller, and an account that vanished from the list the moment it was
   * upgraded would be worse than useless. New accounts are created as the
   * first role given.
   */
  manageRole: Role | Role[]
  title: string
  subtitle: string
  /**
   * Narrow the list to accounts holding a bundle. The bundle is sold on its
   * own rather than up the chain, so those customers are managed separately.
   */
  bundleOnly?: boolean
}) {
  const roles = useMemo(
    () => (Array.isArray(manageRole) ? manageRole : [manageRole]),
    // A fresh array each render would restart the load effect forever.
    [Array.isArray(manageRole) ? manageRole.join(',') : manageRole] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const createRole = roles[0]

  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [planFor, setPlanFor] = useState<AccountRow | null>(null)
  const [planLabels, setPlanLabels] = useState<Record<string, string[]>>({})
  const [pending, setPending] = useState<PendingAction>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [{ data, error: queryError }, { data: planRows }, { data: ownedRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, username, role, status, created_at, api_policy')
        .in('role', roles)
        .order('created_at', { ascending: false }),
      supabase.from('plans').select('id, code, name, is_bundle').order('sort_order'),
      supabase.from('user_plans').select('user_id, plan_id'),
    ])

    if (queryError) setError(queryError.message)

    const planById = new Map(
      ((planRows as { id: string; code: string; name: string; is_bundle: boolean }[]) ?? []).map(
        (plan) => [plan.id, plan]
      )
    )

    const labels: Record<string, string[]> = {}
    const bundleHolders = new Set<string>()

    for (const row of ((ownedRows as { user_id: string; plan_id: string }[]) ?? [])) {
      const plan = planById.get(row.plan_id)
      if (!plan) continue

      labels[row.user_id] = [...(labels[row.user_id] ?? []), plan.name]
      if (plan.is_bundle) bundleHolders.add(row.user_id)
    }

    const all = (data as AccountRow[]) ?? []

    setPlanLabels(labels)
    setRows(bundleOnly ? all.filter((row) => bundleHolders.has(row.id)) : all)
    setLoading(false)
  }, [roles, bundleOnly])

  useEffect(() => {
    load()
  }, [load])

  const call = async (init: RequestInit & { url?: string }) => {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const response = await fetch(init.url ?? '/api/console/accounts', init)
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(payload.error ?? 'Something went wrong')
        return false
      }

      await load()
      return true
    } catch {
      setError('Network error — please try again')
      return false
    } finally {
      setBusy(false)
    }
  }

  const runPending = async () => {
    if (!pending) return

    const ok =
      pending.kind === 'delete'
        ? await call({ url: `/api/console/accounts?id=${pending.row.id}`, method: 'DELETE' })
        : await call({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pending.row.id, action: pending.kind }),
          })

    if (ok) setNotice(`${pending.row.email} — ${pending.kind}d.`)

    setPending(null)
  }

  /**
   * Sign in as this account. Superadmin only — the API refuses anyone else,
   * and the link it returns is a genuine Supabase session, not a forged token.
   */
  const impersonate = async (row: AccountRow) => {
    const confirmed = window.confirm(
      `Sign in as ${row.email}? You will be signed out of your own session.`
    )

    if (!confirmed) return

    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/console/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) setError(payload.error ?? 'Could not sign in as that account')
      else window.location.href = payload.link
    } catch {
      setError('Network error — please try again')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Which keys this account may run on.
   *
   * Takes effect on their next generation — nothing is cached per user, so
   * there is no window where the console and the runtime disagree.
   */
  const setApiPolicy = async (row: AccountRow, policy: string) => {
    const ok = await call({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, action: 'api_policy', policy }),
    })

    if (ok) setNotice(`${row.email} — AI keys set to “${policyLabel(toPolicyMode(policy))}”.`)
  }

  const resetPassword = async (row: AccountRow) => {
    const input = window.prompt(`New password for ${row.email} (min 8 characters)`)

    if (!input) return

    const ok = await call({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, action: 'password', password: input }),
    })

    if (ok) setNotice(`Password reset for ${row.email}.`)
  }

  const columns: Column<AccountRow>[] = useMemo(
    () => [
      {
        key: 'email',
        header: 'Account',
        sortValue: (row) => (row.username ?? row.email).toLowerCase(),
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate">{row.email}</p>
            {row.username && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{row.username}</p>
            )}
          </div>
        ),
      },
      ...(roles.length > 1
        ? [
            {
              key: 'role',
              header: 'Account',
              sortValue: (row: AccountRow) => row.role,
              render: (row: AccountRow) => <AccountTypePill role={row.role} />,
            } as Column<AccountRow>,
          ]
        : []),
      {
        key: 'versions',
        header: 'Versions',
        sortValue: (row) => (planLabels[row.id] ?? []).length,
        render: (row) => {
          const held = planLabels[row.id] ?? []

          if (held.length === 0) {
            return <span className="text-xs text-slate-400">None</span>
          }

          return (
            <div className="flex flex-wrap gap-1">
              {held.map((name) => (
                <span
                  key={name}
                  className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-semibold whitespace-nowrap"
                >
                  {name}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        key: 'status',
        header: 'Status',
        sortValue: (row) => row.status,
        render: (row) => <StatusPill value={row.status} />,
      },
      // Only for whoever manages the provider keys. A reseller who can suspend
      // their users must not be able to point them at their own AI billing.
      ...(can(actorRole, 'apis.manage')
        ? [
            {
              key: 'api_policy',
              header: 'AI keys',
              sortValue: (row: AccountRow) => row.api_policy ?? '',
              render: (row: AccountRow) => (
                <select
                  value={toPolicyMode(row.api_policy)}
                  onChange={(event) => setApiPolicy(row, event.target.value)}
                  aria-label={`AI key policy for ${row.email}`}
                  className="h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {POLICY_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              ),
            } satisfies Column<AccountRow>,
          ]
        : []),
      {
        key: 'created',
        header: 'Created',
        sortValue: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
        render: (row) =>
          row.created_at ? (
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {new Date(row.created_at).toLocaleDateString()}
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">

            {can(actorRole, 'plans.manage') && (
              <IconButton
                label="Manage access & allowances"
                onClick={() => setPlanFor(row)}
                tone="text-indigo-600"
              >
                <Layers className="w-4 h-4" />
              </IconButton>
            )}

            {can(actorRole, 'users.reset_password') && (
              <IconButton label="Reset password" onClick={() => resetPassword(row)}>
                <KeyRound className="w-4 h-4" />
              </IconButton>
            )}

            {can(actorRole, 'users.suspend') &&
              (row.status === 'suspended' ? (
                <IconButton
                  label="Reactivate"
                  onClick={() => setPending({ kind: 'activate', row })}
                  tone="text-emerald-600"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </IconButton>
              ) : (
                <IconButton
                  label="Suspend"
                  onClick={() => setPending({ kind: 'suspend', row })}
                  tone="text-amber-600"
                >
                  <Ban className="w-4 h-4" />
                </IconButton>
              ))}

            {can(actorRole, 'users.impersonate') && (
              <IconButton label="Sign in as this user" onClick={() => impersonate(row)} tone="text-violet-600">
                <UserCog className="w-4 h-4" />
              </IconButton>
            )}

            {can(actorRole, 'users.delete') && (
              <IconButton
                label="Delete"
                onClick={() => setPending({ kind: 'delete', row })}
                tone="text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </IconButton>
            )}
          </div>
        ),
      },
    ],
    // resetPassword and impersonate close over `load`, which is stable.
    [actorRole, planLabels, roles] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {canCreateRole(actorRole, createRole) && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 ring-1 ring-red-100 dark:ring-red-500/20 text-red-600 text-sm">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-100 dark:ring-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
          {notice}
        </div>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search by email or name…"
        searchFields={(row) => `${row.email} ${row.username ?? ''}`}
        emptyMessage="No accounts yet."
      />

      {showCreate && (
        <CreateAccountDialog
          actorRole={actorRole}
          manageRole={createRole}
          busy={busy}
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            const ok = await call({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, role: createRole }),
            })

            if (ok) {
              setNotice(`${payload.email} created.`)
              setShowCreate(false)
            }
          }}
        />
      )}

      {planFor && (
        <UserPlansPanel
          userId={planFor.id}
          email={planFor.email}
          onClose={() => {
            setPlanFor(null)
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.kind === 'delete'
            ? 'Delete this account?'
            : pending?.kind === 'suspend'
              ? 'Suspend this account?'
              : 'Reactivate this account?'
        }
        message={
          pending?.kind === 'delete'
            ? `${pending.row.email} will be removed permanently, along with their login. This cannot be undone.`
            : pending?.kind === 'suspend'
              ? `${pending?.row.email} will be signed out and blocked from every page until reactivated.`
              : `${pending?.row.email} will be able to sign in again.`
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete' : 'Confirm'}
        destructive={pending?.kind === 'delete' || pending?.kind === 'suspend'}
        busy={busy}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </>
  )
}

function IconButton({
  label,
  onClick,
  tone = 'text-slate-500',
  children,
}: {
  label: string
  onClick: () => void
  tone?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg ${tone} hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
    >
      {children}
    </button>
  )
}

function CreateAccountDialog({
  actorRole,
  manageRole,
  busy,
  onClose,
  onCreate,
}: {
  actorRole: Role
  manageRole: Role
  busy: boolean
  onClose: () => void
  onCreate: (payload: Record<string, unknown>) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [seatLimit, setSeatLimit] = useState<number>(
    manageRole === 'reseller' ? RESELLER_LICENCE_TIERS[0] : WHITE_LABEL_LICENCE_TIERS[0]
  )

  const needsLicence = manageRole === 'reseller' || manageRole === 'white_label'
  const tiers = manageRole === 'reseller' ? RESELLER_LICENCE_TIERS : WHITE_LABEL_LICENCE_TIERS

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-2xl p-6">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          New {manageRole.replace('_', ' ')} account
        </h2>

        <div className="mt-5 space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="person@example.com"
            />
          </Field>

          <Field label="Password" hint="Minimum 8 characters">
            <input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="Set an initial password"
            />
          </Field>

          {needsLicence && (
            <>
              <Field label="Business name">
                <input
                  value={tenantName}
                  onChange={(event) => setTenantName(event.target.value)}
                  className={inputClass}
                  placeholder="Their company name"
                />
              </Field>

              <Field label="Licence">
                <select
                  value={seatLimit}
                  onChange={(event) => setSeatLimit(Number(event.target.value))}
                  className={inputClass}
                >
                  {tiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier} users
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>

          <Button
            disabled={busy || !email || !password}
            onClick={() =>
              onCreate({
                email,
                password,
                tenantName,
                seatLimit,
              })
            }
            className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
          >
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

/**
 * What kind of account this is.
 *
 * Shown only on the superadmin's list, where plain customers sit alongside the
 * resellers and white labels their OTO 4 and OTO 5 purchases created.
 */
function AccountTypePill({ role }: { role: Role }) {
  const styles: Record<string, string> = {
    user: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    reseller: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    white_label: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400',
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
        styles[role] ?? styles.user
      }`}
    >
      {role.replace('_', ' ')}
    </span>
  )
}
