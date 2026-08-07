import { Users, Building2, ShieldCheck, Layers, Activity, AlertTriangle } from 'lucide-react'
import { createServerSupabase, getSessionContext } from '@/lib/supabase/server'
import { summariseSeats } from '@/lib/services/licences'
import { can } from '@/lib/auth/rbac'
import { PageHeader, StatTile, SeatMeter, StatusPill } from '@/components/console/console-ui'

/**
 * Console overview.
 *
 * Shared by all three consoles. Queries run through the RLS-scoped server
 * client, so a reseller's counts are limited to their own tenant by the
 * database rather than by a filter this component has to remember.
 *
 * Every query is tolerant of the pre-migration schema: before 002/003 the
 * `role` column and the `tenants` / `audit_logs` tables do not exist, and a
 * console that throws in that state is impossible to bootstrap.
 */

const ICON_CLASS = 'w-[18px] h-[18px] text-white'

interface CountResult {
  count: number
  ok: boolean
}

async function countProfiles(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role?: string
): Promise<CountResult> {
  let query = supabase.from('profiles').select('id', { count: 'exact', head: true })

  if (role) query = query.eq('role', role)

  const { count, error } = await query

  return { count: count ?? 0, ok: !error }
}

export async function ConsoleOverview() {
  const session = await getSessionContext()

  if (!session) return null

  const supabase = await createServerSupabase()
  const isSuperadmin = session.role === 'superadmin'

  // Probe once: if `role` is missing every role-filtered query is pointless.
  const usersScoped = await countProfiles(supabase, 'user')
  const schemaReady = usersScoped.ok

  const allProfiles = schemaReady ? usersScoped : await countProfiles(supabase)
  const userCount = allProfiles.count

  const [resellers, whiteLabels] = schemaReady && isSuperadmin
    ? await Promise.all([countProfiles(supabase, 'reseller'), countProfiles(supabase, 'white_label')])
    : [{ count: 0, ok: false }, { count: 0, ok: false }]

  const { data: tenant } = await supabase
    .from('tenants')
    .select('seat_limit, name')
    .eq('id', session.tenantId)
    .maybeSingle()

  const seats = summariseSeats({ limit: tenant?.seat_limit ?? null, used: userCount })

  // Credits were replaced by monthly allowances, so the headline number is how
  // many plan grants are in force rather than a balance.
  const { count: planGrants } = await supabase
    .from('user_plans')
    .select('user_id', { count: 'exact', head: true })

  const { data: auditRows } = can(session.role, 'audit_logs.view')
    ? await supabase
        .from('audit_logs')
        .select('id, action, target_type, created_at, actor_role')
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] }

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          isSuperadmin
            ? 'Everything across the platform.'
            : `Your account at a glance${tenant?.name ? ` — ${tenant.name}` : ''}`
        }
      />

      {!schemaReady && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-300">
              Database migrations not applied yet
            </p>
            <p className="mt-1 text-amber-800/80 dark:text-amber-400/80 leading-6">
              Roles, tenants, licences and audit logs are unavailable until{' '}
              <code className="font-mono text-xs">002_saas_foundation.sql</code> and{' '}
              <code className="font-mono text-xs">003_platform_services.sql</code> are run in the
              Supabase SQL editor. Counts below fall back to totals.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile
          label={schemaReady ? 'Users' : 'Profiles'}
          value={userCount}
          icon={<Users className={ICON_CLASS} />}
          tone="from-blue-500 to-indigo-600"
        />

        {isSuperadmin && (
          <>
            <StatTile
              label="Resellers"
              value={resellers.count}
              icon={<Building2 className={ICON_CLASS} />}
              tone="from-purple-500 to-fuchsia-600"
            />
            <StatTile
              label="White Labels"
              value={whiteLabels.count}
              icon={<ShieldCheck className={ICON_CLASS} />}
              tone="from-pink-500 to-rose-500"
            />
          </>
        )}

        <StatTile
          label="Plan grants"
          value={planGrants ?? 0}
          icon={<Layers className={ICON_CLASS} />}
          tone="from-amber-400 to-orange-500"
        />

        {!isSuperadmin && (
          <StatTile
            label="Seats remaining"
            value={seats.unlimited ? '∞' : (seats.remaining ?? 0)}
            icon={<Activity className={ICON_CLASS} />}
            tone="from-emerald-500 to-teal-600"
          />
        )}
      </div>

      {!seats.unlimited && (
        <div className="mb-6 max-w-md">
          <SeatMeter {...seats} />
        </div>
      )}

      {can(session.role, 'audit_logs.view') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Recent activity
            </h2>
          </div>

          <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {(auditRows ?? []).length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No activity recorded yet.
              </p>
            )}

            {(auditRows ?? []).map((entry) => {
              const row = entry as {
                id: number
                action: string
                target_type: string | null
                created_at: string
                actor_role: string | null
              }

              return (
                <div key={row.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {row.action.replace(/_/g, ' ')}
                    </p>
                    {row.target_type && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{row.target_type}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {row.actor_role && <StatusPill value={row.actor_role} />}
                    <time className="text-xs text-slate-400 tabular-nums">
                      {new Date(row.created_at).toLocaleDateString()}
                    </time>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
